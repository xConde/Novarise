import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { TowerCombatService } from './tower-combat.service';
import { StatusEffectService } from './status-effect.service';
import { GameStatsService } from './game-stats.service';
import { GameBoardService } from '../game-board.service';
import { AudioService } from './audio.service';

import { GamePhase, DifficultyLevel, DIFFICULTY_PRESETS, INITIAL_GAME_STATE } from '../models/game-state.model';
import { TOWER_CONFIGS, TowerType } from '../models/tower.model';
import { WAVE_DEFINITIONS } from '../models/wave.model';
import { GameBoardTile } from '../models/game-board-tile';
import { EnemyType } from '../models/enemy.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { calculateScoreBreakdown, DIFFICULTY_SCORE_MULTIPLIER } from '../models/score.model';

/**
 * Build a minimal 5x5 board with:
 *   - Spawner at (0,0)
 *   - Exit at (4,4)
 *   - All other tiles are traversable BASE
 *
 * This gives A* a clear path from spawner to exit.
 */
function buildMinimalBoard(): { board: GameBoardTile[][]; width: number; height: number } {
  const width = 5;
  const height = 5;
  const board: GameBoardTile[][] = [];

  for (let row = 0; row < height; row++) {
    board.push([]);
    for (let col = 0; col < width; col++) {
      board[row].push(GameBoardTile.createBase(row, col));
    }
  }

  // Place spawner at top-left
  board[0][0] = GameBoardTile.createSpawner(0, 0);
  // Place exit at bottom-right
  board[4][4] = GameBoardTile.createExit(4, 4);

  return { board, width, height };
}

describe('Gameplay Integration', () => {
  let gameStateService: GameStateService;
  let waveService: WaveService;
  let enemyService: EnemyService;
  let towerCombatService: TowerCombatService;
  let gameStatsService: GameStatsService;
  let gameBoardService: GameBoardService;
  let statusEffectService: StatusEffectService;
  let audioService: AudioService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GameStateService,
        WaveService,
        EnemyService,
        TowerCombatService,
        StatusEffectService,
        GameStatsService,
        GameBoardService,
        AudioService,
      ]
    });

    gameStateService = TestBed.inject(GameStateService);
    waveService = TestBed.inject(WaveService);
    enemyService = TestBed.inject(EnemyService);
    towerCombatService = TestBed.inject(TowerCombatService);
    gameStatsService = TestBed.inject(GameStatsService);
    gameBoardService = TestBed.inject(GameBoardService);
    statusEffectService = TestBed.inject(StatusEffectService);
    audioService = TestBed.inject(AudioService);

    scene = new THREE.Scene();

    // Import the minimal board so pathfinding works
    const { board, width, height } = buildMinimalBoard();
    gameBoardService.importBoard(board, width, height);
  });

  afterEach(() => {
    // Reset service state before disposing scene objects
    enemyService.reset(scene);
    towerCombatService.cleanup(scene);
    waveService.reset();

    // Dispose Three.js scene children
    scene.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    scene.clear();
  });

  // ─── 1. Tower placement → gold deduction → state update ───

  describe('tower placement → gold deduction → state update', () => {
    it('should deduct gold when placing a tower via spendGold', () => {
      // NORMAL difficulty starts with 200g
      const initialGold = gameStateService.getState().gold;
      expect(initialGold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold);

      const basicCost = TOWER_CONFIGS[TowerType.BASIC].cost;
      const success = gameStateService.spendGold(basicCost);

      expect(success).toBeTrue();
      expect(gameStateService.getState().gold).toBe(initialGold - basicCost);
    });

    it('should reflect correct remaining gold after multiple tower purchases', () => {
      const initialGold = gameStateService.getState().gold;
      const basicCost = TOWER_CONFIGS[TowerType.BASIC].cost;

      // Buy as many basic towers as affordable
      let purchased = 0;
      while (gameStateService.canAfford(basicCost)) {
        const ok = gameStateService.spendGold(basicCost);
        expect(ok).toBeTrue();
        purchased++;
      }

      expect(gameStateService.getState().gold).toBe(initialGold - purchased * basicCost);
    });

    it('should reject purchase when gold is insufficient', () => {
      const sniperCost = TOWER_CONFIGS[TowerType.SNIPER].cost;

      // Drain gold below sniper cost
      gameStateService.spendGold(gameStateService.getState().gold);
      expect(gameStateService.getState().gold).toBe(0);

      expect(gameStateService.canAfford(sniperCost)).toBeFalse();
      const result = gameStateService.spendGold(sniperCost);
      expect(result).toBeFalse();
      expect(gameStateService.getState().gold).toBe(0);
    });

    it('should track tower in combat service after registration', () => {
      const row = 2;
      const col = 2;
      const towerMesh = new THREE.Group();

      gameBoardService.placeTower(row, col, TowerType.BASIC);
      towerCombatService.registerTower(row, col, TowerType.BASIC, towerMesh);

      const tower = towerCombatService.getTower(`${row}-${col}`);
      expect(tower).toBeDefined();
      expect(tower!.type).toBe(TowerType.BASIC);
      expect(tower!.level).toBe(1);
      expect(tower!.totalInvested).toBe(TOWER_CONFIGS[TowerType.BASIC].cost);
    });
  });

  // ─── 2. Wave start → enemy spawn → wave complete ───

  describe('wave start → enemy spawn → wave complete', () => {
    it('should spawn enemies when wave is started and ticked', () => {
      gameStateService.startWave(); // wave 1, COMBAT

      waveService.startWave(1, scene);
      expect(waveService.isSpawning()).toBeTrue();

      // Tick enough times to spawn all enemies in wave 1
      // Wave 1: 5 basic enemies at 1.5s interval (first spawns immediately)
      const wave1Total = waveService.getTotalEnemiesInWave(1);
      const tickCount = wave1Total * 20; // generous ticks
      for (let i = 0; i < tickCount; i++) {
        waveService.update(0.2, scene);
      }

      expect(enemyService.getEnemies().size).toBe(wave1Total);
      expect(waveService.isSpawning()).toBeFalse();
    });

    it('should complete wave when all enemies are killed', () => {
      gameStateService.startWave(); // wave 1
      waveService.startWave(1, scene);

      // Spawn all enemies
      for (let i = 0; i < 100; i++) {
        waveService.update(0.2, scene);
      }
      expect(waveService.isSpawning()).toBeFalse();

      // Kill all enemies
      const enemies = enemyService.getEnemies();
      const enemyIds = Array.from(enemies.keys());
      enemyIds.forEach(id => {
        const enemy = enemies.get(id)!;
        enemyService.damageEnemy(id, enemy.maxHealth + 100);
        enemyService.removeEnemy(id, scene);
      });

      expect(enemyService.getEnemies().size).toBe(0);

      // Now complete the wave via gameState
      const reward = waveService.getWaveReward(1);
      const goldBefore = gameStateService.getState().gold;
      gameStateService.completeWave(reward);

      expect(gameStateService.getState().phase).toBe(GamePhase.INTERMISSION);
      expect(gameStateService.getState().gold).toBe(goldBefore + reward);
    });
  });

  // ─── 3. Game state machine: SETUP → COMBAT → INTERMISSION → VICTORY ───

  describe('game state machine: SETUP → COMBAT → INTERMISSION → VICTORY', () => {
    it('should start in SETUP phase', () => {
      expect(gameStateService.getState().phase).toBe(GamePhase.SETUP);
    });

    it('should transition to COMBAT when wave starts', () => {
      gameStateService.startWave();
      expect(gameStateService.getState().phase).toBe(GamePhase.COMBAT);
    });

    it('should transition to INTERMISSION after completing a non-final wave', () => {
      gameStateService.startWave(); // wave 1
      gameStateService.completeWave(25);
      expect(gameStateService.getState().phase).toBe(GamePhase.INTERMISSION);
    });

    it('should cycle through all 10 waves and reach VICTORY', () => {
      const maxWaves = gameStateService.getState().maxWaves;
      expect(maxWaves).toBe(WAVE_DEFINITIONS.length);

      for (let w = 1; w <= maxWaves; w++) {
        gameStateService.startWave();
        expect(gameStateService.getState().wave).toBe(w);
        expect(gameStateService.getState().phase).toBe(GamePhase.COMBAT);

        const reward = waveService.getWaveReward(w);

        if (w < maxWaves) {
          gameStateService.completeWave(reward);
          expect(gameStateService.getState().phase).toBe(GamePhase.INTERMISSION);
        } else {
          gameStateService.completeWave(reward);
          expect(gameStateService.getState().phase).toBe(GamePhase.VICTORY);
        }
      }

      expect(gameStateService.getState().wave).toBe(maxWaves);
      expect(gameStateService.getState().phase).toBe(GamePhase.VICTORY);
    });

    it('should transition to DEFEAT when lives reach 0 during combat', () => {
      gameStateService.startWave();
      const lives = gameStateService.getState().lives;
      gameStateService.loseLife(lives);
      expect(gameStateService.getState().phase).toBe(GamePhase.DEFEAT);
    });
  });

  // ─── 4. Difficulty presets applied correctly ───

  describe('difficulty presets applied correctly', () => {
    const difficulties: DifficultyLevel[] = [
      DifficultyLevel.EASY,
      DifficultyLevel.NORMAL,
      DifficultyLevel.HARD,
      DifficultyLevel.NIGHTMARE,
    ];

    for (const difficulty of difficulties) {
      it(`should apply ${difficulty} preset lives and gold`, () => {
        gameStateService.reset();
        gameStateService.setDifficulty(difficulty);

        const state = gameStateService.getState();
        const preset = DIFFICULTY_PRESETS[difficulty];

        expect(state.lives).toBe(preset.lives);
        expect(state.gold).toBe(preset.gold);
        expect(state.difficulty).toBe(difficulty);
      });
    }

    it('should apply difficulty before first wave only', () => {
      gameStateService.setDifficulty(DifficultyLevel.EASY);
      expect(gameStateService.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold);

      gameStateService.startWave(); // wave 1, COMBAT
      // Now changing difficulty should be a no-op
      gameStateService.setDifficulty(DifficultyLevel.NIGHTMARE);
      expect(gameStateService.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold);
      expect(gameStateService.getState().difficulty).toBe(DifficultyLevel.EASY);
    });
  });

  // ─── 5. Endless mode never reaches VICTORY ───

  describe('endless mode never reaches VICTORY', () => {
    it('should stay in INTERMISSION after completing wave 10 in endless mode', () => {
      gameStateService.setEndlessMode(true);
      waveService.setEndlessMode(true);

      const maxWaves = gameStateService.getState().maxWaves;

      // Play through all normal waves
      for (let w = 1; w <= maxWaves; w++) {
        gameStateService.startWave();
        gameStateService.completeWave(waveService.getWaveReward(w));
      }

      // Should be INTERMISSION, not VICTORY
      expect(gameStateService.getState().phase).toBe(GamePhase.INTERMISSION);
      expect(gameStateService.getState().wave).toBe(maxWaves);
    });

    it('should allow waves beyond maxWaves in endless mode', () => {
      gameStateService.setEndlessMode(true);
      waveService.setEndlessMode(true);

      const maxWaves = gameStateService.getState().maxWaves;

      // Play through all normal waves plus 3 extra
      for (let w = 1; w <= maxWaves + 3; w++) {
        gameStateService.startWave();
        expect(gameStateService.getState().phase).toBe(GamePhase.COMBAT);

        gameStateService.completeWave(100);
        expect(gameStateService.getState().phase).toBe(GamePhase.INTERMISSION);
      }

      expect(gameStateService.getState().wave).toBe(maxWaves + 3);
    });

    it('should track highestWave in endless mode', () => {
      gameStateService.setEndlessMode(true);
      waveService.setEndlessMode(true);

      const maxWaves = gameStateService.getState().maxWaves;

      for (let w = 1; w <= maxWaves + 2; w++) {
        gameStateService.startWave();
        gameStateService.completeWave(50);
      }

      expect(gameStateService.getState().highestWave).toBe(maxWaves + 2);
    });

    it('should generate endless waves via waveService beyond static definitions', () => {
      waveService.setEndlessMode(true);

      const endlessWaveNumber = WAVE_DEFINITIONS.length + 1;
      const totalEnemies = waveService.getTotalEnemiesInWave(endlessWaveNumber);
      expect(totalEnemies).toBeGreaterThan(0);

      const reward = waveService.getWaveReward(endlessWaveNumber);
      expect(reward).toBeGreaterThan(0);
    });
  });

  // ─── 6. Score calculation at game end ───

  describe('score calculation at game end', () => {
    it('should calculate correct score breakdown for a normal victory', () => {
      const difficulty = DifficultyLevel.NORMAL;
      const preset = DIFFICULTY_PRESETS[difficulty];
      const baseScore = 500;
      const livesRemaining = preset.lives; // no lives lost
      const wavesCompleted = WAVE_DEFINITIONS.length;

      const breakdown = calculateScoreBreakdown(
        baseScore,
        livesRemaining,
        preset.lives,
        difficulty,
        wavesCompleted,
        true
      );

      expect(breakdown.baseScore).toBe(baseScore);
      expect(breakdown.difficultyMultiplier).toBe(DIFFICULTY_SCORE_MULTIPLIER[difficulty]);
      expect(breakdown.finalScore).toBe(Math.round(baseScore * DIFFICULTY_SCORE_MULTIPLIER[difficulty]));
      expect(breakdown.stars).toBe(3); // No lives lost = 3 stars
      expect(breakdown.isVictory).toBeTrue();
      expect(breakdown.wavesCompleted).toBe(wavesCompleted);
      expect(breakdown.livesRemaining).toBe(livesRemaining);
      expect(breakdown.livesTotal).toBe(preset.lives);
    });

    it('should give 0 stars on defeat', () => {
      const breakdown = calculateScoreBreakdown(100, 0, 20, DifficultyLevel.NORMAL, 5, false);
      expect(breakdown.stars).toBe(0);
      expect(breakdown.isVictory).toBeFalse();
    });

    it('should apply difficulty multiplier to final score', () => {
      const baseScore = 1000;

      const easyBreakdown = calculateScoreBreakdown(baseScore, 30, 30, DifficultyLevel.EASY, 10, true);
      const nightmareBreakdown = calculateScoreBreakdown(baseScore, 7, 7, DifficultyLevel.NIGHTMARE, 10, true);

      expect(easyBreakdown.finalScore).toBe(Math.round(baseScore * 0.5));
      expect(nightmareBreakdown.finalScore).toBe(Math.round(baseScore * 2.0));
      expect(nightmareBreakdown.finalScore).toBeGreaterThan(easyBreakdown.finalScore);
    });

    it('should give 2 stars when more than half lives remain', () => {
      // 15 out of 20 lives remaining = 75% → 2 stars (>= 50% but < 100%)
      const breakdown = calculateScoreBreakdown(500, 15, 20, DifficultyLevel.NORMAL, 10, true);
      expect(breakdown.stars).toBe(2);
    });

    it('should give 1 star when fewer than half lives remain', () => {
      // 5 out of 20 lives remaining = 25% → 1 star (> 0 but < 50%)
      const breakdown = calculateScoreBreakdown(500, 5, 20, DifficultyLevel.NORMAL, 10, true);
      expect(breakdown.stars).toBe(1);
    });

    it('should integrate score accumulation through a simulated game', () => {
      // Simulate: set difficulty, play waves, track gold/score
      gameStateService.setDifficulty(DifficultyLevel.HARD);
      const initialGold = gameStateService.getState().gold;

      // Spend gold on a tower
      const towerCost = TOWER_CONFIGS[TowerType.BASIC].cost;
      gameStateService.spendGold(towerCost);

      // Record stat
      gameStatsService.recordTowerBuilt();

      // Play 3 waves
      for (let w = 1; w <= 3; w++) {
        gameStateService.startWave();
        gameStateService.addGold(20); // enemy kill rewards
        gameStatsService.recordKill(TowerType.BASIC);
        gameStateService.completeWave(waveService.getWaveReward(w));
      }

      const state = gameStateService.getState();
      const stats = gameStatsService.getStats();

      expect(state.wave).toBe(3);
      expect(state.phase).toBe(GamePhase.INTERMISSION);
      expect(stats.towersBuilt).toBe(1);
      expect(stats.killsByTowerType[TowerType.BASIC]).toBe(3);

      // Score should include wave rewards and kill gold
      expect(state.score).toBeGreaterThan(0);

      // Build final score breakdown
      const breakdown = calculateScoreBreakdown(
        state.score,
        state.lives,
        DIFFICULTY_PRESETS[DifficultyLevel.HARD].lives,
        state.difficulty,
        state.wave,
        false // still playing
      );

      expect(breakdown.difficultyMultiplier).toBe(DIFFICULTY_SCORE_MULTIPLIER[DifficultyLevel.HARD]);
      expect(breakdown.finalScore).toBe(Math.round(state.score * 1.5));
    });
  });

  // ─── 7. GameStats tracks across service interactions ───

  describe('game stats tracking across services', () => {
    it('should accumulate stats from multiple operations', () => {
      gameStatsService.recordTowerBuilt();
      gameStatsService.recordTowerBuilt();
      gameStatsService.recordTowerSold();
      gameStatsService.recordKill(TowerType.BASIC);
      gameStatsService.recordKill(TowerType.BASIC);
      gameStatsService.recordKill(TowerType.SNIPER);
      gameStatsService.recordDamage(250);
      gameStatsService.recordGoldEarned(100);
      gameStatsService.recordEnemyLeaked();
      gameStatsService.recordShot();
      gameStatsService.recordShot();
      gameStatsService.recordShot();

      const stats = gameStatsService.getStats();
      expect(stats.towersBuilt).toBe(2);
      expect(stats.towersSold).toBe(1);
      expect(stats.killsByTowerType[TowerType.BASIC]).toBe(2);
      expect(stats.killsByTowerType[TowerType.SNIPER]).toBe(1);
      expect(stats.totalDamageDealt).toBe(250);
      expect(stats.totalGoldEarned).toBe(100);
      expect(stats.enemiesLeaked).toBe(1);
      expect(stats.shotsFired).toBe(3);
    });

    it('should reset all stats cleanly', () => {
      gameStatsService.recordKill(TowerType.BASIC);
      gameStatsService.recordDamage(500);
      gameStatsService.recordTowerBuilt();

      gameStatsService.reset();
      const stats = gameStatsService.getStats();

      expect(stats.killsByTowerType[TowerType.BASIC]).toBe(0);
      expect(stats.totalDamageDealt).toBe(0);
      expect(stats.towersBuilt).toBe(0);
    });
  });

  // ─── 8. Status effect cleanup on enemy removal ───

  describe('status effect cleanup on enemy removal', () => {
    it('should clear status effects when removeAllEffects is called before removeEnemy', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.BASIC, scene);
      expect(enemy).not.toBeNull();

      // Apply effects
      statusEffectService.apply(enemy!.id, StatusEffectType.SLOW, 0);
      statusEffectService.apply(enemy!.id, StatusEffectType.BURN, 0);
      expect(statusEffectService.getEffects(enemy!.id).length).toBe(2);

      // Explicit cleanup before removal (matches game-board.component pattern)
      statusEffectService.removeAllEffects(enemy!.id);
      enemyService.removeEnemy(enemy!.id, scene);

      // Effects should be gone immediately — no stale entries
      expect(statusEffectService.hasEffect(enemy!.id, StatusEffectType.SLOW)).toBe(false);
      expect(statusEffectService.hasEffect(enemy!.id, StatusEffectType.BURN)).toBe(false);
      expect(statusEffectService.getAllActiveEffects().size).toBe(0);
    });

    it('should restore original speed when effects are cleaned up before enemy removal', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.BASIC, scene);
      expect(enemy).not.toBeNull();
      const originalSpeed = enemy!.speed;

      statusEffectService.apply(enemy!.id, StatusEffectType.SLOW, 0);
      expect(enemy!.speed).toBeLessThan(originalSpeed);

      // removeAllEffects restores speed before the enemy is deleted from the map
      statusEffectService.removeAllEffects(enemy!.id);
      expect(enemy!.speed).toBe(originalSpeed);
    });

    it('should not leave stale entries for leaked enemies', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.BASIC, scene);
      expect(enemy).not.toBeNull();

      statusEffectService.apply(enemy!.id, StatusEffectType.POISON, 0);

      // Simulate leak: explicit cleanup then remove (matches component flow)
      statusEffectService.removeAllEffects(enemy!.id);
      enemyService.removeEnemy(enemy!.id, scene);

      // Verify getAllActiveEffects returns empty — no stale entry
      const activeEffects = statusEffectService.getAllActiveEffects();
      expect(activeEffects.has(enemy!.id)).toBe(false);
    });
  });
});
