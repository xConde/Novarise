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
import { CombatFrameResult, FrameKillEvent, KillInfo, WaveCompletionEvent, GameEndEvent } from '../models/combat-frame.model';
import { TowerType } from '../models/tower.model';
import { StatusEffectService } from './status-effect.service';
import { GameNotificationService, NotificationType } from './game-notification.service';
import { AudioService } from './audio.service';
import { ScreenShakeService } from './screen-shake.service';
import { SCREEN_SHAKE_CONFIG } from '../constants/effects.constants';
import { WAVE_CONFIG } from '../constants/combat.constants';
import { isTwinBossWave } from '@core/models/wave-definition.model';
import { PathMutationService } from './path-mutation.service';

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

  /** Aggregated per-turn Lucky Coin procs — one notification per turn, not per proc. */
  private luckyCoinProcsThisTurn = 0;
  private luckyCoinBonusGoldThisTurn = 0;

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
    private notificationService: GameNotificationService,
    private audioService: AudioService,
    private screenShakeService: ScreenShakeService,
    private pathMutationService: PathMutationService,
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
   *   3. Enemy movement (each enemy advances by tiles-per-turn)
   *   4. Tower fire (each tower fires shotsPerTurn times, damage instant)
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

    // Expire path mutations FIRST — before spawn, move, or fire — so all turn-N
    // actions observe the post-expire board state. (Design doc §4 ordering correction:
    // the original note said "same slot as status tick" which was wrong because enemy
    // movement is step 2, before status tick at step 5b.)
    this.pathMutationService.tickTurn(this.turnNumber, scene);

    const cardGoldMult = 1 + this.cardEffectService.getModifierValue(MODIFIER_STAT.GOLD_MULTIPLIER);

    // Reset per-turn accumulators
    this.frameKills.length = 0;
    this.frameFiredTypes.clear();
    let frameHitCount = 0;
    let frameDamageDealt = 0;
    const frameKillsByTower: Array<{ type: TowerType | 'dot'; level: number; count: number }> = [];
    let frameExitCount = 0;
    let frameLeaked = false;
    let defeatTriggered = false;
    let waveCompletion: WaveCompletionEvent | null = null;
    let gameEnd: GameEndEvent | null = null;
    this.luckyCoinProcsThisTurn = 0;
    this.luckyCoinBonusGoldThisTurn = 0;

    const waveAtTurnStart = this.gameStateService.getState().wave;

    // 1. Spawn this turn's scheduled enemies
    this.waveService.spawnForTurn(scene, this.turnNumber);

    // 2. Enemy movement — each enemy advances its tiles-per-turn count
    const reachedExit = this.enemyService.stepEnemiesOneTurn(
      (enemyId) => this.statusEffectService.getSlowTileReduction(enemyId),
    );

    // 2.5 — MINER dig phase. MINERs that have been alive N*3 turns destroy
    // the next eligible WALL on their path, reshaping the board mid-wave.
    // Runs AFTER movement so the MINER walks first, then digs from its new position.
    this.enemyService.tickMinerDigs(this.turnNumber, scene);

    // 3. Tower fire — picks targets and applies damage instantly
    const fireResult = this.towerCombatService.fireTurn(scene, this.turnNumber);
    for (const towerType of fireResult.fired) {
      this.frameFiredTypes.add(towerType);
    }
    frameHitCount += fireResult.hitCount;
    frameDamageDealt += fireResult.damageDealt;

    // 4. Process tower kills — gold award, stat recording, run events
    for (const killInfo of fireResult.killed) {
      this.processKill(killInfo, cardGoldMult);
      this.accumulateKillByTower(killInfo.towerType, killInfo.towerLevel, frameKillsByTower);
    }

    // 5a. Mortar zone tick — turn-ticked DoT from M3 S4 mortar zones
    const mortarResult = this.towerCombatService.tickMortarZonesForTurn(scene, this.turnNumber);
    frameDamageDealt += mortarResult.damageDealt;
    for (const killInfo of mortarResult.kills) {
      this.processKill(killInfo, cardGoldMult);
      this.accumulateKillByTower(killInfo.towerType, killInfo.towerLevel, frameKillsByTower);
    }

    // 5b. Status effect tick — DoT damage, duration expiry. DoT kills are
    // attributed to the 'dot' bucket (no tower owner) and don't count toward
    // frameDamageDealt (which reflects "offensive pressure from towers").
    const dotKills = this.statusEffectService.tickTurn(this.turnNumber);
    for (const killInfo of dotKills) {
      this.processKill(killInfo, cardGoldMult);
      this.accumulateKillByTower(killInfo.towerType, killInfo.towerLevel, frameKillsByTower);
    }

    // 6. Process leaks — enemies that reached the exit cost lives
    for (const enemyId of reachedExit) {
      if (this.relicService.shouldBlockLeak()) {
        this.notificationService.show(
          NotificationType.INFO,
          'Reinforced Walls',
          'Reinforced Walls blocked a leak',
        );
        this.enemyService.removeEnemy(enemyId, scene);
        continue;
      }
      if (this.cardEffectService.tryConsumeLeakBlock()) {
        this.enemyService.removeEnemy(enemyId, scene);
        continue;
      }
      const leakedEnemy = this.enemyService.getEnemies().get(enemyId);
      const baseLeakCost = leakedEnemy?.leakDamage ?? 1;
      const currentWaveDef = this.waveService.getCurrentWaveDefinition();
      const isTwinBoss =
        leakedEnemy?.type === EnemyType.BOSS &&
        currentWaveDef !== null &&
        isTwinBossWave(currentWaveDef);
      const leakCost = isTwinBoss
        ? Math.ceil(baseLeakCost / WAVE_CONFIG.twinBossLeakDivisor)
        : baseLeakCost;
      this.gameStateService.loseLife(leakCost);
      this.audioService.playLifeLoss();
      frameLeaked = true;
      this.leakedThisWave = true;
      this.gameStatsService.recordEnemyLeaked();
      frameExitCount++;
      this.runEventBus.emit(RunEventType.ENEMY_LEAKED, {
        enemyType: leakedEnemy?.type,
        leakCost,
      });
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

      // SURVEYOR_COMPASS: award gold for unique tiles enemies crossed this wave.
      const surveyorGold = this.relicService.consumeSurveyorGold();
      if (surveyorGold > 0) {
        this.gameStateService.addGoldAndScore(surveyorGold);
      }

      const postWavePhase = this.gameStateService.getState().phase;

      let interestEarned = 0;
      if (postWavePhase === GamePhase.INTERMISSION) {
        interestEarned = this.gameStateService.awardInterest();
      }

      waveCompletion = { reward, streakBonus, streakCount, interestEarned, resultPhase: postWavePhase };
      this.runEventBus.emit(RunEventType.WAVE_COMPLETE, { wave: waveAtTurnStart });
      // Emit per-source GOLD_EARNED for push-model relics that react to
      // non-kill income streams. Skip zero amounts so subscribers don't
      // register spurious triggers on leak-interrupted waves.
      if (reward > 0) {
        this.runEventBus.emit(RunEventType.GOLD_EARNED, { amount: reward, source: 'wave' });
      }
      if (streakBonus > 0) {
        this.runEventBus.emit(RunEventType.GOLD_EARNED, { amount: streakBonus, source: 'streak' });
      }
      if (interestEarned > 0) {
        this.runEventBus.emit(RunEventType.GOLD_EARNED, { amount: interestEarned, source: 'interest' });
      }

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

    if (this.luckyCoinProcsThisTurn > 0) {
      const procs = this.luckyCoinProcsThisTurn;
      const bonus = this.luckyCoinBonusGoldThisTurn;
      const message = procs === 1
        ? `+${bonus} bonus gold (Lucky Coin)`
        : `Lucky Coin ×${procs} (+${bonus} bonus gold)`;
      this.notificationService.show(NotificationType.INFO, 'Lucky Coin', message);
    }

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
      damageDealt: frameDamageDealt,
      killsByTower: frameKillsByTower,
    };
  }

  /**
   * Attribute a single kill to the (tower type, tower level) pair that
   * landed the killing blow, or to `{ type: 'dot', level: 0 }` for
   * status-effect ticks. Mutates `byTower` in place — upserts into the
   * array so each unique (type, level) pair gets a single entry.
   */
  private accumulateKillByTower(
    towerType: TowerType | null,
    towerLevel: number,
    byTower: Array<{ type: TowerType | 'dot'; level: number; count: number }>,
  ): void {
    const type: TowerType | 'dot' = towerType ?? 'dot';
    const level = towerType === null ? 0 : Math.max(1, towerLevel);
    const existing = byTower.find(e => e.type === type && e.level === level);
    if (existing) {
      existing.count++;
    } else {
      byTower.push({ type, level, count: 1 });
    }
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
    const luckyCoinMult = this.relicService.rollLuckyCoin();
    const goldMult = this.relicService.getGoldMultiplier(isElite) * luckyCoinMult;
    const adjustedGold = Math.round(enemy.value * goldMult * cardGoldMult);
    this.gameStateService.addGoldAndScore(adjustedGold);
    this.gameStatsService.recordGoldEarned(adjustedGold);

    if (luckyCoinMult > 1) {
      this.luckyCoinProcsThisTurn++;
      this.luckyCoinBonusGoldThisTurn += Math.round(adjustedGold - adjustedGold / luckyCoinMult);
    }

    if (enemy.type === EnemyType.BOSS) {
      // Boss-kill shake: fires on the kill event since CombatLoopService has no
      // per-hit granularity (damage is applied instantaneously per turn).
      this.screenShakeService.trigger(
        SCREEN_SHAKE_CONFIG.bossHitIntensity,
        SCREEN_SHAKE_CONFIG.bossHitDuration,
      );
    }

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
