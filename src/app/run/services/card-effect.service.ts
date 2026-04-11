/**
 * CardEffectService — centralized execution of spell and modifier card effects.
 *
 * Root-scoped so active modifiers persist across route transitions
 * between the run hub and combat encounters.
 *
 * Design:
 *  - Spell cards are applied immediately (gold, lives, damage, slow).
 *  - Modifier cards register a stat bonus with a wave-countdown duration.
 *  - TowerCombatService reads modifier values each combat frame.
 *  - tickWave() is called on wave completion to expire modifiers.
 */

import { Injectable } from '@angular/core';
import { ModifierCardEffect, SpellCardEffect } from '../models/card.model';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';

/** A single active modifier with a wave-based countdown. */
export interface ActiveModifier {
  readonly stat: string;
  readonly value: number;
  remainingWaves: number;
}

@Injectable({ providedIn: 'root' })
export class CardEffectService {

  /** All currently active modifier card effects. */
  private activeModifiers: ActiveModifier[] = [];

  // ── Spell Effects ────────────────────────────────────────

  /**
   * Apply a spell card's effect immediately.
   *
   * Note: 'salvage' and 'fortify' require tower selection context — those are
   * still handled in GameBoardComponent and skip through here as no-ops.
   */
  applySpell(
    effect: SpellCardEffect,
    gameState: GameStateService,
    enemyService: EnemyService,
  ): void {
    switch (effect.spellId) {
      case 'gold_rush':
        gameState.addGold(effect.value);
        break;

      case 'repair_walls':
        gameState.addLives(effect.value);
        break;

      case 'scout_ahead':
        // Reveal next N waves — informational only; no-op until wave-preview
        // API supports it. Placeholder so the card can be played without error.
        break;

      case 'lightning_strike':
        enemyService.damageStrongestEnemy(effect.value);
        break;

      case 'frost_wave':
        // effect.value is the duration in seconds.
        enemyService.slowAllEnemies(effect.value);
        break;

      case 'overclock':
        // Treat overclock as a 1-wave fire-rate modifier.
        this.addModifier('fire_rate', effect.value, 1);
        break;

      // 'salvage' and 'fortify': handled in GameBoardComponent (need tower selection UI).
      default:
        break;
    }
  }

  // ── Modifier Effects ─────────────────────────────────────

  /**
   * Register a modifier card effect.
   * Multiple modifiers with the same stat stack additively.
   */
  applyModifier(effect: ModifierCardEffect): void {
    this.activeModifiers.push({
      stat: effect.stat,
      value: effect.value,
      remainingWaves: effect.duration,
    });
  }

  // ── Wave Tick ────────────────────────────────────────────

  /**
   * Decrement remaining-wave countdown on all active modifiers.
   * Modifiers that reach 0 are removed. Call once per wave completion.
   */
  tickWave(): void {
    this.activeModifiers = this.activeModifiers
      .map(m => ({ ...m, remainingWaves: m.remainingWaves - 1 }))
      .filter(m => m.remainingWaves > 0);
  }

  // ── Queries ───────────────────────────────────────────────

  /** Aggregate value of all active modifiers for `stat`. */
  getModifierValue(stat: string): number {
    return this.activeModifiers
      .filter(m => m.stat === stat)
      .reduce((sum, m) => sum + m.value, 0);
  }

  /** True if at least one modifier for `stat` is currently active. */
  hasActiveModifier(stat: string): boolean {
    return this.activeModifiers.some(m => m.stat === stat);
  }

  /** All active modifiers (read-only snapshot for UI display). */
  getActiveModifiers(): ReadonlyArray<ActiveModifier> {
    return this.activeModifiers;
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /** Clear all modifiers (run end or encounter reset). */
  reset(): void {
    this.activeModifiers = [];
  }

  // ── Internal helpers ──────────────────────────────────────

  private addModifier(stat: string, value: number, remainingWaves: number): void {
    this.activeModifiers.push({ stat, value, remainingWaves });
  }
}
