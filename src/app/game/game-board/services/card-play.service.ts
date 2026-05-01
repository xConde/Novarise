import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';

import { TowerType, MAX_TOWER_LEVEL } from '../models/tower.model';
import { GamePhase } from '../models/game-state.model';
import { GameStateService } from './game-state.service';
import { GameStatsService } from './game-stats.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { AudioService } from './audio.service';
import { SceneService } from './scene.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { StatusEffectService } from './status-effect.service';
import { CombatLoopService } from './combat-loop.service';
import { CardEffectService, SpellContext } from '../../../run/services/card-effect.service';
import { DeckService } from '../../../run/services/deck.service';
import { RunService } from '../../../run/services/run.service';
import { WavePreviewService } from './wave-preview.service';
import { PathMutationService } from './path-mutation.service';
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';
import {
  CardInstance,
  SpellCardEffect,
  ModifierCardEffect,
  UtilityCardEffect,
  TerraformTargetCardEffect,
  ElevationTargetCardEffect,
  TileTargetResult,
  isTerraformTargetEffect,
  isElevationTargetEffect,
  CardDefinition,
} from '../../../run/models/card.model';
import { MutationOp } from './path-mutation.types';
import { ElevationOp } from './elevation.types';
import { getCardDefinition, getEffectiveEnergyCost } from '../../../run/constants/card-definitions';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';
import { buildDisposeProtect, disposeGroup } from '../utils/three-utils';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { TargetPreviewService } from './target-preview.service';

/**
 * Upgraded CARTOGRAPHER_SEAL refunds this many energy on the first terraform
 * card played each turn. Mirror of CARD_VALUES.cartographerSealRefundAmount —
 * both must stay in sync. Lives here (service module scope) rather than in a
 * shared constants file because it's consumed only by maybeRefundTerraform
 * below and the symmetric test in card-play.service.spec.ts.
 */
const CARTOGRAPHER_SEAL_REFUND_AMOUNT = 1;

export interface CardPlayCallbacks {
  onEnterPlacementMode: (type: TowerType, card: CardInstance) => void;
  /** Called after fortify/salvage — triggers updateTileHighlights + updateChallengeIndicators. */
  onRefreshUI: () => void;
  /** Called after salvage — clears selected tile, refreshes path overlay, deselects tower if it matched the salvaged key. */
  onSalvageComplete: (salvageKey: string) => void;
  /**
   * Called when a terraform-target card enters tile-targeting mode.
   *
   * WHY THIS EXISTS: GameBoardComponent needs to know when the player has
   * activated a tile-targeting card so it can update the cursor, highlights,
   * and UI state (e.g., show a "click a tile" prompt). This is the parallel
   * of `onEnterPlacementMode` for tower cards.
   */
  onEnterTileTargetMode?: (card: CardInstance, op: MutationOp | ElevationOp) => void;
  /**
   * Called when tile-target mode is exited — either by successful resolution,
   * cancellation, or teardown. Clears any targeting-mode UI state.
   *
   * WHY THIS EXISTS: The component can't poll card state every frame; it needs
   * a push notification to tear down tile-target highlights and cursor changes.
   */
  onExitTileTargetMode?: () => void;
}

/**
 * Manages card play logic: tower card placement limbo, spell/modifier/utility
 * resolution, fortify and salvage spells.
 *
 * Component-scoped — provided in GameBoardComponent.providers.
 */
@Injectable()
export class CardPlayService {
  private pendingTowerCard: CardInstance | null = null;
  private callbacks: CardPlayCallbacks | null = null;

  /**
   * Pending state for the two-phase terraform-target card flow.
   *
   * WHY KEPT SEPARATE FROM pendingTowerCard: Tower cards and terraform-target
   * cards are mutually exclusive modes. Mixing them into a single field would
   * require a discriminant and risk inadvertent cross-contamination (e.g.,
   * resolving a terraform op but consuming a tower card). Keeping them
   * separate makes it impossible to have both modes active simultaneously —
   * the type system enforces the invariant.
   */
  private pendingTileTargetCard: CardInstance | null = null;
  private pendingTileTargetEffect: TerraformTargetCardEffect | null = null;

  /**
   * Pending state for the two-phase elevation-target card flow (Phase 3 Highground).
   *
   * WHY SEPARATE FROM pendingTileTargetEffect: Elevation-target effects route to
   * ElevationService, not PathMutationService. Keeping them in distinct fields
   * prevents accidental cross-dispatch if the switch ever needs to distinguish
   * "terraform pending" vs "elevation pending" for UI state. Only one of
   * `pendingTileTargetEffect` or `pendingElevationTargetEffect` may be non-null
   * at any time — `clearTileTargetState` nulls both.
   */
  private pendingElevationTargetCard: CardInstance | null = null;
  private pendingElevationTargetEffect: ElevationTargetCardEffect | null = null;

  constructor(
    private deckService: DeckService,
    private cardEffectService: CardEffectService,
    private towerCombatService: TowerCombatService,
    private gameStateService: GameStateService,
    private meshRegistry: BoardMeshRegistryService,
    private towerUpgradeVisualService: TowerUpgradeVisualService,
    private audioService: AudioService,
    private gameStatsService: GameStatsService,
    private gameBoardService: GameBoardService,
    private enemyService: EnemyService,
    private sceneService: SceneService,
    private statusEffectService: StatusEffectService,
    private combatLoopService: CombatLoopService,
    private wavePreviewService: WavePreviewService,
    /** Phase 1 closer (Finding 3) — seeded run RNG bridge for deterministic
     *  card-side randomness (FORTIFY tower selection). */
    private runService: RunService,
    /**
     * Injected to execute the actual tile mutation in resolveTileTarget.
     * Component-scoped: no DI cycle since CardPlayService is also component-scoped.
     */
    private pathMutationService: PathMutationService,
    /**
     * Injected to execute elevation ops in resolveTileTarget (Phase 3 Highground).
     * Component-scoped: peer to PathMutationService in GameModule.
     * elevation-model.md §4 — peer service, not a MutationOp extension.
     */
    private elevationService: ElevationService,
    /**
     * CONDUIT_BRIDGE writes virtual edges via this service.
     * @Optional() — when absent, bridge_towers is a no-op (energy still consumed).
     */
    @Optional() private towerGraphService?: TowerGraphService,
    // @Optional() — Phase B sprint 14. Used to protect registry-shared
    // resources when card effects dispose tower meshes.
    @Optional() private geometryRegistry?: GeometryRegistryService,
    @Optional() private materialRegistry?: MaterialRegistryService,
    /**
     * @Optional() — aim-cache invalidation after tower mutation cards
     * (FORTIFY). When absent (test beds without full providers), invalidation
     * is skipped; aim cache simply becomes stale until the next enemy event.
     */
    @Optional() private targetPreviewService?: TargetPreviewService,
  ) {}

  /**
   * Wire up component-level callbacks.
   * Call once from ngAfterViewInit (after renderer is ready).
   */
  init(callbacks: CardPlayCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Whether ANY card is currently in limbo — either a tower card awaiting
   * tile placement, or a terraform card awaiting a tile target.
   *
   * Used by `WaveCombatFacadeService.endTurn` to block turn resolution while
   * a card is mid-resolution. Returning true for tile-target cards closes
   * the sprint-24 red-team Finding 1: without it, ending a turn while a
   * terraform card was pending would discard the hand (including that card)
   * but leave `pendingTileTargetCard` stale — the next tile click would
   * consume a card that no longer exists, potentially applying a free
   * mutation (board change without energy paid).
   */
  hasPendingCard(): boolean {
    return (
      this.pendingTowerCard !== null ||
      this.pendingTileTargetCard !== null ||
      this.pendingElevationTargetCard !== null
    );
  }

  /** Returns the pending tower card (used by tryPlaceTower to capture before consuming). */
  getPendingCard(): CardInstance | null {
    return this.pendingTowerCard;
  }

  /** Expose pending tower card instanceId for CardHandComponent binding. */
  getPendingCardId(): string | null {
    return this.pendingTowerCard?.instanceId ?? null;
  }

  /**
   * Returns the card currently awaiting a tile-target click, or null.
   *
   * WHY THIS EXISTS: GameBoardComponent.onTilePlace needs to distinguish
   * between "player is placing a tower" and "player is targeting a tile for a
   * terraform card". Checking this getter is cheaper than adding a new flag to
   * GameState, and keeps tile-target mode state purely in this service.
   */
  getPendingTileTargetCard(): CardInstance | null {
    return this.pendingTileTargetCard;
  }

  /**
   * Handle a card played from CardHandComponent.
   *
   * Tower cards: defer consumption — enter placement mode, consume on actual
   * tile click. Cancel returns card to hand.
   *
   * Spell/modifier/utility: consume immediately (instant effects).
   */
  onCardPlayed(card: CardInstance): void {
    // Card play locked to COMBAT phase.
    const phase = this.gameStateService.getState().phase;
    if (phase !== GamePhase.COMBAT) {
      return;
    }
    // Clicking the pending tower card again cancels placement
    if (this.pendingTowerCard && this.pendingTowerCard.instanceId === card.instanceId) {
      this.cancelPendingTowerCard();
      this.callbacks?.onRefreshUI();
      return;
    }
    // Clicking the pending tile-target card again cancels tile-target mode
    if (this.pendingTileTargetCard && this.pendingTileTargetCard.instanceId === card.instanceId) {
      this.cancelTileTarget();
      this.callbacks?.onRefreshUI();
      return;
    }
    // Clicking the pending elevation-target card again cancels elevation-target mode
    if (this.pendingElevationTargetCard && this.pendingElevationTargetCard.instanceId === card.instanceId) {
      this.cancelTileTarget();
      this.callbacks?.onRefreshUI();
      return;
    }

    // Resolve the card definition before mode-blocking checks so we can
    // determine whether a terraform card should override tower-placement limbo.
    const def = getCardDefinition(card.cardId);
    const effect = card.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;

    if (isTerraformTargetEffect(effect)) {
      // Terraform-target takes priority over tower placement (spec §4).
      // Cancel any pending tower card — both modes cannot be active simultaneously.
      this.cancelPendingTowerCard();
      // Also cancel an existing tile-target card (replace it, same as towers).
      this.clearTileTargetState();

      // Check energy affordability without consuming — same pattern as tower cards.
      if (this.deckService.getEnergy().current < getEffectiveEnergyCost(card)) return;

      // Enter tile-target mode — hold the card in limbo.
      this.pendingTileTargetCard = card;
      this.pendingTileTargetEffect = effect;
      this.callbacks?.onEnterTileTargetMode?.(card, effect.op);
      return;
    }

    if (isElevationTargetEffect(effect)) {
      // Elevation-target: same two-phase pattern as terraform-target but routes
      // to ElevationService. Cancel any pending modes before entering limbo.
      this.cancelPendingTowerCard();
      this.clearTileTargetState();

      if (this.deckService.getEnergy().current < getEffectiveEnergyCost(card)) return;

      this.pendingElevationTargetCard = card;
      this.pendingElevationTargetEffect = effect;
      this.callbacks?.onEnterTileTargetMode?.(card, effect.op);
      return;
    }

    // Block other card plays while a tower card is awaiting placement
    if (this.pendingTowerCard) return;
    // Block other card plays while a tile-target card is awaiting a tile click
    if (this.pendingTileTargetCard) return;
    // Block other card plays while an elevation-target card is awaiting a tile click
    if (this.pendingElevationTargetCard) return;

    if (effect.type === 'tower') {
      // Cancel any existing pending tower card first (defensive)
      this.cancelPendingTowerCard();

      // Check energy affordability without consuming
      if (this.deckService.getEnergy().current < getEffectiveEnergyCost(card)) return;

      // Hold the card in limbo — don't consume yet
      this.pendingTowerCard = card;
      this.callbacks?.onEnterPlacementMode(effect.towerType, card);
      return;
    }

    // Non-tower cards: consume immediately.
    // Pre-validate spells that require a live target before consuming energy.
    if (effect.type === 'spell') {
      const spellEffect = effect as SpellCardEffect;
      if (spellEffect.spellId === 'salvage') {
        if (this.towerCombatService.getPlacedTowers().size === 0) return;
      } else if (spellEffect.spellId === 'fortify') {
        const towers = Array.from(this.towerCombatService.getPlacedTowers().values());
        // At least one tower must be eligible for an L1→L2 upgrade. We don't gate
        // on the upgraded count (effect.value) — partial fulfilment is allowed
        // (Sprint 5: upgraded variant upgrades up to 2 but tolerates fewer eligible).
        if (!towers.some(t => t.level < MAX_TOWER_LEVEL - 1)) return;
      }
    }

    const cardInstanceId = card.instanceId;
    const energyCost = getEffectiveEnergyCost(card);
    if (!this.deckService.playCard(cardInstanceId)) return;

    try {
      switch (effect.type) {
        case 'spell': {
          const spellEffect = effect as SpellCardEffect;
          if (spellEffect.spellId === 'fortify') {
            // Phase 1 Sprint 5: effect.value is now the upgrade count
            // (1 base, 2 upgraded). Fewer eligible towers → fewer upgrades.
            this.fortifyRandomTower(spellEffect.value);
          } else if (spellEffect.spellId === 'salvage') {
            this.salvageLastTower();
          } else {
            this.cardEffectService.applySpell(spellEffect, {
              gameState: this.gameStateService,
              enemyService: this.enemyService,
              statusEffectService: this.statusEffectService,
              currentTurn: this.combatLoopService.getTurnNumber(),
              deckService: this.deckService,
              wavePreviewService: this.wavePreviewService,
            } satisfies SpellContext);
          }
          break;
        }
        case 'modifier':
          this.cardEffectService.applyModifier(effect as ModifierCardEffect);
          break;
        case 'utility':
          this.executeUtilityCard(effect as UtilityCardEffect);
          break;
      }
    } catch (err) {
      console.error('Card effect threw — rolling back play:', err);
      this.deckService.undoPlay(cardInstanceId, energyCost);
    }
  }

  /** Cancel the pending tower card — return it to hand without consuming energy. */
  cancelPendingTowerCard(): void {
    this.pendingTowerCard = null;
  }

  /**
   * Consume the pending tower card after successful tower placement.
   * Called from tryPlaceTower() on successful placement.
   */
  consumePendingTowerCard(): void {
    if (!this.pendingTowerCard) return;
    this.deckService.playCard(this.pendingTowerCard.instanceId);
    this.pendingTowerCard = null;
  }

  /**
   * Attempt to resolve the pending tile-target card at (row, col).
   *
   * WHY THIS EXISTS: The two-phase terraform flow needs a single resolution
   * point that handles energy re-check, mutation dispatch, card consumption,
   * and state cleanup atomically. Keeping it here (rather than in
   * GameBoardComponent) means the resolution logic is testable without a
   * component fixture.
   *
   * Energy is re-checked at this point (not just at card click time) because
   * another card could have been played between the click and the tile pick,
   * reducing available energy.
   *
   * On mutation failure: the pending state is NOT cleared so the player can
   * pick a different valid tile without re-playing the card.
   */
  resolveTileTarget(
    row: number,
    col: number,
    scene: THREE.Scene,
    currentTurn: number,
  ): TileTargetResult {
    // Phase 3 Highground — elevation-target cards are resolved here alongside
    // terraform-target cards so the caller (GameBoardComponent.onTilePlace)
    // uses one resolution point for all tile-target modes.
    if (this.pendingElevationTargetCard && this.pendingElevationTargetEffect) {
      return this.resolveElevationTarget(row, col, currentTurn);
    }

    if (!this.pendingTileTargetCard || !this.pendingTileTargetEffect) {
      return { ok: false, reason: 'no-pending-card' };
    }

    const card = this.pendingTileTargetCard;
    const effect = this.pendingTileTargetEffect;
    const def = getCardDefinition(card.cardId);

    // Re-check energy immediately before mutation — a prior card play this
    // turn may have reduced available energy since the card was clicked.
    if (this.deckService.getEnergy().current < getEffectiveEnergyCost(card)) {
      this.clearTileTargetState();
      this.callbacks?.onExitTileTargetMode?.();
      return { ok: false, reason: 'insufficient-energy' };
    }

    // Sprint 17 CARTOGRAPHER_SEAL — if the player has this modifier active,
    // every terraform mutation played this encounter is forced permanent.
    // The flag is read live here; its value is unused (just a presence check).
    // Applies to block/bridgehead only — build is already permanent (duration
    // is passed through as-is; anchor = null just reinforces that), and
    // destroy is always permanent regardless.
    const anchor = this.cardEffectService.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR);
    const buildDuration = anchor ? null : effect.duration;
    // Block / bridgehead: null = "permanent" within the terraform op semantics.
    const blockDuration = anchor ? null : (effect.duration ?? 2);
    const bridgeheadDuration = anchor ? null : (effect.duration ?? 3);

    // Route to the correct PathMutationService method based on op.
    let mutationResult;
    const sourceId = card.instanceId;

    switch (effect.op) {
      case 'build':
        mutationResult = this.pathMutationService.build(
          row, col, buildDuration, sourceId, currentTurn, scene,
        );
        break;
      case 'block':
        // PathMutationService.block requires a numeric duration. When anchored,
        // pass a very large sentinel (won't expire during any realistic encounter
        // since turns-per-encounter ≤ ~200 and blockDuration=null converts to
        // Number.MAX_SAFE_INTEGER, which effectively means permanent).
        mutationResult = this.pathMutationService.block(
          row, col,
          blockDuration === null ? Number.MAX_SAFE_INTEGER : blockDuration,
          sourceId, currentTurn, scene,
        );
        break;
      case 'destroy':
        mutationResult = this.pathMutationService.destroy(
          row, col, sourceId, currentTurn, scene,
        );
        break;
      case 'bridgehead':
        mutationResult = this.pathMutationService.bridgehead(
          row, col,
          bridgeheadDuration === null ? Number.MAX_SAFE_INTEGER : bridgeheadDuration,
          sourceId, currentTurn, scene,
        );
        break;
      default: {
        // Exhaustive check — TypeScript should never reach here.
        const _exhaustive: never = effect.op;
        void _exhaustive;
        this.clearTileTargetState();
        this.callbacks?.onExitTileTargetMode?.();
        return { ok: false, reason: 'unknown-op' };
      }
    }

    // On board rejection: keep pending state so the player can try another tile.
    if (!mutationResult.ok) {
      return { ok: false, reason: mutationResult.reason };
    }

    // Apply damage-on-hit rider if the card has one (COLLAPSE).
    // Runs AFTER the mutation succeeds so a rejected mutation can't cause
    // partial effects (damage without board change). Damage is deterministic
    // (pct of max HP) so no RNG is involved.
    if (effect.damageOnHit) {
      const pct = effect.damageOnHit.pctMaxHp;
      const enemies = this.enemyService.getEnemies();
      enemies.forEach(enemy => {
        if (
          enemy.gridPosition.row === row &&
          enemy.gridPosition.col === col &&
          !enemy.dying
        ) {
          const damage = Math.floor(enemy.maxHealth * pct);
          if (damage > 0) {
            this.enemyService.damageEnemy(enemy.id, damage);
          }
        }
      });
    }

    // Mutation succeeded — consume the card (deducts energy, moves to discard).
    // Energy was confirmed sufficient above, so playCard should not fail here.
    this.deckService.playCard(card.instanceId);
    this.maybeRefundTerraformForUpgradedSeal(def);
    // LAY_TILE upgraded — draw-on-success rider (turns it into a cycle-card).
    // Applies to any terraform_target card that opts in via effect.drawOnSuccess.
    if (effect.drawOnSuccess && effect.drawOnSuccess > 0) {
      this.deckService.drawCards(effect.drawOnSuccess);
    }
    this.clearTileTargetState();
    this.callbacks?.onExitTileTargetMode?.();
    return { ok: true };
  }

  /**
   * Upgraded CARTOGRAPHER_SEAL refund hook. Called on every terraform card's
   * successful play (both terraform_target and elevation_target paths). Gates
   * on def.terraform (so non-terraform modifiers don't trigger) and delegates
   * to CardEffectService.tryConsumeTerraformRefund for the once-per-turn
   * check. Refunds are capped by deckService.addEnergy's max-clamp.
   */
  private maybeRefundTerraformForUpgradedSeal(def: CardDefinition): void {
    if (!def.terraform) return;
    if (!this.cardEffectService.tryConsumeTerraformRefund()) return;
    this.deckService.addEnergy(CARTOGRAPHER_SEAL_REFUND_AMOUNT);
  }

  /**
   * Cancel tile-target mode without consuming energy or playing the card.
   *
   * WHY THIS EXISTS: Called on Escape, pause-open, and encounter teardown to
   * ensure no dangling pending-card state survives a mode transition. The card
   * returns to hand implicitly — it was never consumed.
   */
  cancelTileTarget(): void {
    this.clearTileTargetState();
    this.callbacks?.onExitTileTargetMode?.();
  }

  /** Reset pending state — call between encounters (root-scoped services survive route transitions). */
  reset(): void {
    this.pendingTowerCard = null;
    this.clearTileTargetState();
  }

  /** Null out callback references to prevent stale component references after destroy. */
  cleanup(): void {
    this.callbacks = null;
    this.pendingTowerCard = null;
    this.clearTileTargetState();
  }

  /**
   * Internal: null out tile-target pending state.
   * Extracted so callers that don't want to fire the callback can clear state
   * directly (e.g., clearTileTargetState before firing the callback manually).
   */
  private clearTileTargetState(): void {
    this.pendingTileTargetCard = null;
    this.pendingTileTargetEffect = null;
    this.pendingElevationTargetCard = null;
    this.pendingElevationTargetEffect = null;
  }

  /**
   * Internal: resolve a pending elevation-target card at (row, col).
   *
   * Called from resolveTileTarget when an elevation-target card is pending.
   * Routes to ElevationService.raise or ElevationService.depress based on op.
   * Mirrors the terraform resolution contract:
   * - Energy re-checked immediately before applying.
   * - On board rejection: pending state NOT cleared (player can try another tile).
   * - On success: energy deducted (via playCard), card discarded, state cleared.
   *
   * elevation-model.md §5 apply flow is the authoritative spec.
   */
  private resolveElevationTarget(row: number, col: number, currentTurn: number): TileTargetResult {
    const card = this.pendingElevationTargetCard!;
    const effect = this.pendingElevationTargetEffect!;
    const def = getCardDefinition(card.cardId);

    // Re-check energy — another card play may have spent it since the card click.
    if (this.deckService.getEnergy().current < getEffectiveEnergyCost(card)) {
      this.clearTileTargetState();
      this.callbacks?.onExitTileTargetMode?.();
      return { ok: false, reason: 'insufficient-energy' };
    }

    const sourceId = card.instanceId;

    // ── COLLAPSE op (AVALANCHE_ORDER, sprint 32) ──────────────────────────
    // Rejection: target must have elevation ≥ 1. Validated before collapse call
    // so no partial state occurs on a no-op target.
    // Damage BEFORE collapse: enemies on the tile take (priorElevation × damagePerElevation)
    // while the tile is still at its raised height. This prevents the "exposed"
    // multiplier in EnemyService.damageEnemy from double-firing — the tile is at
    // positive elevation during damage, so the negative-elevation "exposed" check is
    // false. After damage, the tile collapses to 0.
    if (effect.op === 'collapse') {
      const priorElevation = this.elevationService.getElevation(row, col);
      if (priorElevation < 1) {
        // Tile not elevated enough — reject without clearing pending state.
        return { ok: false, reason: 'not-elevated' };
      }

      // Apply damage-on-hit BEFORE collapse (order matters for exposed-multiplier timing).
      if (effect.damageOnHit) {
        const dmgPerElev = effect.damageOnHit.damagePerElevation;
        const totalDamage = priorElevation * dmgPerElev;
        if (totalDamage > 0) {
          const enemies = this.enemyService.getEnemies();
          enemies.forEach(enemy => {
            if (
              enemy.gridPosition.row === row &&
              enemy.gridPosition.col === col &&
              !enemy.dying
            ) {
              this.enemyService.damageEnemy(enemy.id, totalDamage);
            }
          });
        }
      }

      // Now collapse the tile (sets elevation to 0, translates meshes).
      const collapseResult = this.elevationService.collapse(row, col, sourceId, currentTurn);
      if (!collapseResult.ok) {
        return { ok: false, reason: collapseResult.reason };
      }

      this.deckService.playCard(card.instanceId);
      this.maybeRefundTerraformForUpgradedSeal(def);
      this.clearTileTargetState();
      this.callbacks?.onExitTileTargetMode?.();
      return { ok: true };
    }

    // ── RAISE / DEPRESS ops ──────────────────────────────────────────────
    // Sprint 30 CLIFFSIDE: when `effect.line` is present, expand the target tile
    // into a line. The center tile is mandatory — its failure rejects the card.
    // Wing tiles are silently skipped on spawner/exit/out-of-bounds/already-changed.
    if (effect.line && effect.op === 'raise') {
      return this.resolveElevationLine(row, col, effect, sourceId, currentTurn, card);
    }

    let elevationResult;

    if (effect.op === 'raise') {
      elevationResult = this.elevationService.raise(
        row, col, effect.amount, effect.duration, sourceId, currentTurn,
      );
    } else if (effect.op === 'depress') {
      elevationResult = this.elevationService.depress(
        row, col, effect.amount, effect.duration, sourceId, currentTurn,
      );
    } else {
      // Exhaustive guard — any unrecognised op is an unknown-op rejection.
      this.clearTileTargetState();
      this.callbacks?.onExitTileTargetMode?.();
      return { ok: false, reason: 'unknown-op' };
    }

    // On board rejection: keep pending state so the player can try a valid tile.
    if (!elevationResult.ok) {
      return { ok: false, reason: elevationResult.reason };
    }

    // DEPRESS_TILE upgrade: after the center succeeds, try to depress one
    // 4-dir adjacent tile via the seeded run RNG. Best-effort — spawner/exit,
    // out-of-bounds, and already-changed-this-turn neighbors are silently
    // skipped. If every neighbor is ineligible, the center still succeeds and
    // no spread occurs (mirrors CLIFFSIDE wing semantics).
    if (effect.op === 'depress' && effect.spreadToAdjacent) {
      this.spreadDepressToRandomAdjacent(row, col, effect, sourceId, currentTurn);
    }

    // Success — consume the card.
    this.deckService.playCard(card.instanceId);
    this.maybeRefundTerraformForUpgradedSeal(def);
    this.clearTileTargetState();
    this.callbacks?.onExitTileTargetMode?.();
    return { ok: true };
  }

  /**
   * DEPRESS_TILE upgrade — picks one 4-dir adjacent tile via seeded RNG and
   * applies the same depress amount / duration / exposeEnemies. Failures are
   * silently skipped; the center tile has already succeeded by the time this
   * runs. Candidate shuffling is seeded so save/restore and run-seed sharing
   * produce identical spread targets across replays.
   */
  private spreadDepressToRandomAdjacent(
    centerRow: number,
    centerCol: number,
    effect: ElevationTargetCardEffect,
    sourceId: string,
    currentTurn: number,
  ): void {
    const candidates: Array<{ row: number; col: number }> = [
      { row: centerRow - 1, col: centerCol },
      { row: centerRow + 1, col: centerCol },
      { row: centerRow, col: centerCol - 1 },
      { row: centerRow, col: centerCol + 1 },
    ];

    // Seeded Fisher-Yates — pull one candidate at a time, call depress(), stop
    // on the first success. Skipped candidates don't consume the spread slot.
    const remaining = candidates.slice();
    while (remaining.length > 0) {
      const idx = Math.floor(this.runService.nextRandom() * remaining.length);
      const pick = remaining.splice(idx, 1)[0];
      const result = this.elevationService.depress(
        pick.row, pick.col, effect.amount, effect.duration, sourceId, currentTurn,
      );
      if (result.ok) return;
    }
  }

  /**
   * Sprint 30 CLIFFSIDE — resolve a horizontal/vertical line expansion.
   *
   * The center tile at (row, col) is mandatory: if it fails, the card rejects
   * entirely with no energy cost and no elevation change. Wing tiles (east+west
   * neighbors for horizontal; north+south for vertical) are silently skipped if
   * they hit SPAWNER, EXIT, out-of-bounds, or already-changed-this-turn.
   *
   * WHY PARTIAL SUCCESS: it models the cliff edge naturally — you can raise a
   * tile at the edge of the board and the cliff "falls off the map" on one side.
   * The center must succeed to commit energy; wings are best-effort.
   */
  private resolveElevationLine(
    centerRow: number,
    centerCol: number,
    effect: ElevationTargetCardEffect,
    sourceId: string,
    currentTurn: number,
    card: CardInstance,
  ): TileTargetResult {
    const line = effect.line!;
    const halfWings = Math.floor((line.length - 1) / 2);

    // ── Center tile (mandatory) ───────────────────────────────────────────
    const centerResult = this.elevationService.raise(
      centerRow, centerCol, effect.amount, effect.duration, sourceId, currentTurn,
    );
    if (!centerResult.ok) {
      // Center rejected — card is a no-op, pending state preserved for retry.
      return { ok: false, reason: centerResult.reason };
    }

    // ── Wing tiles (best-effort, skipped on any failure) ─────────────────
    for (let offset = 1; offset <= halfWings; offset++) {
      // Both directions (e.g., east+west for horizontal).
      const posRow = line.direction === 'vertical' ? centerRow + offset : centerRow;
      const posCol = line.direction === 'horizontal' ? centerCol + offset : centerCol;
      const negRow = line.direction === 'vertical' ? centerRow - offset : centerRow;
      const negCol = line.direction === 'horizontal' ? centerCol - offset : centerCol;

      // Wing failures are silently skipped (spawner, exit, OOB, already-changed).
      const posResult = this.elevationService.raise(
        posRow, posCol, effect.amount, effect.duration, sourceId, currentTurn,
      );
      if (!posResult.ok) {
        // Wing skipped — log at debug level for QA visibility, not an error.
        console.debug(
          `CLIFFSIDE: skipped wing (${posRow},${posCol}): ${posResult.reason}`,
        );
      }

      const negResult = this.elevationService.raise(
        negRow, negCol, effect.amount, effect.duration, sourceId, currentTurn,
      );
      if (!negResult.ok) {
        console.debug(
          `CLIFFSIDE: skipped wing (${negRow},${negCol}): ${negResult.reason}`,
        );
      }
    }

    // Center succeeded — consume the card.
    this.deckService.playCard(card.instanceId);
    this.maybeRefundTerraformForUpgradedSeal(getCardDefinition(card.cardId));
    this.clearTileTargetState();
    this.callbacks?.onExitTileTargetMode?.();
    return { ok: true };
  }

  /**
   * Fortify spell — upgrade up to `count` random towers one level for free.
   * Each pick removes that tower from the pool so we never double-pick the same
   * tower. Tolerates `count > eligibleTowers.length` (partial fulfilment).
   * Only L1→L2 upgrades are applied; L2→L3 requires specialization choice
   * which cannot be automated, so those towers are excluded.
   */
  private fortifyRandomTower(count = 1): void {
    if (count < 1) return;
    const towers = Array.from(this.towerCombatService.getPlacedTowers().values());
    // Exclude max-level towers and L2 towers (L2→L3 requires specialization).
    const upgradable = towers.filter(t => t.level < MAX_TOWER_LEVEL - 1);
    if (upgradable.length === 0) return;

    const remaining = upgradable.slice();
    const upgradesToApply = Math.min(count, remaining.length);

    for (let i = 0; i < upgradesToApply; i++) {
      // Phase 1 closer (Finding 3) — use the seeded run RNG so save/restore
      // and run-seed sharing produce identical FORTIFY targets across replays.
      const idx = Math.floor(this.runService.nextRandom() * remaining.length);
      const target = remaining.splice(idx, 1)[0];
      const key = `${target.row}-${target.col}`;

      // Bypass gold cost — free upgrade. actualCost=0 keeps totalInvested clean.
      const upgraded = this.towerCombatService.upgradeTower(key, 0);
      if (!upgraded) continue;

      this.audioService.playTowerUpgrade();

      const towerMesh = this.meshRegistry.towerMeshes.get(key);
      if (towerMesh) {
        this.towerUpgradeVisualService.applyUpgradeVisuals(towerMesh, target.level + 1, undefined);
        // Refresh emissive baselines after the upgrade changes material intensity.
        TowerMeshFactoryService.snapshotEmissiveBaselines(towerMesh);
      }

      // Invalidate muzzle flash saved emissive — upgrade changed the baseline.
      target.originalEmissiveIntensity = undefined;
      target.muzzleFlashTimer = undefined;
      target.emissiveBaselines = undefined; // will be re-read from mesh userData on next fire

      // Invalidate aim cache — range may have grown after the free upgrade
      // (Sprint 38: tower-mutation card hook).
      this.targetPreviewService?.invalidate(key);
    }

    this.callbacks?.onRefreshUI();
  }

  /**
   * Salvage spell — sell the most recently placed tower for a 100% refund.
   * If no towers are placed, this is a no-op.
   */
  salvageLastTower(): void {
    const towers = Array.from(this.towerCombatService.getPlacedTowers().values());
    if (towers.length === 0) return;

    // Most recently placed tower is last in insertion order (Map preserves order)
    const last = towers[towers.length - 1];
    const key = `${last.row}-${last.col}`;

    // Unregister from combat first (confirm-before-refund pattern)
    const soldTower = this.towerCombatService.unregisterTower(key);
    if (!soldTower) return;

    // 100% refund — salvage overrides the normal sell rate
    this.gameStateService.addGold(soldTower.totalInvested);
    this.gameBoardService.removeTower(soldTower.row, soldTower.col);

    this.audioService.playTowerSell();
    this.gameStatsService.recordTowerSold();

    // Dispose and remove mesh
    const towerMesh = this.meshRegistry.towerMeshes.get(key);
    if (towerMesh) {
      disposeGroup(towerMesh, this.sceneService.getScene(),
        buildDisposeProtect(this.geometryRegistry, this.materialRegistry));
      this.meshRegistry.towerMeshes.delete(key);
      this.meshRegistry.rebuildTowerChildrenArray();
    }

    // Repath ground enemies — freed tile may open shorter paths
    this.enemyService.repathAffectedEnemies(-1, -1);

    this.callbacks?.onSalvageComplete(key);
    this.callbacks?.onRefreshUI();
  }

  private executeUtilityCard(effect: UtilityCardEffect): void {
    switch (effect.utilityId) {
      case 'draw':
        for (let i = 0; i < effect.value; i++) {
          this.deckService.drawOne();
        }
        break;
      case 'energy':
        this.deckService.addEnergy(effect.value);
        break;
      case 'recycle': {
        const handSize = this.deckService.getDeckState().hand.length;
        this.deckService.discardHand();
        for (let i = 0; i < handSize + effect.value; i++) {
          this.deckService.drawOne();
        }
        break;
      }
      case 'bridge_towers':
        this.applyConduitBridge(effect.value);
        break;
      default:
        break;
    }
  }

  /**
   * CONDUIT_BRIDGE — selects a random non-adjacent tower pair (Manhattan > 1)
   * via seeded RNG and registers a virtual adjacency edge.
   *
   * Edge expiry uses `currentTurn + duration + 1`: the +1 compensates for
   * TowerGraphService.tickTurn running at the TOP of resolveTurn, so the
   * edge is alive during turns M+1..M+N (N turns total, M = play turn).
   *
   * No-op when fewer than 2 towers exist, no non-adjacent pair exists, or
   * the graph service is absent. Energy was already consumed by the caller.
   */
  private applyConduitBridge(duration: number): void {
    if (!this.towerGraphService) return;
    const towers = Array.from(this.towerCombatService.getPlacedTowers().values());
    if (towers.length < 2) return;

    // Enumerate all non-adjacent tower pairs (Manhattan distance > 1).
    // Adjacent pairs are already spatial edges; bridging them adds no value.
    const pairs: Array<{ aRow: number; aCol: number; bRow: number; bCol: number }> = [];
    for (let i = 0; i < towers.length; i++) {
      for (let j = i + 1; j < towers.length; j++) {
        const t1 = towers[i];
        const t2 = towers[j];
        const manhattan = Math.abs(t1.row - t2.row) + Math.abs(t1.col - t2.col);
        if (manhattan > 1) {
          pairs.push({ aRow: t1.row, aCol: t1.col, bRow: t2.row, bCol: t2.col });
        }
      }
    }
    if (pairs.length === 0) return;

    const pickIdx = Math.floor(this.runService.nextRandom() * pairs.length);
    const picked = pairs[pickIdx];
    const currentTurn = this.combatLoopService.getTurnNumber();
    // See function docstring for the +1 rationale.
    const expiresOnTurn = currentTurn + duration + 1;
    this.towerGraphService.addVirtualEdge(
      picked.aRow, picked.aCol, picked.bRow, picked.bCol,
      expiresOnTurn, `conduit_bridge_turn_${currentTurn}`,
    );
  }
}
