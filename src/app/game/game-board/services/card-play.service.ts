import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { TowerType, MAX_TOWER_LEVEL } from '../models/tower.model';
import { GamePhase } from '../models/game-state.model';
import { GameStateService } from './game-state.service';
import { GameStatsService } from './game-stats.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
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
import {
  CardInstance,
  SpellCardEffect,
  ModifierCardEffect,
  UtilityCardEffect,
  TerraformTargetCardEffect,
  TileTargetResult,
  isTerraformTargetEffect,
} from '../../../run/models/card.model';
import { MutationOp } from './path-mutation.types';
import { getCardDefinition } from '../../../run/constants/card-definitions';
import { disposeMaterial } from '../utils/three-utils';

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
  onEnterTileTargetMode?: (card: CardInstance, op: MutationOp) => void;
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
  ) {}

  /**
   * Wire up component-level callbacks.
   * Call once from ngAfterViewInit (after renderer is ready).
   */
  init(callbacks: CardPlayCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Whether a tower card is currently in placement limbo. */
  hasPendingCard(): boolean {
    return this.pendingTowerCard !== null;
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
      if (this.deckService.getEnergy().current < def.energyCost) return;

      // Enter tile-target mode — hold the card in limbo.
      this.pendingTileTargetCard = card;
      this.pendingTileTargetEffect = effect;
      this.callbacks?.onEnterTileTargetMode?.(card, effect.op);
      return;
    }

    // Block other card plays while a tower card is awaiting placement
    if (this.pendingTowerCard) return;
    // Block other card plays while a tile-target card is awaiting a tile click
    if (this.pendingTileTargetCard) return;

    if (effect.type === 'tower') {
      // Cancel any existing pending tower card first (defensive)
      this.cancelPendingTowerCard();

      // Check energy affordability without consuming
      if (this.deckService.getEnergy().current < def.energyCost) return;

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
    const energyCost = def.energyCost;
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
    if (!this.pendingTileTargetCard || !this.pendingTileTargetEffect) {
      return { ok: false, reason: 'no-pending-card' };
    }

    const card = this.pendingTileTargetCard;
    const effect = this.pendingTileTargetEffect;
    const def = getCardDefinition(card.cardId);

    // Re-check energy immediately before mutation — a prior card play this
    // turn may have reduced available energy since the card was clicked.
    if (this.deckService.getEnergy().current < def.energyCost) {
      this.clearTileTargetState();
      this.callbacks?.onExitTileTargetMode?.();
      return { ok: false, reason: 'insufficient-energy' };
    }

    // Route to the correct PathMutationService method based on op.
    let mutationResult;
    const sourceId = card.instanceId;

    switch (effect.op) {
      case 'build':
        mutationResult = this.pathMutationService.build(
          row, col, effect.duration, sourceId, currentTurn, scene,
        );
        break;
      case 'block':
        mutationResult = this.pathMutationService.block(
          row, col, effect.duration ?? 2, sourceId, currentTurn, scene,
        );
        break;
      case 'destroy':
        mutationResult = this.pathMutationService.destroy(
          row, col, sourceId, currentTurn, scene,
        );
        break;
      case 'bridgehead':
        mutationResult = this.pathMutationService.bridgehead(
          row, col, effect.duration ?? 3, sourceId, currentTurn, scene,
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

    // Mutation succeeded — consume the card (deducts energy, moves to discard).
    // Energy was confirmed sufficient above, so playCard should not fail here.
    this.deckService.playCard(card.instanceId);
    this.clearTileTargetState();
    this.callbacks?.onExitTileTargetMode?.();
    return { ok: true };
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
  }

  /**
   * Fortify spell — upgrade up to `count` random towers one level for free.
   * Each pick removes that tower from the pool so we never double-pick the same
   * tower. Tolerates `count > eligibleTowers.length` (partial fulfilment).
   * Only L1→L2 upgrades are applied; L2→L3 requires specialization choice
   * which cannot be automated, so those towers are excluded.
   */
  private fortifyRandomTower(count: number = 1): void {
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
      }

      // Invalidate muzzle flash saved emissive — upgrade changed the baseline.
      target.originalEmissiveIntensity = undefined;
      target.muzzleFlashTimer = undefined;
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
      this.sceneService.getScene().remove(towerMesh);
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
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
      default:
        break;
    }
  }
}
