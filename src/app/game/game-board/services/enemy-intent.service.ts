import { Injectable, OnDestroy, Optional } from '@angular/core';
import * as THREE from 'three';
import { Subject } from 'rxjs';

import { Enemy, EnemyType, VEINSEEKER_SPEED_BOOST_WINDOW } from '../models/enemy.model';
import { ENEMY_INTENT_CONFIG } from '../constants/enemy-intent.constants';
import { EnemyService } from './enemy.service';
import { ForwardSimulationService } from './forward-simulation.service';
import { SceneService } from './scene.service';
import { StatusEffectService } from './status-effect.service';
import { PathMutationService } from './path-mutation.service';
import { TextSpritePoolService } from './text-sprite-pool.service';
import { CombatLoopService } from './combat-loop.service';

/**
 * Displays world-space "turns to exit" markers above active enemy meshes.
 *
 * Sprites float ENEMY_INTENT_CONFIG.spriteYOffset units above each enemy and
 * display the integer turns-to-exit value (e.g. "5t"). Color encodes urgency:
 *   - Green  (> 5 turns)  — low threat
 *   - Amber  (3-5 turns)  — warning
 *   - Red    (≤ 2 turns)  — imminent leak
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered in GameBoardComponent.providers array.
 *
 * Call `update(pendingCardId)` once per render frame (or at turn-end). The
 * call is made from GameRenderService.runPausedVisuals / processCombatResult
 * via an @Optional() injection so older test beds without this service remain
 * unaffected.
 */
@Injectable()
export class EnemyIntentService implements OnDestroy {
  /** Map from enemy ID → the THREE.Sprite currently floating above that enemy. */
  private readonly sprites = new Map<string, THREE.Sprite>();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly enemyService: EnemyService,
    private readonly forwardSim: ForwardSimulationService,
    private readonly statusEffectService: StatusEffectService,
    private readonly combatLoopService: CombatLoopService,
    /** @Optional() — PathMutationService may be absent in lightweight test beds. */
    @Optional() private readonly pathMutationService: PathMutationService | null,
    /** @Optional() — SceneService may be absent in lightweight test beds. */
    @Optional() private readonly sceneService: SceneService | null,
    /** @Optional() — TextSpritePoolService may be absent in lightweight test beds. */
    @Optional() private readonly spritePool: TextSpritePoolService | null,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Synchronize intent markers with the current enemy roster.
   *
   * - Creates a sprite for any enemy that doesn't have one yet.
   * - Updates the position + text + color of every sprite.
   * - Removes sprites for dead or absent enemies.
   * - Hides ALL sprites when `placementActive` is true (reduces visual clutter
   *   while the player is targeting a tile for a tower/card placement).
   *
   * @param placementActive  True when a pending tower/terraform card is awaiting
   *   tile selection (mirrors card-hand's tooltip-suppression guard).
   */
  update(placementActive: boolean): void {
    if (!this.sceneService || !this.spritePool) return;

    const enemies = this.enemyService.getEnemies();
    const currentTurn = this.combatLoopService.getTurnNumber();
    const scene = this.sceneService.getScene();

    // --- Tombstone enemies no longer in the roster or now dying/dead ---
    for (const [id, sprite] of this.sprites) {
      const enemy = enemies.get(id);
      if (!enemy || enemy.dying || enemy.health <= 0) {
        this.releaseSprite(id, sprite);
      }
    }

    // --- Create / update marker for each living enemy ---
    for (const [id, enemy] of enemies) {
      if (enemy.dying || enemy.health <= 0) continue;

      const turns = this.projectTurns(enemy, currentTurn);
      const text = `${turns}t`;
      const color = this.colorForTurns(turns);
      const colorHex = `#${color.toString(16).padStart(6, '0')}`;

      let sprite = this.sprites.get(id);

      if (!sprite) {
        // Acquire a new sprite from the pool
        sprite = this.spritePool.acquire({
          text,
          textColor: colorHex,
          strokeColor: ENEMY_INTENT_CONFIG.strokeColor,
          strokeWidth: ENEMY_INTENT_CONFIG.strokeWidth,
          font: `bold ${ENEMY_INTENT_CONFIG.fontSize}px ${ENEMY_INTENT_CONFIG.fontFamily}`,
          canvasWidth: ENEMY_INTENT_CONFIG.canvasWidth,
          canvasHeight: ENEMY_INTENT_CONFIG.canvasHeight,
          scaleX: ENEMY_INTENT_CONFIG.spriteScaleX,
          scaleY: ENEMY_INTENT_CONFIG.spriteScaleY,
        });
        scene.add(sprite);
        this.sprites.set(id, sprite);
      } else {
        // Update existing sprite texture if text or color changed
        const currentText = sprite.userData['intentText'] as string | undefined;
        const currentColor = sprite.userData['intentColor'] as string | undefined;
        if (currentText !== text || currentColor !== colorHex) {
          // Release old sprite back to pool and re-acquire with updated texture
          this.releaseSprite(id, sprite);
          sprite = this.spritePool.acquire({
            text,
            textColor: colorHex,
            strokeColor: ENEMY_INTENT_CONFIG.strokeColor,
            strokeWidth: ENEMY_INTENT_CONFIG.strokeWidth,
            font: `bold ${ENEMY_INTENT_CONFIG.fontSize}px ${ENEMY_INTENT_CONFIG.fontFamily}`,
            canvasWidth: ENEMY_INTENT_CONFIG.canvasWidth,
            canvasHeight: ENEMY_INTENT_CONFIG.canvasHeight,
            scaleX: ENEMY_INTENT_CONFIG.spriteScaleX,
            scaleY: ENEMY_INTENT_CONFIG.spriteScaleY,
          });
          scene.add(sprite);
          this.sprites.set(id, sprite);
        }
      }

      // Store text/color metadata so we can skip re-acquire when unchanged
      sprite.userData['intentText'] = text;
      sprite.userData['intentColor'] = colorHex;

      // Position above the enemy mesh
      sprite.position.set(
        enemy.position.x,
        enemy.position.y + ENEMY_INTENT_CONFIG.spriteYOffset,
        enemy.position.z,
      );

      // Confidence fade: when SLOW will expire BEFORE the projected exit, the
      // projection's tiles-per-turn assumption is wrong for the back half of
      // the projection horizon. Fade the marker so players don't over-trust it.
      sprite.material.opacity = this.confidenceOpacityFor(enemy, turns, currentTurn);
      sprite.material.transparent = true;

      // Visibility: hide during card placement mode
      sprite.visible = !placementActive;
    }
  }

  // Returns the opacity to apply for the given (enemy, projected turns) pair.
  // Currently a single low-confidence trigger: SLOW about to expire mid-projection.
  // Add new triggers here as more uncertainty sources are surfaced (status-effect
  // expiry, modifier-card expiry, etc.) — keep the predicate explicit per source.
  private confidenceOpacityFor(enemy: Enemy, projectedTurns: number, currentTurn: number): number {
    const slowRemaining = this.statusEffectService.getSlowRemainingTurns(enemy.id, currentTurn);
    if (slowRemaining > 0 && slowRemaining < projectedTurns) {
      return ENEMY_INTENT_CONFIG.opacityUncertain;
    }
    return ENEMY_INTENT_CONFIG.opacityConfident;
  }

  /**
   * Release all sprites and clean up. Called explicitly from
   * GameSessionService.cleanupScene() and by Angular's OnDestroy lifecycle.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disposeAll();
  }

  /**
   * Imperatively release every tracked sprite back to the pool.
   * Safe to call multiple times — idempotent after the first call.
   */
  disposeAll(): void {
    for (const [id, sprite] of this.sprites) {
      this.releaseSprite(id, sprite);
    }
    this.sprites.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private releaseSprite(id: string, sprite: THREE.Sprite): void {
    this.spritePool?.release(sprite);
    this.sprites.delete(id);
  }

  /**
   * Project turns-to-exit for an enemy, forwarding the same slow/boost
   * parameters used by projectedLeaksNextTurn in GameBoardComponent.
   */
  private projectTurns(enemy: Enemy, currentTurn: number): number {
    const slow = this.statusEffectService.getSlowTileReduction(enemy.id);
    const veinseekerBoosted =
      enemy.type === EnemyType.VEINSEEKER &&
      (this.pathMutationService?.wasMutatedInLastTurns(currentTurn, VEINSEEKER_SPEED_BOOST_WINDOW) ?? false);
    return this.forwardSim.projectTurnsToExit(enemy, slow, 0, veinseekerBoosted);
  }

  /** Return the hex color value (without #) for the given turns-to-exit count. */
  private colorForTurns(turns: number): number {
    if (turns <= ENEMY_INTENT_CONFIG.leakThresholdTurns) {
      return ENEMY_INTENT_CONFIG.colorDanger;
    }
    if (turns <= ENEMY_INTENT_CONFIG.warnThresholdTurns) {
      return ENEMY_INTENT_CONFIG.colorWarn;
    }
    return ENEMY_INTENT_CONFIG.colorSafe;
  }
}
