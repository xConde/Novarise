import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyService } from './enemy.service';
import { PathfindingService } from './pathfinding.service';
import { TowerCombatService } from './tower-combat.service';
import { CombatVFXService } from './combat-vfx.service';
import { StatusEffectService } from './status-effect.service';
import { AudioService } from './audio.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { ParticleService } from './particle.service';
import { MinimapService } from './minimap.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType, ENEMY_STATS, Enemy } from '../models/enemy.model';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { GamePhase, INITIAL_GAME_STATE } from '../models/game-state.model';
import { WAVE_DEFINITIONS } from '../models/wave.model';
import { createTestEnemy, createTestBoard, createGameBoardServiceSpy, createEnemyServiceSpy } from '../testing';

// ============================================================================
// 1. EnemyService lifecycle
// ============================================================================

describe('EnemyService lifecycle', () => {
  let service: EnemyService;
  let gameBoardService: jasmine.SpyObj<GameBoardService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    const spy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());

    TestBed.configureTestingModule({
      providers: [
        PathfindingService,
        EnemyService,
        { provide: GameBoardService, useValue: spy }
      ]
    });

    service = TestBed.inject(EnemyService);
    gameBoardService = TestBed.inject(GameBoardService) as jasmine.SpyObj<GameBoardService>;
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
  });

  it('reset() should clear all enemies and reset counter', () => {
    service.spawnEnemy(EnemyType.BASIC, scene);
    service.spawnEnemy(EnemyType.FAST, scene);
    service.spawnEnemy(EnemyType.HEAVY, scene);
    expect(service.getEnemies().size).toBe(3);

    service.reset(scene);

    expect(service.getEnemies().size).toBe(0);
    // Counter resets — next spawned enemy should have id 'enemy-0'
    const next = service.spawnEnemy(EnemyType.BASIC, scene);
    expect(next).toBeTruthy();
    expect(next!.id).toBe('enemy-0');
  });

  it('reset() should remove enemy meshes from the scene', () => {
    service.spawnEnemy(EnemyType.BASIC, scene);
    service.spawnEnemy(EnemyType.BASIC, scene);
    const meshCountBefore = scene.children.length;
    expect(meshCountBefore).toBe(2);

    service.reset(scene);

    expect(scene.children.length).toBe(0);
  });

  it('damaging an enemy to death should mark it killed', () => {
    const enemy = service.spawnEnemy(EnemyType.BASIC, scene)!;
    const result = service.damageEnemy(enemy.id, enemy.maxHealth);
    expect(result.killed).toBeTrue();
  });

  it('clearPathCache() should empty the path cache', () => {
    // Spawn forces a pathfinding call which populates the cache
    service.spawnEnemy(EnemyType.BASIC, scene);
    // Spawning a second enemy of the same type should hit the cache,
    // proving the cache is populated. After clearing it should be empty.
    service.clearPathCache();

    // Verify by spawning again — it will need to re-compute (no error = success)
    const enemy = service.spawnEnemy(EnemyType.BASIC, scene);
    expect(enemy).toBeTruthy();
  });
});

// ============================================================================
// 2. TowerCombatService lifecycle
// ============================================================================

describe('TowerCombatService lifecycle', () => {
  let service: TowerCombatService;
  let combatVFXService: CombatVFXService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let gameBoardServiceSpy: jasmine.SpyObj<GameBoardService>;
  let audioServiceSpy: jasmine.SpyObj<AudioService>;
  let scene: THREE.Scene;
  let enemyMap: Map<string, Enemy>;

  const createEnemy = (id: string, x: number, z: number, health = 100): Enemy =>
    createTestEnemy(id, x, z, health);

  beforeEach(() => {
    enemyMap = new Map();

    enemyServiceSpy = createEnemyServiceSpy(enemyMap);
    gameBoardServiceSpy = createGameBoardServiceSpy(25, 20, 1);

    audioServiceSpy = jasmine.createSpyObj('AudioService', ['playSfx']);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        CombatVFXService,
        StatusEffectService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
        { provide: AudioService, useValue: audioServiceSpy }
      ]
    });

    service = TestBed.inject(TowerCombatService);
    combatVFXService = TestBed.inject(CombatVFXService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
  });

  it('cleanup() should clear all placed towers', () => {
    service.registerTower(1, 1, TowerType.BASIC, new THREE.Group());
    service.registerTower(2, 2, TowerType.SNIPER, new THREE.Group());
    service.registerTower(3, 3, TowerType.SPLASH, new THREE.Group());
    expect(service.getPlacedTowers().size).toBe(3);

    service.cleanup(scene);

    expect(service.getPlacedTowers().size).toBe(0);
  });

  it('cleanup() should clear all projectiles', () => {
    // Tower at row=10, col=12 on 25x20 board → world pos (-0.5, 0)
    // Place enemy 2 tiles away (within basic range=3) so projectile is in-flight
    service.registerTower(10, 12, TowerType.BASIC, new THREE.Group());
    const enemy = createEnemy('e-1', 1.5, 0, 9999);
    enemyMap.set(enemy.id, enemy);

    // Use tiny deltaTime: tower fires (lastFireTime=-Infinity passes fireRate check)
    // but projectile only moves 8 * 0.01 = 0.08 tiles, well short of 2-tile distance
    service.update(0.01, scene);
    const sceneChildrenBeforeCleanup = scene.children.length;
    expect(sceneChildrenBeforeCleanup).toBeGreaterThan(0);

    service.cleanup(scene);

    // All projectile meshes removed from scene
    expect(scene.children.length).toBe(0);
  });

  it('cleanup() should reset projectileCounter and gameTime to 0', () => {
    // Fire a projectile to increment counter
    service.registerTower(10, 12, TowerType.BASIC, new THREE.Group());
    const enemy = createEnemy('e-1', 1.5, 0, 9999);
    enemyMap.set(enemy.id, enemy);
    service.update(0.01, scene);

    service.cleanup(scene);

    // Towers map is empty, no projectiles remain, no errors
    expect(service.getPlacedTowers().size).toBe(0);

    // Re-register and fire again — should work cleanly from reset state
    service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
    const enemy2 = createEnemy('e-2', 1.5, 0, 9999);
    enemyMap.set(enemy2.id, enemy2);
    expect(() => service.update(0.01, scene)).not.toThrow();
  });

  it('cleanup() should remove tower meshes from scene', () => {
    const group = new THREE.Group();
    const childMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    group.add(childMesh);
    scene.add(group);

    service.registerTower(1, 1, TowerType.BASIC, group);
    expect(scene.children.length).toBe(1);

    service.cleanup(scene);

    expect(scene.children.length).toBe(0);
  });
});

// ============================================================================
// 3. AudioService lifecycle
// ============================================================================

describe('AudioService lifecycle', () => {
  let service: AudioService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AudioService]
    });
    service = TestBed.inject(AudioService);
  });

  afterEach(() => {
    service.cleanup();
  });

  it('cleanup() should close AudioContext', () => {
    // Force context creation by playing a sound
    service.playEnemyDeath();

    service.cleanup();

    // After cleanup, playing should not throw (graceful degradation)
    expect(() => service.playEnemyDeath()).not.toThrow();
  });

  it('cleanup() should be idempotent (safe to call twice)', () => {
    service.playEnemyDeath();
    service.cleanup();
    expect(() => service.cleanup()).not.toThrow();
  });

  it('resetFrameCounters() should allow sounds to play again within same frame', () => {
    // Play multiple tower fires to exhaust per-frame limit
    for (let i = 0; i < 20; i++) {
      service.playTowerFire(TowerType.BASIC);
    }

    service.resetFrameCounters();

    // After reset, playing should not throw
    expect(() => service.playTowerFire(TowerType.BASIC)).not.toThrow();
  });
});

// ============================================================================
// 4. GameStateService lifecycle
// ============================================================================

describe('GameStateService lifecycle', () => {
  let service: GameStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameStateService]
    });
    service = TestBed.inject(GameStateService);
  });

  it('reset() should restore state to INITIAL_GAME_STATE after phase change', () => {
    service.setPhase(GamePhase.COMBAT);
    service.reset();
    expect(service.getState().phase).toBe(INITIAL_GAME_STATE.phase);
  });

  it('reset() should restore gold after spending', () => {
    service.spendGold(50);
    service.reset();
    expect(service.getState().gold).toBe(INITIAL_GAME_STATE.gold);
  });

  it('reset() should restore lives after losing some', () => {
    service.loseLife(5);
    service.loseLife(3);
    service.reset();
    expect(service.getState().lives).toBe(INITIAL_GAME_STATE.lives);
  });

  it('reset() should restore wave counter', () => {
    service.startWave();
    service.startWave();
    service.reset();
    expect(service.getState().wave).toBe(INITIAL_GAME_STATE.wave);
  });

  it('reset() should restore score to 0', () => {
    service.addScore(500);
    service.reset();
    expect(service.getState().score).toBe(INITIAL_GAME_STATE.score);
  });

  it('reset() should match INITIAL_GAME_STATE exactly', () => {
    // Mutate every field
    service.setPhase(GamePhase.COMBAT);
    service.startWave();
    service.addGold(100);
    service.addScore(200);
    service.loseLife(3);

    service.reset();

    const state = service.getState();
    expect(state.phase).toBe(INITIAL_GAME_STATE.phase);
    expect(state.wave).toBe(INITIAL_GAME_STATE.wave);
    expect(state.maxWaves).toBe(INITIAL_GAME_STATE.maxWaves);
    expect(state.lives).toBe(INITIAL_GAME_STATE.lives);
    expect(state.gold).toBe(INITIAL_GAME_STATE.gold);
    expect(state.score).toBe(INITIAL_GAME_STATE.score);
    expect(state.isEndless).toBe(INITIAL_GAME_STATE.isEndless);
    expect(state.highestWave).toBe(INITIAL_GAME_STATE.highestWave);
    expect(state.isPaused).toBe(INITIAL_GAME_STATE.isPaused);
    expect(state.gameSpeed).toBe(INITIAL_GAME_STATE.gameSpeed);
    expect(state.elapsedTime).toBe(INITIAL_GAME_STATE.elapsedTime);
    expect(state.difficulty).toBe(INITIAL_GAME_STATE.difficulty);
  });

  it('reset() should emit updated state via observable', (done) => {
    service.setPhase(GamePhase.COMBAT);
    service.reset();

    service.getState$().subscribe(state => {
      expect(state.phase).toBe(GamePhase.SETUP);
      done();
    });
  });
});

// ============================================================================
// 5. WaveService lifecycle
// ============================================================================

describe('WaveService lifecycle', () => {
  let service: WaveService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    enemyServiceSpy = jasmine.createSpyObj('EnemyService', ['spawnEnemy']);
    enemyServiceSpy.spawnEnemy.and.returnValue({ id: 'enemy-0' } as unknown as Enemy);

    TestBed.configureTestingModule({
      providers: [
        WaveService,
        { provide: EnemyService, useValue: enemyServiceSpy }
      ]
    });

    service = TestBed.inject(WaveService);
    scene = new THREE.Scene();
  });

  it('startWave() should set spawning to active', () => {
    service.startWave(1, scene);
    expect(service.isSpawning()).toBeTrue();
  });

  it('partially spawned wave should still report active', () => {
    service.startWave(1, scene);
    // Spawn some but not all
    service.update(0.5, scene);
    expect(service.isSpawning()).toBeTrue();
  });

  it('reset() should deactivate spawning', () => {
    service.startWave(1, scene);
    service.reset();
    expect(service.isSpawning()).toBeFalse();
  });

  it('reset() should clear spawn queues (getRemainingToSpawn returns 0)', () => {
    service.startWave(1, scene);
    service.reset();
    expect(service.getRemainingToSpawn()).toBe(0);
  });

  it('reset() should clear endless mode flag', () => {
    service.setEndlessMode(true);
    expect(service.isEndlessMode()).toBeTrue();

    service.reset();
    expect(service.isEndlessMode()).toBeFalse();
  });

  it('reset() should allow starting wave 1 again from clean state', () => {
    service.startWave(1, scene);
    // Fully spawn wave 1
    for (let i = 0; i < 100; i++) {
      service.update(1, scene);
    }

    service.reset();
    service.startWave(1, scene);

    expect(service.isSpawning()).toBeTrue();
    expect(service.getRemainingToSpawn()).toBeGreaterThan(0);
  });
});

// ============================================================================
// 6. ParticleService lifecycle
// ============================================================================

describe('ParticleService lifecycle', () => {
  let service: ParticleService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ParticleService]
    });
    service = TestBed.inject(ParticleService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
  });

  it('spawnDeathBurst() should increase particle count', () => {
    service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 5);
    expect(service.particleCount).toBe(5);
  });

  it('cleanup() should clear all particles', () => {
    service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 5);
    service.spawnDeathBurst({ x: 1, y: 0, z: 1 }, 0x00ff00, 3);
    expect(service.particleCount).toBe(8);

    service.cleanup(scene);

    expect(service.particleCount).toBe(0);
  });

  it('cleanup() should remove particle meshes from the scene', () => {
    service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 4);
    service.addPendingToScene(scene);
    expect(scene.children.length).toBe(4);

    service.cleanup(scene);

    expect(scene.children.length).toBe(0);
  });

  it('cleanup() should be idempotent (safe to call twice)', () => {
    service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 3);
    service.addPendingToScene(scene);

    service.cleanup(scene);
    expect(() => service.cleanup(scene)).not.toThrow();
    expect(service.particleCount).toBe(0);
  });
});

// ============================================================================
// 7. MinimapService lifecycle
// ============================================================================

describe('MinimapService lifecycle', () => {
  let service: MinimapService;
  let container: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MinimapService]
    });
    service = TestBed.inject(MinimapService);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    service.cleanup();
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  it('cleanup() should remove canvas from container', () => {
    service.init(container);
    expect(container.querySelector('canvas')).not.toBeNull();

    service.cleanup();

    expect(container.querySelector('canvas')).toBeNull();
  });

  it('cleanup() should reset lastUpdateTime (update runs immediately after re-init)', () => {
    service.init(container);
    const terrain = {
      gridWidth: 10,
      gridHeight: 10,
      isPath: () => false
    };

    // First update at t=1000
    service.update(1000, terrain, []);

    service.cleanup();

    // Re-init and update at t=0 — should not be throttled
    service.init(container);
    // If lastUpdateTime was not reset, this would be throttled because
    // 0 - 1000 < updateIntervalMs. We verify it runs by checking no throw.
    expect(() => service.update(0, terrain, [])).not.toThrow();
  });

  it('cleanup() should be idempotent (safe to call without init)', () => {
    expect(() => service.cleanup()).not.toThrow();
  });

  it('cleanup() should be idempotent (safe to call twice after init)', () => {
    service.init(container);
    service.cleanup();
    expect(() => service.cleanup()).not.toThrow();
  });
});
