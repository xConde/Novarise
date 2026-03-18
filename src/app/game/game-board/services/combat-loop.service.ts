import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameEndService } from './game-end.service';

import { GamePhase } from '../models/game-state.model';
import { ENEMY_STATS } from '../models/enemy.model';
import { ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { PHYSICS_CONFIG } from '../constants/physics.constants';
import { ScoreBreakdown } from '../models/score.model';
import { CombatFrameResult, FrameKillEvent, WaveCompletionEvent, GameEndEvent } from '../models/combat-frame.model';
import { TowerType } from '../models/tower.model';

/**
 * Owns the fixed-timestep physics loop for the COMBAT phase.
 *
 * Responsibilities:
 * - Physics accumulator management
 * - Elapsed time tracking + periodic flush to GameStateService
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
  private physicsAccumulator = 0;
  private elapsedTimeAccumulator = 0;
  /** Whether any enemy has leaked during the current wave (for streak bonus calculation). */
  private leakedThisWave = false;

  /** Reused per-frame kill accumulator — cleared at the start of each tick(). */
  private frameKills: FrameKillEvent[] = [];
  /** Reused per-frame fired-tower-type set — cleared at the start of each tick(). */
  private frameFiredTypes = new Set<TowerType>();

  constructor(
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private towerCombatService: TowerCombatService,
    private enemyService: EnemyService,
    private gameStatsService: GameStatsService,
    private gameEndService: GameEndService,
  ) {}

  /**
   * Run all physics steps for this animation frame.
   *
   * Must be called only when phase === COMBAT and !isPaused.
   * The component is responsible for the phase/pause guard.
   *
   * @param deltaTime   Capped frame delta in real seconds.
   * @param gameSpeed   Current speed multiplier (1/2/3).
   * @param scene       The active Three.js scene (needed by WaveService / EnemyService).
   * @param scoreBreakdown Current score breakdown (passed to GameEndService on game end).
   * @returns           Accumulated frame events for the component to consume.
   *
   * The returned `kills` array and `firedTypes` set are **defensive copies** of
   * the internal reused collections. They are safe to hold across frames — the
   * internal arrays are cleared at the start of the NEXT tick() but the copies
   * are independent snapshots.
   */
  tick(
    deltaTime: number,
    gameSpeed: number,
    scene: THREE.Scene,
    scoreBreakdown: ScoreBreakdown | null,
  ): CombatFrameResult {
    this.physicsAccumulator += deltaTime * gameSpeed;
    let stepCount = 0;

    // Elapsed time tracking — accumulate real (unscaled) time, flush every ~1 second
    this.elapsedTimeAccumulator += deltaTime;
    if (this.elapsedTimeAccumulator >= PHYSICS_CONFIG.elapsedTimeFlushIntervalS) {
      this.gameStateService.addElapsedTime(this.elapsedTimeAccumulator);
      this.elapsedTimeAccumulator = 0;
    }

    // Reset per-frame accumulators
    this.frameKills.length = 0;
    this.frameFiredTypes.clear();
    let frameHitCount = 0;
    let frameExitCount = 0;
    let frameLeaked = false;
    let defeatTriggered = false;
    let waveCompletion: WaveCompletionEvent | null = null;
    let gameEnd: GameEndEvent | null = null;

    // We need the wave number at the start of the frame (captured once; safe because
    // startWave() cannot be called during COMBAT)
    const waveAtFrameStart = this.gameStateService.getState().wave;

    while (
      this.physicsAccumulator >= PHYSICS_CONFIG.fixedTimestep &&
      stepCount < PHYSICS_CONFIG.maxStepsPerFrame
    ) {
      // Wave spawning
      this.waveService.update(PHYSICS_CONFIG.fixedTimestep, scene);

      // Tower combat — returns killed enemies, tower types that fired, and hit count
      const { killed: killedByTowers, fired: firedTowerTypes, hitCount } =
        this.towerCombatService.update(PHYSICS_CONFIG.fixedTimestep, scene);

      // Accumulate fired tower types and hit counts for audio (deferred to post-frame)
      for (const towerType of firedTowerTypes) {
        this.frameFiredTypes.add(towerType);
      }
      frameHitCount += hitCount;

      // Collect gold from tower kills and snapshot visual data before removal
      for (const killInfo of killedByTowers) {
        const enemy = this.enemyService.getEnemies().get(killInfo.id);
        if (enemy) {
          this.gameStateService.addGoldAndScore(enemy.value);
          this.gameStatsService.recordGoldEarned(enemy.value);

          this.frameKills.push({
            damage: killInfo.damage,
            position: { ...enemy.position },
            color: ENEMY_STATS[enemy.type]?.color ?? ENEMY_VISUAL_CONFIG.fallbackColor,
            value: enemy.value,
          });

          this.enemyService.removeEnemy(killInfo.id, scene);
        }
      }

      // Move enemies along paths
      const reachedExit = this.enemyService.updateEnemies(PHYSICS_CONFIG.fixedTimestep);

      // Enemies reaching the exit cost lives scaled by enemy type
      for (const enemyId of reachedExit) {
        const leakedEnemy = this.enemyService.getEnemies().get(enemyId);
        const leakCost = leakedEnemy?.leakDamage ?? 1;
        this.gameStateService.loseLife(leakCost);
        frameLeaked = true;
        this.leakedThisWave = true;
        this.gameStatsService.recordEnemyLeaked();
        frameExitCount++;
        this.enemyService.removeEnemy(enemyId, scene);
      }

      // Re-read phase — loseLife() above may have set DEFEAT mid-frame
      const currentPhase = this.gameStateService.getState().phase;

      if (currentPhase === GamePhase.DEFEAT) {
        defeatTriggered = true;
        // DEFEAT mid-frame (from loseLife) — record game end if not yet done
        if (!this.gameEndService.isRecorded()) {
          const result = this.gameEndService.recordEnd(false, scoreBreakdown);
          gameEnd = {
            isVictory: false,
            newlyUnlockedAchievements: result.newlyUnlockedAchievements,
            completedChallenges: result.completedChallenges,
          };
        }
      }

      // Check wave completion: no spawning and no enemies alive
      if (
        currentPhase === GamePhase.COMBAT &&
        !this.waveService.isSpawning() &&
        this.enemyService.getEnemies().size === 0
      ) {
        const reward = this.waveService.getWaveReward(waveAtFrameStart);
        let streakBonus = 0;
        let streakCount = 0;

        // Award streak bonus before completeWave transitions out of COMBAT
        // leakedThisWave is already true if any enemy leaked this frame (set above)
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

        // Record game end on VICTORY or DEFEAT (idempotent in GameEndService)
        if (postWavePhase === GamePhase.VICTORY || postWavePhase === GamePhase.DEFEAT) {
          if (!this.gameEndService.isRecorded()) {
            const isVictory = postWavePhase === GamePhase.VICTORY;
            const result = this.gameEndService.recordEnd(isVictory, scoreBreakdown);
            gameEnd = {
              isVictory,
              newlyUnlockedAchievements: result.newlyUnlockedAchievements,
              completedChallenges: result.completedChallenges,
            };
          }
        }
      }

      this.physicsAccumulator -= PHYSICS_CONFIG.fixedTimestep;
      stepCount++;
    }

    // Drain deferred audio events from TowerCombatService (chain lightning, mortar, etc.)
    const combatAudioEvents = this.towerCombatService.drainAudioEvents();

    return {
      kills: [...this.frameKills],              // defensive copy — internal array is cleared on next tick()
      firedTypes: new Set(this.frameFiredTypes), // defensive copy — internal set is cleared on next tick()
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
   * Flush accumulated elapsed time to GameStateService and return the flushed amount.
   * Called from the component's state subscription when entering a terminal phase,
   * so the final elapsed time is recorded before the score is calculated.
   */
  flushElapsedTime(): number {
    const amount = this.elapsedTimeAccumulator;
    if (amount > 0) {
      this.gameStateService.addElapsedTime(amount);
      this.elapsedTimeAccumulator = 0;
    }
    return amount;
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
    this.physicsAccumulator = 0;
    this.elapsedTimeAccumulator = 0;
    this.leakedThisWave = false;
    this.frameKills.length = 0;
    this.frameFiredTypes.clear();
  }
}
