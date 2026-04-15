import { Injectable } from '@angular/core';
import { StatusEffectType, StatusEffectConfig, STATUS_EFFECT_CONFIGS } from '../constants/status-effect.constants';
import { EnemyService, DamageResult } from './enemy.service';
import { KillInfo } from './tower-combat.service';
import { RelicService } from '../../../run/services/relic.service';
import { SerializableStatusEffect } from '../models/encounter-checkpoint.model';

interface ActiveEffect {
  config: StatusEffectConfig;
  expiresAt: number;
  lastTickTime: number;
  originalSpeed?: number; // For SLOW: speed before effect applied
}

@Injectable()
export class StatusEffectService {
  /** Map<enemyId, Map<StatusEffectType, ActiveEffect>> */
  private effects = new Map<string, Map<StatusEffectType, ActiveEffect>>();
  /** Reused return value for getAllActiveEffects() to avoid per-frame Map allocation */
  private activeEffectsResult = new Map<string, StatusEffectType[]>();
  /** Per-enemy arrays reused across frames to avoid per-enemy-per-frame Array.from allocation */
  private effectArrayCache = new Map<string, StatusEffectType[]>();
  /** Total number of SLOW applications this game session (for achievement tracking). */
  private slowApplicationCount = 0;

  constructor(
    private enemyService: EnemyService,
    private relicService: RelicService,
  ) {}

  /**
   * Apply a status effect to an enemy.
   * If the effect already exists and doesn't stack, refreshes duration.
   * Returns false if enemy is immune (e.g., flying enemies immune to SLOW).
   */
  apply(enemyId: string, effectType: StatusEffectType, turnNumber: number, speedMultiplierOverride?: number): boolean {
    const enemy = this.enemyService.getEnemies().get(enemyId);
    if (!enemy || enemy.health <= 0) return false;

    // Flying enemies are immune to SLOW
    if (effectType === StatusEffectType.SLOW && enemy.isFlying) return false;

    const config = STATUS_EFFECT_CONFIGS[effectType];

    let enemyEffects = this.effects.get(enemyId);
    if (!enemyEffects) {
      enemyEffects = new Map();
      this.effects.set(enemyId, enemyEffects);
    }

    // FROST_NOVA relic grants +1 turn to SLOW duration.
    const durationBonus = effectType === StatusEffectType.SLOW ? this.relicService.getSlowDurationBonus() : 0;

    const existing = enemyEffects.get(effectType);
    if (existing) {
      // Effect already active — refresh duration (no stacking)
      existing.expiresAt = turnNumber + config.duration + durationBonus;
      return true;
    }

    // New effect
    const active: ActiveEffect = {
      config,
      expiresAt: turnNumber + config.duration + durationBonus,
      lastTickTime: turnNumber,
    };

    // SLOW: mutate enemy speed, store original
    if (effectType === StatusEffectType.SLOW) {
      const slowFactor = speedMultiplierOverride ?? config.speedMultiplier ?? 1;
      active.originalSpeed = enemy.speed;
      enemy.speed = enemy.speed * slowFactor;
      this.slowApplicationCount++;
    }

    enemyEffects.set(effectType, active);
    return true;
  }

  /**
   * Phase 4 turn-based equivalent of {@link update}.
   *
   * Called once per resolution phase from CombatLoopService.resolveTurn().
   * Treats `config.duration` as TURNS (not seconds) — BURN 5 → expires after 5
   * turns. DoT effects (BURN, POISON) apply their `damagePerTick` exactly once
   * per turn (turn-based ticks are coarse; DoT effects fire exactly once per turn).
   *
   * @param turnNumber Monotonically-increasing turn counter from CombatLoopService.
   * @returns KillInfo[] for enemies killed by DoT this turn.
   */
  tickTurn(turnNumber: number): KillInfo[] {
    const kills: KillInfo[] = [];
    const toRemoveEnemies: string[] = [];

    for (const [enemyId, enemyEffects] of this.effects) {
      const enemy = this.enemyService.getEnemies().get(enemyId);
      if (!enemy || enemy.health <= 0) {
        toRemoveEnemies.push(enemyId);
        continue;
      }

      const expiredTypes: StatusEffectType[] = [];

      for (const [effectType, active] of enemyEffects) {
        if (turnNumber >= active.expiresAt) {
          if (effectType === StatusEffectType.SLOW && active.originalSpeed !== undefined) {
            enemy.speed = active.originalSpeed;
          }
          expiredTypes.push(effectType);
          continue;
        }

        // DoT: apply damagePerTick exactly once per turn.
        const damagePerTick = active.config.damagePerTick;
        if (damagePerTick !== undefined && damagePerTick > 0) {
          const result: DamageResult = this.enemyService.damageEnemy(enemyId, damagePerTick);
          if (result.killed) {
            // Status-effect kills have no tower attribution (BURN/POISON/SLOW
            // can be applied by towers OR spells; the tick itself isn't owned
            // by any single tower). The recap surfaces these as generic DoT.
            kills.push({ id: enemyId, damage: damagePerTick, towerType: null });
            toRemoveEnemies.push(enemyId);
            break;
          }
        }
      }

      for (const type of expiredTypes) {
        enemyEffects.delete(type);
      }
      if (enemyEffects.size === 0) {
        this.effects.delete(enemyId);
      }
    }

    for (const enemyId of toRemoveEnemies) {
      this.effects.delete(enemyId);
    }

    return kills;
  }

  /**
   * Flat tile reduction to apply to an enemy's movement this turn based on
   * active SLOW status. Returns 1 if SLOW is active, 0 otherwise. EnemyService
   * subtracts this from the base tiles-per-turn, floored at 0.
   */
  getSlowTileReduction(enemyId: string): number {
    const effects = this.effects.get(enemyId);
    if (!effects) return 0;
    return effects.has(StatusEffectType.SLOW) ? 1 : 0;
  }

  // M2 S2: gameTime-based update() DELETED. Replaced by tickTurn (turn-based).
  // Spec call sites cast to (svc as any) — H2 will rewrite against tickTurn.


  /**
   * Check if an enemy has a specific effect active.
   */
  hasEffect(enemyId: string, effectType: StatusEffectType): boolean {
    const enemyEffects = this.effects.get(enemyId);
    if (!enemyEffects) return false;
    return enemyEffects.has(effectType);
  }

  /**
   * Get all active effects on an enemy.
   */
  getEffects(enemyId: string): StatusEffectType[] {
    const enemyEffects = this.effects.get(enemyId);
    if (!enemyEffects) return [];
    return Array.from(enemyEffects.keys());
  }

  /**
   * Get all active effects for all enemies, keyed by enemy ID.
   * Used to drive visual tinting in the render loop.
   */
  getAllActiveEffects(): Map<string, StatusEffectType[]> {
    this.activeEffectsResult.clear();
    for (const [enemyId, enemyEffects] of this.effects) {
      if (enemyEffects.size > 0) {
        // Reuse cached array to avoid per-enemy-per-frame Array.from allocation
        let arr = this.effectArrayCache.get(enemyId);
        if (!arr) {
          arr = [];
          this.effectArrayCache.set(enemyId, arr);
        }
        arr.length = 0;
        for (const key of enemyEffects.keys()) {
          arr.push(key);
        }
        this.activeEffectsResult.set(enemyId, arr);
      }
    }
    return this.activeEffectsResult;
  }

  /**
   * Remove a specific status effect from an enemy, leaving other effects intact.
   * Restores any mutated stats associated with the removed effect (e.g. SLOW's
   * speed mutation). If the enemy has no effects after removal, prunes the inner
   * map. No-op if the enemy has no effects or the specific effect isn't active.
   *
   * Use case: DETONATE spell card consumes BURN on each burning enemy.
   */
  removeEffect(enemyId: string, effectType: StatusEffectType): void {
    const enemyEffects = this.effects.get(enemyId);
    if (!enemyEffects) return;

    const active = enemyEffects.get(effectType);
    if (!active) return;

    // SLOW restores the original enemy speed. Other effects (BURN, POISON) are
    // passive DoT with no stat mutations to restore.
    if (effectType === StatusEffectType.SLOW && active.originalSpeed !== undefined) {
      const enemy = this.enemyService.getEnemies().get(enemyId);
      if (enemy) {
        enemy.speed = active.originalSpeed;
      }
    }

    enemyEffects.delete(effectType);
    if (enemyEffects.size === 0) {
      this.effects.delete(enemyId);
      this.effectArrayCache.delete(enemyId);
    }
  }

  /**
   * Remove all effects from an enemy (call on death/removal).
   * Restores any modified stats (speed).
   */
  removeAllEffects(enemyId: string): void {
    const enemyEffects = this.effects.get(enemyId);
    if (!enemyEffects) return;

    const enemy = this.enemyService.getEnemies().get(enemyId);
    if (enemy) {
      const slowEffect = enemyEffects.get(StatusEffectType.SLOW);
      if (slowEffect && slowEffect.originalSpeed !== undefined) {
        enemy.speed = slowEffect.originalSpeed;
      }
    }

    this.effects.delete(enemyId);
    this.effectArrayCache.delete(enemyId);
  }

  /** Returns the total number of new SLOW applications this session (refreshes do not count). */
  getSlowApplicationCount(): number {
    return this.slowApplicationCount;
  }

  /** Serialize all active status effects for checkpoint save. */
  serializeEffects(): SerializableStatusEffect[] {
    const result: SerializableStatusEffect[] = [];
    for (const [enemyId, effectMap] of this.effects) {
      for (const [effectType, effect] of effectMap) {
        result.push({
          enemyId,
          effectType,
          expiresAt: effect.expiresAt,
          lastTickTime: effect.lastTickTime,
          ...(effect.originalSpeed !== undefined && { originalSpeed: effect.originalSpeed }),
        });
      }
    }
    return result;
  }

  /**
   * Restore status effects from checkpoint. Rebuilds the nested Map structure.
   * StatusEffectConfig is looked up from STATUS_EFFECT_CONFIGS by effectType.
   */
  restoreEffects(effects: SerializableStatusEffect[]): void {
    this.effects.clear();
    for (const e of effects) {
      if (!this.effects.has(e.enemyId)) {
        this.effects.set(e.enemyId, new Map());
      }
      const config = STATUS_EFFECT_CONFIGS[e.effectType];
      this.effects.get(e.enemyId)!.set(e.effectType, {
        config,
        expiresAt: e.expiresAt,
        lastTickTime: e.lastTickTime,
        ...(e.originalSpeed !== undefined && { originalSpeed: e.originalSpeed }),
      });
    }
  }

  /**
   * Clear all tracked effects (call on game restart/cleanup).
   * Restores speeds for all slowed enemies still alive.
   */
  cleanup(): void {
    for (const [enemyId, enemyEffects] of this.effects) {
      const enemy = this.enemyService.getEnemies().get(enemyId);
      if (enemy && enemy.health > 0) {
        const slowEffect = enemyEffects.get(StatusEffectType.SLOW);
        if (slowEffect && slowEffect.originalSpeed !== undefined) {
          enemy.speed = slowEffect.originalSpeed;
        }
      }
    }
    this.effects.clear();
    this.activeEffectsResult.clear();
    this.effectArrayCache.clear();
    this.slowApplicationCount = 0;
  }
}
