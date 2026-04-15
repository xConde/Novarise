import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameEndService } from './game-end.service';
import { RelicService } from '../../../run/services/relic.service';
import { RunEventBusService, RunEventType } from '../../../run/services/run-event-bus.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { RunService } from '../../../run/services/run.service';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';

import { GamePhase } from '../models/game-state.model';
import { ENEMY_STATS, EnemyType } from '../models/enemy.model';
import { ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { ScoreBreakdown } from '../models/score.model';
import { CombatFrameResult, FrameKillEvent, KillInfo, WaveCompletionEvent, GameEndEvent } from '../models/combat-frame.model';
import { TowerType } from '../models/tower.model';
import { StatusEffectService } from './status-effect.service';

/**
 * Owns the turn-based combat resolution for the COMBAT phase.
 *
 * Responsibilities:
 * - Wave spawning delegation to WaveService
 * - Tower combat delegation to TowerCombatService
 * - Kill processing (gold award, stat recording, visual snapshot)
 * - Enemy movement + leak handling
 * - Wave completion (streak bonus, phase transition, interest)
 * - Game end recording via GameEndService
 *
 * All audio and VFX side-effects are returned via CombatFrameResult so the
 * component can dispatch them with its full service graph.
 *
 * @Injectable() (not providedIn: 'root') — provided at component scope.
 */
@Injectable()
export class CombatLoopService {
  /** Whether any enemy has leaked during the current wave (for streak bonus calculation). */
  private leakedThisWave = false;

  /** Phase 4: monotonically-increasing turn counter across the entire encounter. */
  private turnNumber = 0;

  /** Reused per-turn kill accumulator — cleared at the start of each resolveTurn(). */
  private frameKills: FrameKillEvent[] = [];
  /** Reused per-turn fired-tower-type set — cleared at the start of each resolveTurn(). */
  private frameFiredTypes = new Set<TowerType>();

  constructor(
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private towerCombatService: TowerCombatService,
    private enemyService: EnemyService,
    private gameStatsService: GameStatsService,
    private gameEndService: GameEndService,
    private relicService: RelicService,
    private runEventBus: RunEventBusService,
    private statusEffectService: StatusEffectService,
    private cardEffectService: CardEffectService,
    private runService: RunService,
  ) {}

  /** Phase 4: current turn number, exposed for UI bindings. */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /** Set turn number for checkpoint restore. */
  setTurnNumber(n: number): void {
    this.turnNumber = n;
  }

  /** Get leaked-this-wave flag for checkpoint save. */
  getLeakedThisWave(): boolean {
    return this.leakedThisWave;
  }

  /** Set leaked-this-wave flag for checkpoint restore. */
  setLeakedThisWave(v: boolean): void {
    this.leakedThisWave = v;
  }

  /**
   * Reset the per-wave leak flag.
   * Call from the component's startWave() before beginning a new wave.
   */
  resetLeakState(): void {
    this.leakedThisWave = false;
  }

  /**
   * Reset accumulators and internal state.
   * Call on game restart (in restartGame() alongside GameSessionService.resetAllServices()).
   */
  reset(): void {
    this.leakedThisWave = false;
    this.turnNumber = 0;
    this.frameKills.length = 0;
    this.frameFiredTypes.clear();
  }

  // ────────────────────────────────────────────────────────────────────────
  // Phase 4: Turn-based resolution (replaces tick() physics loop)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Phase 4: run one discrete turn of combat resolution. Replaces the
   * fixed-timestep `tick()` physics loop for turn-based combat.
   *
   * Order of operations (matches project_turn_model_spec.md):
   *   1. Increment turn counter
   *   2. Spawn this turn's scheduled enemies
   *   3. Tower fire (each tower fires shotsPerTurn times, damage instant)
   *   4. Enemy movement (each enemy advances by tiles-per-turn)
   *   5. Status effect tick (DoT damage, duration decrement)
   *   6. Process kills (gold, stats, run events)
   *   7. Process leaks (lives, defeat check)
   *   8. Wave completion check (streak, intermission/victory)
   *
   * Returns CombatFrameResult with the same shape as tick() so the component's
   * existing processCombatResult() wiring applies unchanged.
   */
  resolveTurn(scene: THREE.Scene): CombatFrameResult {
    this.turnNumber++;
    const cardGoldMult = 1 + this.cardEffectService.getModifierValue(MODIFIER_STAT.GOLD_MULTIPLIER);

    // Reset per-turn accumulators
    this.frameKills.length = 0;
    this.frameFiredTypes.clear();
    let frameHitCount = 0;
    let frameExitCount = 0;
    let frameLeaked = false;
    let defeatTriggered = false;
    let waveCompletion: WaveCompletionEvent | null = null;
    let gameEnd: GameEndEvent | null = null;

    const waveAtTurnStart = this.gameStateService.getState().wave;

    // 1. Spawn this turn's scheduled enemies
    this.waveService.spawnForTurn(scene);

    // 2. Tower fire — picks targets and applies damage instantly
    const fireResult = this.towerCombatService.fireTurn(scene, this.turnNumber);
    for (const towerType of fireResult.fired) {
      this.frameFiredTypes.add(towerType);
    }
    frameHitCount += fireResult.hitCount;

    // 3. Process tower kills — gold award, stat recording, run events
    for (const killInfo of fireResult.killed) {
      this.processKill(killInfo, cardGoldMult);
    }

    // 4. Enemy movement — each enemy advances its tiles-per-turn count
    const reachedExit = this.enemyService.stepEnemiesOneTurn(
      (enemyId) => this.statusEffectService.getSlowTileReduction(enemyId),
    );

    // 5a. Mortar zone tick — turn-ticked DoT from M3 S4 mortar zones
    const mortarKills = this.towerCombatService.tickMortarZonesForTurn(scene, this.turnNumber);
    for (const killInfo of mortarKills) {
      this.processKill(killInfo, cardGoldMult);
    }

    // 5b. Status effect tick — DoT damage, duration expiry
    const dotKills = this.statusEffectService.tickTurn(this.turnNumber);
    for (const killInfo of dotKills) {
      this.processKill(killInfo, cardGoldMult);
    }

    // 6. Process leaks — enemies that reached the exit cost lives
    for (const enemyId of reachedExit) {
      if (this.relicService.shouldBlockLeak()) {
        this.enemyService.removeEnemy(enemyId, scene);
        continue;
      }
      if (this.cardEffectService.tryConsumeLeakBlock()) {
        this.enemyService.removeEnemy(enemyId, scene);
        continue;
      }
      const leakedEnemy = this.enemyService.getEnemies().get(enemyId);
      const leakCost = leakedEnemy?.leakDamage ?? 1;
      this.gameStateService.loseLife(leakCost);
      frameLeaked = true;
      this.leakedThisWave = true;
      this.gameStatsService.recordEnemyLeaked();
      frameExitCount++;
      this.enemyService.removeEnemy(enemyId, scene);
    }

    // 7. Re-read phase — loseLife() above may have set DEFEAT
    const currentPhase = this.gameStateService.getState().phase;
    if (currentPhase === GamePhase.DEFEAT) {
      defeatTriggered = true;
      if (!this.gameEndService.isRecorded()) {
        const result = this.gameEndService.recordEnd(false, this.turnNumber);
        gameEnd = {
          isVictory: false,
          newlyUnlockedAchievements: result.newlyUnlockedAchievements,
          completedChallenges: result.completedChallenges,
        };
      }
    }

    // 8. Wave completion check
    if (
      currentPhase === GamePhase.COMBAT &&
      !this.waveService.isSpawning() &&
      this.enemyService.getLivingEnemyCount() === 0
    ) {
      const reward = this.waveService.getWaveReward(waveAtTurnStart);
      let streakBonus = 0;
      let streakCount = 0;

      if (!this.leakedThisWave) {
        streakBonus = this.gameStateService.addStreakBonus();
        streakCount = this.gameStateService.getStreak();
      }

      this.gameStateService.completeWave(reward);
      const postWavePhase = this.gameStateService.getState().phase;

      let interestEarned = 0;
      if (postWavePhase === GamePhase.INTERMISSION) {
        interestEarned = this.gameStateService.awardInterest();
      }

      waveCompletion = { reward, streakBonus, streakCount, interestEarned, resultPhase: postWavePhase };
      this.runEventBus.emit(RunEventType.WAVE_COMPLETE, { wave: waveAtTurnStart });

      if (postWavePhase === GamePhase.VICTORY || postWavePhase === GamePhase.DEFEAT) {
        if (!this.gameEndService.isRecorded()) {
          const isVictory = postWavePhase === GamePhase.VICTORY;
          const result = this.gameEndService.recordEnd(isVictory, this.turnNumber);
          gameEnd = {
            isVictory,
            newlyUnlockedAchievements: result.newlyUnlockedAchievements,
            completedChallenges: result.completedChallenges,
          };
        }
      }
    }

    const combatAudioEvents = this.towerCombatService.drainAudioEvents();

    return {
      kills: [...this.frameKills],
      firedTypes: new Set(this.frameFiredTypes),
      hitCount: frameHitCount,
      exitCount: frameExitCount,
      leaked: frameLeaked,
      defeatTriggered,
      waveCompletion,
      gameEnd,
      combatAudioEvents,
    };
  }

  /**
   * Process a single kill: gold award, stats, run event, frame visual snapshot.
   * Shared between fireTurn kills, mortar zone kills, and DoT kills.
   */
  private processKill(killInfo: KillInfo, cardGoldMult: number): void {
    const enemy = this.enemyService.getEnemies().get(killInfo.id);
    if (!enemy || enemy.dying) return;

    // BOUNTY_HUNTER: "Elite enemies drop double gold." An enemy qualifies as
    // elite if it's a BOSS-type OR it appeared in an elite/boss encounter.
    // The encounter flag catches non-BOSS enemies in elite rooms; the type
    // check ensures a BOSS in a non-elite context (e.g. endless boss waves)
    // still gets the bonus.
    const encounter = this.runService.getCurrentEncounter();
    const isElite = enemy.type === EnemyType.BOSS
      || (encounter?.isElite ?? false)
      || (encounter?.isBoss ?? false);
    const goldMult = this.relicService.getGoldMultiplier(isElite) * this.relicService.rollLuckyCoin();
    const adjustedGold = Math.round(enemy.value * goldMult * cardGoldMult);
    this.gameStateService.addGoldAndScore(adjustedGold);
    this.gameStatsService.recordGoldEarned(adjustedGold);

    this.frameKills.push({
      damage: killInfo.damage,
      position: { ...enemy.position },
      color: ENEMY_STATS[enemy.type]?.color ?? ENEMY_VISUAL_CONFIG.fallbackColor,
      value: enemy.value,
    });

    this.enemyService.startDyingAnimation(killInfo.id);
    this.runEventBus.emit(RunEventType.ENEMY_KILLED, { enemyType: enemy.type, value: enemy.value });
  }
}
