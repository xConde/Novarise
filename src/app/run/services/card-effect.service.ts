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
import { Enemy } from '../../game/game-board/models/enemy.model';
import { StatusEffectService } from '../../game/game-board/services/status-effect.service';
import { StatusEffectType } from '../../game/game-board/constants/status-effect.constants';
import { DeckService } from './deck.service';
import { WavePreviewService } from '../../game/game-board/services/wave-preview.service';

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
  deckService: DeckService;
  wavePreviewService: WavePreviewService;
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
        // Reveal next N waves — grants temporary preview depth to the HUD.
        // Stacks with permanent SCOUTING_LENS relic bonus; both consumed by
        // WavePreviewService.getFutureWavesSummary at render time.
        ctx.wavePreviewService.addOneShotBonus(effect.value);
        break;

      case 'lightning_strike':
        ctx.enemyService.damageStrongestEnemy(effect.value);
        break;

      case 'frost_wave':
        // Apply SLOW to every non-flying, non-dying enemy. effect.value is the
        // duration in turns (Phase 1 Sprint 5: previously ignored). FROST_NOVA
        // relic still adds +1 to whatever duration we pass — bonus stacks on
        // top of the override inside StatusEffectService.apply.
        this.applyStatusToAllEnemies(ctx, StatusEffectType.SLOW, effect.value);
        break;

      case 'incinerate':
        // Apply BURN to every non-dying enemy. Flying enemies are NOT immune to BURN
        // (flying immunity is scoped to SLOW only inside StatusEffectService.apply).
        // effect.value = duration in turns (Phase 1 Sprint 5: previously a 0/1 flag).
        this.applyStatusToAllEnemies(ctx, StatusEffectType.BURN, effect.value);
        break;

      case 'toxic_spray':
        // Apply POISON to every non-dying enemy. Same flying-not-immune caveat as INCINERATE.
        // effect.value = duration in turns (Phase 1 Sprint 5: previously a 0/1 flag).
        this.applyStatusToAllEnemies(ctx, StatusEffectType.POISON, effect.value);
        break;

      case 'cryo_pulse': {
        // Single-target SLOW on the lead enemy (highest distanceTraveled among non-dying).
        // The draw always happens — even on an empty board. Rationale: card economy should
        // never be lost to empty-board timing. Tradeoff: holding CRYO_PULSE between waves
        // to draw for free is slightly exploitable; accepted because it requires holding a
        // cost-1 card which has opportunity cost. Lead-enemy selection uses distanceTraveled
        // (Enemy.distanceTraveled — the actual field name; pathProgress does not exist).
        let lead: Enemy | null = null;
        for (const enemy of ctx.enemyService.getEnemies().values()) {
          if (enemy.dying) continue;
          if (!lead || enemy.distanceTraveled > lead.distanceTraveled) {
            lead = enemy;
          }
        }
        if (lead) {
          ctx.statusEffectService.apply(lead.id, StatusEffectType.SLOW, ctx.currentTurn);
        }
        // effect.value = draw count (1 base, 2 upgraded). Respects hand-size cap via drawCards.
        ctx.deckService.drawCards(effect.value);
        break;
      }

      case 'detonate': {
        // Deal `effect.value` damage to every enemy with BURN active, then consume
        // the BURN status. Snapshot IDs first because damageEnemy may mutate health
        // (and flag dying), though it does not remove enemies from the map during
        // this call. Two-pass is defensive and safe regardless.
        // Kill bookkeeping (gold, wave progress) is handled by the combat loop's
        // normal kill-processing path — consistent with how damageStrongestEnemy
        // (lightning_strike) works (no post-call kill bookkeeping here).
        const burningIds: string[] = [];
        for (const enemy of ctx.enemyService.getEnemies().values()) {
          if (enemy.dying) continue;
          if (ctx.statusEffectService.hasEffect(enemy.id, StatusEffectType.BURN)) {
            burningIds.push(enemy.id);
          }
        }
        for (const id of burningIds) {
          ctx.enemyService.damageEnemy(id, effect.value);
          ctx.statusEffectService.removeEffect(id, StatusEffectType.BURN);
        }
        break;
      }

      case 'epidemic': {
        // If the number of currently-poisoned non-dying enemies meets the critical
        // mass threshold (effect.value), apply POISON to all non-dying enemies.
        // Already-poisoned enemies receive a duration refresh (apply handles that
        // internally). Simpler than skipping already-poisoned: one pass, same result.
        // Upgraded lowers threshold to 1 (effect.value = epidemicUpgradedCriticalMass).
        const poisonedCount = Array.from(ctx.enemyService.getEnemies().values())
          .filter(e => !e.dying && ctx.statusEffectService.hasEffect(e.id, StatusEffectType.POISON))
          .length;

        if (poisonedCount < effect.value) break;

        for (const enemy of ctx.enemyService.getEnemies().values()) {
          if (enemy.dying) continue;
          ctx.statusEffectService.apply(enemy.id, StatusEffectType.POISON, ctx.currentTurn);
        }
        break;
      }

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

  // ── Checkpoint serialization ──────────────────────────────

  /** Serialize active modifiers for checkpoint save. */
  serializeModifiers(): ActiveModifier[] {
    return this.activeModifiers.map(m => ({ stat: m.stat, value: m.value, remainingWaves: m.remainingWaves }));
  }

  /** Restore active modifiers from a checkpoint snapshot. Replaces current modifiers directly. */
  restoreModifiers(modifiers: ActiveModifier[]): void {
    this.activeModifiers = modifiers.map(m => ({ stat: m.stat, value: m.value, remainingWaves: m.remainingWaves }));
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /** Clear all modifiers (run end or encounter reset). */
  reset(): void {
    this.activeModifiers = [];
  }

  // ── Internal helpers ──────────────────────────────────────

  /**
   * Apply a status effect to every non-dying enemy. Shared between spell cards
   * that broadcast a status across the whole board (FROST_WAVE → SLOW,
   * INCINERATE → BURN, TOXIC_SPRAY → POISON). StatusEffectService.apply
   * handles flying-immunity and refresh semantics internally.
   *
   * @param durationOverride Optional. Forwarded to StatusEffectService.apply
   *   so card upgrades can extend status duration without per-enemy bookkeeping.
   */
  private applyStatusToAllEnemies(ctx: SpellContext, statusType: StatusEffectType, durationOverride?: number): void {
    for (const enemy of ctx.enemyService.getEnemies().values()) {
      if (enemy.dying) continue;
      ctx.statusEffectService.apply(enemy.id, statusType, ctx.currentTurn, undefined, durationOverride);
    }
  }

  private addModifier(stat: ModifierStat, value: number, remainingWaves: number): void {
    this.activeModifiers.push({ stat, value, remainingWaves });
  }
}
