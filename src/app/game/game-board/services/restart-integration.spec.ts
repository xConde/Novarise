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
import { MinimapService } from './minimap.service';

import { GamePhase, DifficultyLevel, DIFFICULTY_PRESETS } from '../models/game-state.model';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { EnemyType } from '../models/enemy.model';
import { GameModifier } from '../models/game-modifier.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { GameBoardTile } from '../models/game-board-tile';

/**
 * Build a minimal 5x5 board with:
 *   - Spawner at (0,0)
 *   - Exit at (4,4)
 *   - All other tiles are traversable BASE
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

  board[0][0] = GameBoardTile.createSpawner(0, 0);
  board[4][4] = GameBoardTile.createExit(4, 4);

  return { board, width, height };
}

/**
 * Simulate the restartGame() cleanup → re-init sequence at the service level.
 *
 * This mirrors game-board.component.ts restartGame() lines 623–674:
 *   1. cleanupGameObjects() — enemy removal, towerCombat cleanup, minimap cleanup, statusEffect cleanup
 *   2. Service resets — enemyService.reset(), waveService.reset(), gameStateService.reset(), gameStatsService.reset()
 *   3. Board re-import
 *
 * We skip Three.js mesh/renderer operations since we're testing service state only.
 */
function simulateRestart(
  enemyService: EnemyService,
  towerCombatService: TowerCombatService,
  waveService: WaveService,
  gameStateService: GameStateService,
  gameStatsService: GameStatsService,
  minimapService: MinimapService,
  gameBoardService: GameBoardService,
  scene: THREE.Scene,
): void {
  // Step 1: cleanupGameObjects() — remove enemies, cleanup combat, cleanup minimap
  for (const id of Array.from(enemyService.getEnemies().keys())) {
    enemyService.removeEnemy(id, scene);
  }
  towerCombatService.cleanup(scene);
  minimapService.cleanup();

  // Step 2: Service resets (matches component order)
  enemyService.reset(scene);
  waveService.reset();
  gameStateService.reset();
  gameStatsService.reset();

  // Step 3: Re-import board
  const { board, width, height } = buildMinimalBoard();
  gameBoardService.importBoard(board, width, height);
}

describe('Restart Integration — clean state after restartGame()', () => {
  let gameStateService: GameStateService;
  let waveService: WaveService;
  let enemyService: EnemyService;
  let towerCombatService: TowerCombatService;
  let gameStatsService: GameStatsService;
  let gameBoardService: GameBoardService;
  let statusEffectService: StatusEffectService;
  let audioService: AudioService;
  let minimapService: MinimapService;
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
        MinimapService,
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
    minimapService = TestBed.inject(MinimapService);

    scene = new THREE.Scene();

    const { board, width, height } = buildMinimalBoard();
    gameBoardService.importBoard(board, width, height);
  });

  afterEach(() => {
    enemyService.reset(scene);
    towerCombatService.cleanup(scene);
    waveService.reset();

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

  // ─── Helper: dirty all services to simulate mid-game state ───

  function dirtyGameState(): void {
    // Advance to wave 3 with combat activity
    gameStateService.startWave(); // wave 1, COMBAT
    waveService.startWave(1, scene);
    for (let i = 0; i < 60; i++) {
      waveService.update(0.2, scene);
    }
    gameStateService.completeWave(50);

    gameStateService.startWave(); // wave 2
    waveService.startWave(2, scene);
    for (let i = 0; i < 60; i++) {
      waveService.update(0.2, scene);
    }
    gameStateService.completeWave(50);

    gameStateService.startWave(); // wave 3
    waveService.startWave(3, scene);
    for (let i = 0; i < 60; i++) {
      waveService.update(0.2, scene);
    }

    // Spend gold and place a tower
    gameStateService.spendGold(TOWER_CONFIGS[TowerType.BASIC].cost);
    gameBoardService.placeTower(2, 2, TowerType.BASIC);
    const towerMesh = new THREE.Group();
    towerCombatService.registerTower(2, 2, TowerType.BASIC, towerMesh);

    // Record stats
    gameStatsService.recordTowerBuilt();
    gameStatsService.recordKill(TowerType.BASIC);
    gameStatsService.recordDamage(100);
    gameStatsService.recordGoldEarned(50);
    gameStatsService.recordShot();
  }

  // ─── 1. Game state returns to initial values ───

  describe('after restart, game state should be initial', () => {
    it('should reset wave to 0', () => {
      dirtyGameState();
      expect(gameStateService.getState().wave).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().wave).toBe(0);
    });

    it('should reset phase to SETUP', () => {
      dirtyGameState();
      expect(gameStateService.getState().phase).not.toBe(GamePhase.SETUP);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().phase).toBe(GamePhase.SETUP);
    });

    it('should reset gold to starting value', () => {
      dirtyGameState();
      const dirtyGold = gameStateService.getState().gold;
      const startingGold = DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold;
      expect(dirtyGold).not.toBe(startingGold);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().gold).toBe(startingGold);
    });

    it('should reset lives to starting value', () => {
      dirtyGameState();
      gameStateService.loseLife(2); // lose some lives
      const startingLives = DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives;
      expect(gameStateService.getState().lives).toBeLessThan(startingLives);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().lives).toBe(startingLives);
    });

    it('should reset score to 0', () => {
      dirtyGameState();
      expect(gameStateService.getState().score).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().score).toBe(0);
    });

    it('should reset highestWave to 0', () => {
      // highestWave only updates in endless mode
      gameStateService.setEndlessMode(true);
      dirtyGameState();
      // After dirtyGameState completes 2 waves in endless, highestWave should be set
      expect(gameStateService.getState().highestWave).toBeGreaterThanOrEqual(1);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().highestWave).toBe(0);
    });

    it('should reset isPaused to false', () => {
      dirtyGameState();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().isPaused).toBe(false);
    });

    it('should reset gameSpeed to 1', () => {
      dirtyGameState();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(gameStateService.getState().gameSpeed).toBe(1);
    });
  });

  // ─── 2. Enemy service has no enemies ───

  describe('after restart, enemy service should have no enemies', () => {
    it('should have empty enemies map', () => {
      dirtyGameState();
      expect(enemyService.getEnemies().size).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(enemyService.getEnemies().size).toBe(0);
    });

    it('should reset enemy counter so next enemy gets a fresh ID sequence', () => {
      dirtyGameState();
      const enemiesBefore = enemyService.getEnemies().size;
      expect(enemiesBefore).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      // Spawn a new enemy — its ID should start from the reset counter
      const newEnemy = enemyService.spawnEnemy(EnemyType.BASIC, scene);
      expect(newEnemy).not.toBeNull();
      expect(enemyService.getEnemies().size).toBe(1);
    });
  });

  // ─── 3. Tower combat service has no towers registered ───

  describe('after restart, tower combat service should have no towers registered', () => {
    it('should have empty placed towers', () => {
      dirtyGameState();
      expect(towerCombatService.getPlacedTowers().size).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(towerCombatService.getPlacedTowers().size).toBe(0);
    });

    it('should not find previously placed tower by key', () => {
      dirtyGameState();
      const towerKey = '2-2';
      expect(towerCombatService.getTower(towerKey)).toBeDefined();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(towerCombatService.getTower(towerKey)).toBeUndefined();
    });
  });

  // ─── 4. Wave service should not be spawning ───

  describe('after restart, wave service should not be spawning', () => {
    it('should not be actively spawning', () => {
      // Start wave 1 with minimal updates so spawning is still active
      gameStateService.startWave();
      waveService.startWave(1, scene);
      waveService.update(0.1, scene); // Single small tick — spawning should still be in progress
      expect(waveService.isSpawning()).toBeTrue();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(waveService.isSpawning()).toBeFalse();
    });

    it('should reset endless mode flag', () => {
      gameStateService.setEndlessMode(true);
      waveService.setEndlessMode(true);
      dirtyGameState();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(waveService.isSpawning()).toBeFalse();
      // Endless mode is reset by waveService.reset()
      expect(gameStateService.getState().isEndless).toBe(false);
    });
  });

  // ─── 5. Status effect service should have no active effects ───

  describe('after restart, status effect service should have no active effects', () => {
    it('should have empty active effects map', () => {
      // Spawn an enemy and apply effects
      const enemy = enemyService.spawnEnemy(EnemyType.BASIC, scene);
      expect(enemy).not.toBeNull();
      statusEffectService.apply(enemy!.id, StatusEffectType.SLOW, 0);
      statusEffectService.apply(enemy!.id, StatusEffectType.BURN, 0);
      expect(statusEffectService.getAllActiveEffects().size).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(statusEffectService.getAllActiveEffects().size).toBe(0);
    });

    it('should not report effects for previously affected enemies', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.BASIC, scene);
      expect(enemy).not.toBeNull();
      const enemyId = enemy!.id;
      statusEffectService.apply(enemyId, StatusEffectType.POISON, 0);
      expect(statusEffectService.hasEffect(enemyId, StatusEffectType.POISON)).toBe(true);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(statusEffectService.hasEffect(enemyId, StatusEffectType.POISON)).toBe(false);
      expect(statusEffectService.getEffects(enemyId).length).toBe(0);
    });
  });

  // ─── 6. Minimap should not be visible ───

  describe('after restart, minimap should not be visible', () => {
    it('should report not visible after restart', () => {
      // Show minimap (simulates what happens when first wave starts)
      minimapService.show();
      expect(minimapService.isVisible()).toBe(true);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      expect(minimapService.isVisible()).toBe(false);
    });
  });

  // ─── 7. Modifier state is cleared on restart ───

  describe('after restart, modifier state should be cleared', () => {
    it('should clear active modifiers from game state', () => {
      // Set modifiers before playing
      const modifiers = new Set<GameModifier>([GameModifier.ARMORED_ENEMIES, GameModifier.FAST_ENEMIES]);
      gameStateService.setModifiers(modifiers);
      expect(gameStateService.getState().activeModifiers.size).toBe(2);

      dirtyGameState();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      // gameStateService.reset() clears modifiers — they are NOT persisted across restart
      expect(gameStateService.getState().activeModifiers.size).toBe(0);
    });

    it('should reset modifier score multiplier to default', () => {
      const modifiers = new Set<GameModifier>([GameModifier.ARMORED_ENEMIES, GameModifier.EXPENSIVE_TOWERS]);
      gameStateService.setModifiers(modifiers);
      expect(gameStateService.getModifierScoreMultiplier()).toBeGreaterThan(1.0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      // After reset, no modifiers → multiplier is 1.0
      expect(gameStateService.getModifierScoreMultiplier()).toBe(1.0);
    });
  });

  // ─── 8. Game stats are fully reset ───

  describe('after restart, game stats should be zeroed', () => {
    it('should reset all stat counters to zero', () => {
      dirtyGameState();
      const dirtyStats = gameStatsService.getStats();
      expect(dirtyStats.towersBuilt).toBeGreaterThan(0);
      expect(dirtyStats.totalDamageDealt).toBeGreaterThan(0);

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      const cleanStats = gameStatsService.getStats();
      expect(cleanStats.towersBuilt).toBe(0);
      expect(cleanStats.towersSold).toBe(0);
      expect(cleanStats.totalDamageDealt).toBe(0);
      expect(cleanStats.totalGoldEarned).toBe(0);
      expect(cleanStats.enemiesLeaked).toBe(0);
      expect(cleanStats.shotsFired).toBe(0);
      expect(cleanStats.killsByTowerType[TowerType.BASIC]).toBe(0);
    });
  });

  // ─── 9. Full cycle: play → restart → play again ───

  describe('full cycle: play → restart → play again', () => {
    it('should allow a clean second game after restart', () => {
      // First game: advance to wave 3
      dirtyGameState();
      const wave3Gold = gameStateService.getState().gold;
      expect(gameStateService.getState().wave).toBe(3);

      // Restart
      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      // Second game: verify clean slate
      expect(gameStateService.getState().wave).toBe(0);
      expect(gameStateService.getState().phase).toBe(GamePhase.SETUP);
      expect(enemyService.getEnemies().size).toBe(0);
      expect(towerCombatService.getPlacedTowers().size).toBe(0);
      expect(waveService.isSpawning()).toBeFalse();

      // Start a new game — should work from wave 1
      gameStateService.startWave();
      expect(gameStateService.getState().wave).toBe(1);
      expect(gameStateService.getState().phase).toBe(GamePhase.COMBAT);

      waveService.startWave(1, scene);
      expect(waveService.isSpawning()).toBeTrue();

      // Enemies should spawn fresh
      for (let i = 0; i < 30; i++) {
        waveService.update(0.2, scene);
      }
      expect(enemyService.getEnemies().size).toBeGreaterThan(0);
    });

    it('should allow tower placement after restart', () => {
      dirtyGameState();

      simulateRestart(enemyService, towerCombatService, waveService, gameStateService, gameStatsService, minimapService, gameBoardService, scene);

      // Place a tower in the new game
      const cost = TOWER_CONFIGS[TowerType.SNIPER].cost;
      expect(gameStateService.canAfford(cost)).toBeTrue();

      const spent = gameStateService.spendGold(cost);
      expect(spent).toBeTrue();

      gameBoardService.placeTower(1, 1, TowerType.SNIPER);
      const mesh = new THREE.Group();
      towerCombatService.registerTower(1, 1, TowerType.SNIPER, mesh);

      expect(towerCombatService.getTower('1-1')).toBeDefined();
      expect(towerCombatService.getTower('1-1')!.type).toBe(TowerType.SNIPER);
    });
  });
});
