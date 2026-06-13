import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { AscensionEffectType, getAscensionEffects } from '../../../run/models/ascension.model';
import { ENCOUNTER_CONFIG } from '../../../run/constants/run.constants';
import { ModifierEffects } from '../models/game-modifier.model';

/**
 * Translates run ascension effects into ModifierEffects and injects them
 * into GameStateService so EnemyService picks them up at spawn time.
 *
 * Extracted from GameBoardComponent.applyAscensionModifiers().
 *
 * @Injectable() (not providedIn: 'root') — component-scoped.
 */
@Injectable()
export class AscensionModifierService {
  constructor(private gameStateService: GameStateService) {}

  /**
   * Apply ascension modifiers for the current encounter.
   * Must be called during SETUP phase (wave 0) — before the first wave starts.
   *
   * ENCOUNTER_CONFIG.eliteHealthMultiplier and bossHealthMultiplier serve as BASE
   * multipliers at ALL ascension levels including A0. Ascension-level effects
   * (ELITE_HEALTH_MULTIPLIER, BOSS_HEALTH_MULTIPLIER) stack multiplicatively on top.
   */
  apply(ascensionLevel: number, isElite: boolean, isBoss: boolean): void {
    const ascEffects = ascensionLevel > 0 ? getAscensionEffects(ascensionLevel) : new Map<AscensionEffectType, number>();
    const effects: ModifierEffects = {};

    // Base encounter-type HP multipliers are always active (A0 and above).
    const encounterBaseElite = isElite ? ENCOUNTER_CONFIG.eliteHealthMultiplier : 1;
    const encounterBaseBoss  = isBoss  ? ENCOUNTER_CONFIG.bossHealthMultiplier  : 1;

    const ascBaseHealth  = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
    const ascEliteHealth = isElite ? (ascEffects.get(AscensionEffectType.ELITE_HEALTH_MULTIPLIER) ?? 1) : 1;
    const ascBossHealth  = isBoss  ? (ascEffects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER)  ?? 1) : 1;

    const finalHealthMult = ascBaseHealth * encounterBaseElite * ascEliteHealth * encounterBaseBoss * ascBossHealth;
    if (finalHealthMult !== 1) effects.enemyHealthMultiplier = finalHealthMult;

    const speedMult = ascEffects.get(AscensionEffectType.ENEMY_SPEED_MULTIPLIER);
    const costMult  = ascEffects.get(AscensionEffectType.TOWER_COST_MULTIPLIER);
    if (speedMult !== undefined) effects.enemySpeedMultiplier = speedMult;
    if (costMult  !== undefined) effects.towerCostMultiplier  = costMult;

    if (Object.keys(effects).length === 0) return;
    this.gameStateService.setAscensionModifierEffects(effects);
  }
}
