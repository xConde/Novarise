import { Injectable } from '@angular/core';
import { StatusEffectType, StatusEffectConfig, STATUS_EFFECT_CONFIGS } from '../constants/status-effect.constants';
import { EnemyService, DamageResult } from './enemy.service';
import { KillInfo } from './tower-combat.service';

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

  constructor(private enemyService: EnemyService) {}

  /**
   * Apply a status effect to an enemy.
   * If the effect already exists and doesn't stack, refreshes duration.
   * Returns false if enemy is immune (e.g., flying enemies immune to SLOW).
   */
  apply(enemyId: string, effectType: StatusEffectType, gameTime: number): boolean {
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

    const existing = enemyEffects.get(effectType);
    if (existing) {
      // Effect already active — refresh duration (no stacking)
      existing.expiresAt = gameTime + config.duration;
      return true;
    }

    // New effect
    const active: ActiveEffect = {
      config,
      expiresAt: gameTime + config.duration,
      lastTickTime: gameTime,
    };

    // SLOW: mutate enemy speed, store original
    if (effectType === StatusEffectType.SLOW && config.speedMultiplier !== undefined) {
      active.originalSpeed = enemy.speed;
      enemy.speed = enemy.speed * config.speedMultiplier;
    }

    enemyEffects.set(effectType, active);
    return true;
  }

  /**
   * Update all active effects. Call once per physics step.
   * - Ticks DoT effects (BURN, POISON) dealing damage
   * - Expires effects past their duration (restores speed for SLOW)
   * Returns array of KillInfo for enemies killed by DoT.
   */
  update(gameTime: number): KillInfo[] {
    const kills: KillInfo[] = [];
    const toRemoveEnemies: string[] = [];

    for (const [enemyId, enemyEffects] of this.effects) {
      const enemy = this.enemyService.getEnemies().get(enemyId);

      // Enemy no longer exists — schedule full cleanup
      if (!enemy || enemy.health <= 0) {
        toRemoveEnemies.push(enemyId);
        continue;
      }

      const expiredTypes: StatusEffectType[] = [];

      for (const [effectType, active] of enemyEffects) {
        // Check expiry
        if (gameTime >= active.expiresAt) {
          // Restore speed for SLOW
          if (effectType === StatusEffectType.SLOW && active.originalSpeed !== undefined) {
            enemy.speed = active.originalSpeed;
          }
          expiredTypes.push(effectType);
          continue;
        }

        // Tick DoT effects
        const tickInterval = active.config.tickInterval;
        const damagePerTick = active.config.damagePerTick;
        if (tickInterval !== undefined && damagePerTick !== undefined && tickInterval > 0) {
          if (gameTime - active.lastTickTime >= tickInterval) {
            active.lastTickTime = gameTime;
            const result: DamageResult = this.enemyService.damageEnemy(enemyId, damagePerTick);
            if (result.killed) {
              kills.push({ id: enemyId, damage: damagePerTick });
              // Enemy died from DoT — clean up all effects next pass
              toRemoveEnemies.push(enemyId);
              break; // No need to process more effects for a dead enemy
            }
          }
        }
      }

      // Remove expired effects
      for (const type of expiredTypes) {
        enemyEffects.delete(type);
      }

      // Clean up empty entries
      if (enemyEffects.size === 0) {
        this.effects.delete(enemyId);
      }
    }

    // Clean up dead/removed enemies
    for (const enemyId of toRemoveEnemies) {
      this.effects.delete(enemyId);
    }

    return kills;
  }

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
  }
}
