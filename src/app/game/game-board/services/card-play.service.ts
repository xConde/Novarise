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
import { WavePreviewService } from './wave-preview.service';
import { CardInstance, SpellCardEffect, ModifierCardEffect, UtilityCardEffect } from '../../../run/models/card.model';
import { getCardDefinition } from '../../../run/constants/card-definitions';
import { disposeMaterial } from '../utils/three-utils';

export interface CardPlayCallbacks {
  onEnterPlacementMode: (type: TowerType, card: CardInstance) => void;
  /** Called after fortify/salvage — triggers updateTileHighlights + updateChallengeIndicators. */
  onRefreshUI: () => void;
  /** Called after salvage — clears selected tile, refreshes path overlay, deselects tower if it matched the salvaged key. */
  onSalvageComplete: (salvageKey: string) => void;
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
    // Block other card plays while a tower card is awaiting placement
    if (this.pendingTowerCard) return;

    const def = getCardDefinition(card.cardId);
    const effect = card.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;

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

  /** Reset pending state — call between encounters (root-scoped services survive route transitions). */
  reset(): void {
    this.pendingTowerCard = null;
  }

  /** Null out callback references to prevent stale component references after destroy. */
  cleanup(): void {
    this.callbacks = null;
    this.pendingTowerCard = null;
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
      const idx = Math.floor(Math.random() * remaining.length);
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
