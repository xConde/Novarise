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
import { MODIFIER_STAT, ModifierStat } from '../constants/modifier-stat.constants';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';
import { StatusEffectService } from '../../game/game-board/services/status-effect.service';
import { StatusEffectType } from '../../game/game-board/constants/status-effect.constants';

/** A single active modifier with a wave-based countdown. */
export interface ActiveModifier {
  readonly stat: ModifierStat;
  readonly value: number;
  remainingWaves: number;
}

/** Per-encounter context bundle passed to spell handlers from the component layer. */
export interface SpellContext {
  gameState: GameStateService;
  enemyService: EnemyService;
  statusEffectService: StatusEffectService;
  currentTurn: number;
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
  applySpell(effect: SpellCardEffect, ctx: SpellContext): void {
    switch (effect.spellId) {
      case 'gold_rush':
        ctx.gameState.addGold(effect.value);
        break;

      case 'repair_walls':
        ctx.gameState.addLives(effect.value);
        break;

      case 'scout_ahead':
        // Reveal next N waves — informational only; no-op until wave-preview
        // API supports it. Placeholder so the card can be played without error.
        break;

      case 'lightning_strike':
        ctx.enemyService.damageStrongestEnemy(effect.value);
        break;

      case 'frost_wave':
        // Apply SLOW status to every non-flying, non-dying enemy. SLOW lasts
        // STATUS_EFFECT_CONFIGS[SLOW].duration turns and reduces tilesPerTurn by 1
        // (full stop for 1-tile movers, half for 2-tile movers). Flying enemies
        // are immune (handled inside StatusEffectService.apply). The effect.value
        // field is ignored — duration is fixed by status config. Ignored value is
        // a balance lever for a future content sprint.
        for (const enemy of ctx.enemyService.getEnemies().values()) {
          if (enemy.dying) continue;
          ctx.statusEffectService.apply(enemy.id, StatusEffectType.SLOW, ctx.currentTurn);
        }
        break;

      case 'overclock':
        // Treat overclock as a 1-wave fire-rate modifier.
        this.addModifier(MODIFIER_STAT.FIRE_RATE, effect.value, 1);
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
  getModifierValue(stat: ModifierStat): number {
    return this.activeModifiers
      .filter(m => m.stat === stat)
      .reduce((sum, m) => sum + m.value, 0);
  }

  /** True if at least one modifier for `stat` is currently active. */
  hasActiveModifier(stat: ModifierStat): boolean {
    return this.activeModifiers.some(m => m.stat === stat);
  }

  /** All active modifiers (read-only snapshot for UI display). */
  getActiveModifiers(): ReadonlyArray<ActiveModifier> {
    return this.activeModifiers;
  }

  /**
   * Try to consume one charge of an active leakBlock modifier.
   * Returns true if a leakBlock charge was consumed (caller should treat the leak as blocked).
   * When the modifier's value reaches 0, removes it from the active list.
   */
  tryConsumeLeakBlock(): boolean {
    const idx = this.activeModifiers.findIndex(m => m.stat === MODIFIER_STAT.LEAK_BLOCK && m.value > 0);
    if (idx === -1) return false;
    const mod = this.activeModifiers[idx];
    // ActiveModifier.value is readonly — replace the object to preserve the readonly invariant for callers.
    const newValue = mod.value - 1;
    if (newValue <= 0) {
      this.activeModifiers.splice(idx, 1);
    } else {
      this.activeModifiers[idx] = { ...mod, value: newValue };
    }
    return true;
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /** Clear all modifiers (run end or encounter reset). */
  reset(): void {
    this.activeModifiers = [];
  }

  // ── Internal helpers ──────────────────────────────────────

  private addModifier(stat: ModifierStat, value: number, remainingWaves: number): void {
    this.activeModifiers.push({ stat, value, remainingWaves });
  }
}
