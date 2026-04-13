import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { AscensionEffectType, getAscensionEffects } from '../../../run/models/ascension.model';
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
   */
  apply(ascensionLevel: number, isElite: boolean, isBoss: boolean): void {
    if (ascensionLevel <= 0) return;
    const ascEffects = getAscensionEffects(ascensionLevel);
    const effects: ModifierEffects = {};
    const baseHealthMult = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
    const eliteHealthMult = isElite ? (ascEffects.get(AscensionEffectType.ELITE_HEALTH_MULTIPLIER) ?? 1) : 1;
    const bossHealthMult  = isBoss  ? (ascEffects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER) ?? 1)  : 1;
    const finalHealthMult = baseHealthMult * eliteHealthMult * bossHealthMult;
    // Only emit the multiplier if at least one health effect is active
    if (finalHealthMult !== 1) effects.enemyHealthMultiplier = finalHealthMult;
    const speedMult = ascEffects.get(AscensionEffectType.ENEMY_SPEED_MULTIPLIER);
    const costMult = ascEffects.get(AscensionEffectType.TOWER_COST_MULTIPLIER);
    if (speedMult !== undefined) effects.enemySpeedMultiplier = speedMult;
    if (costMult !== undefined) effects.towerCostMultiplier = costMult;
    this.gameStateService.setAscensionModifierEffects(effects);
  }
}
