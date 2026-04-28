import * as THREE from 'three';
import { CheckpointRestoreCoordinatorService } from './checkpoint-restore-coordinator.service';
import { GameBoardService } from '../game-board.service';
import { SceneService } from './scene.service';
import { EnemyService } from './enemy.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { TowerCombatService } from './tower-combat.service';
import { GameStatsService } from './game-stats.service';
import { StatusEffectService } from './status-effect.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameSessionService } from './game-session.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { CombatLoopService } from './combat-loop.service';
import { ChallengeDisplayService } from './challenge-display.service';
import { AscensionModifierService } from './ascension-modifier.service';
import { TurnHistoryService } from './turn-history.service';
import { WavePreviewService } from './wave-preview.service';
import { PathMutationService } from './path-mutation.service';
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';
import { SpawnPreviewViewService } from './spawn-preview-view.service';
import { ItemService } from '../../../run/services/item.service';
import { RunStateFlagService } from '../../../run/services/run-state-flag.service';
import { EncounterCheckpointService } from '../../../run/services/encounter-checkpoint.service';
import { RunService } from '../../../run/services/run.service';
import { RelicService } from '../../../run/services/relic.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { DeckService } from '../../../run/services/deck.service';
import { GamePhase } from '../models/game-state.model';
import { TowerType } from '../models/tower.model';
import { EncounterCheckpoint } from '../models/encounter-checkpoint.model';

function makeCheckpoint(overrides: Partial<EncounterCheckpoint> = {}): EncounterCheckpoint {
  return {
    version: 11,
    timestamp: 1,
    nodeId: 'n1',
    encounterConfig: { waves: [{}, {}], isElite: false, isBoss: false, campaignMapId: 'forest' },
    rngState: 1,
    deckRngState: 2,
    gameState: {} as unknown,
    turnNumber: 3,
    leakedThisWave: false,
    towers: [],
    mortarZones: [],
    enemies: [],
    enemyCounter: 0,
    statusEffects: [],
    waveState: {} as unknown,
    deckState: {} as unknown,
    cardModifiers: [],
    relicFlags: {} as unknown,
    gameStats: {} as unknown,
    challengeState: {} as unknown,
    wavePreview: { oneShotBonus: 0 },
    turnHistory: [],
    itemInventory: {} as unknown,
    runStateFlags: {} as unknown,
    pathMutations: { mutations: [], nextId: 0 } as unknown,
    tileElevations: { elevations: [], nextId: 0 } as unknown,
    towerGraph: {} as unknown,
    ...overrides,
  } as unknown as EncounterCheckpoint;
}

describe('CheckpointRestoreCoordinatorService', () => {
  let encounterCheckpointSpy: jasmine.SpyObj<EncounterCheckpointService>;
  let runSpy: jasmine.SpyObj<RunService>;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let waveSpy: jasmine.SpyObj<WaveService>;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let towerCombatSpy: jasmine.SpyObj<TowerCombatService>;
  let gameStatsSpy: jasmine.SpyObj<GameStatsService>;
  let statusEffectSpy: jasmine.SpyObj<StatusEffectService>;
  let challengeTrackingSpy: jasmine.SpyObj<ChallengeTrackingService>;
  let gameSessionSpy: jasmine.SpyObj<GameSessionService>;
  let meshRegistrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let towerMeshFactorySpy: jasmine.SpyObj<TowerMeshFactoryService>;
  let enemyMeshFactorySpy: jasmine.SpyObj<EnemyMeshFactoryService>;
  let combatLoopSpy: jasmine.SpyObj<CombatLoopService>;
  let challengeDisplaySpy: jasmine.SpyObj<ChallengeDisplayService>;
  let ascensionSpy: jasmine.SpyObj<AscensionModifierService>;
  let turnHistorySpy: jasmine.SpyObj<TurnHistoryService>;
  let wavePreviewSpy: jasmine.SpyObj<WavePreviewService>;
  let pathMutationSpy: jasmine.SpyObj<PathMutationService>;
  let elevationSpy: jasmine.SpyObj<ElevationService>;
  let towerGraphSpy: jasmine.SpyObj<TowerGraphService>;
  let spawnPreviewSpy: jasmine.SpyObj<SpawnPreviewViewService>;
  let itemSpy: jasmine.SpyObj<ItemService>;
  let runStateFlagSpy: jasmine.SpyObj<RunStateFlagService>;
  let relicSpy: jasmine.SpyObj<RelicService>;
  let cardEffectSpy: jasmine.SpyObj<CardEffectService>;
  let deckSpy: jasmine.SpyObj<DeckService>;
  let service: CheckpointRestoreCoordinatorService;

  beforeEach(() => {
    encounterCheckpointSpy = jasmine.createSpyObj<EncounterCheckpointService>(
      'EncounterCheckpointService', ['loadCheckpoint', 'clearCheckpoint'],
    );
    runSpy = jasmine.createSpyObj<RunService>('RunService', ['restoreRngState']);
    // Spy properties from createSpyObj's 3rd arg become read-only getters; we
    // need a real writable field so the service's `isRestoringCheckpoint = false`
    // assignment is observable. Same trick for runState.
    Object.defineProperty(runSpy, 'isRestoringCheckpoint', { writable: true, value: true });
    Object.defineProperty(runSpy, 'runState', { writable: true, value: null });
    sceneSpy = jasmine.createSpyObj<SceneService>('SceneService', ['getScene', 'getCamera']);
    sceneSpy.getScene.and.returnValue(new THREE.Scene());
    sceneSpy.getCamera.and.returnValue(null as unknown as THREE.PerspectiveCamera);
    gameBoardSpy = jasmine.createSpyObj<GameBoardService>('GameBoardService', [
      'setTileType', 'setTileElevation', 'getGameBoard', 'getBoardWidth', 'getBoardHeight', 'forceSetTower',
    ]);
    gameBoardSpy.getGameBoard.and.returnValue([]);
    gameBoardSpy.getBoardWidth.and.returnValue(8);
    gameBoardSpy.getBoardHeight.and.returnValue(8);
    gameStateSpy = jasmine.createSpyObj<GameStateService>('GameStateService', [
      'setMaxWaves', 'restoreFromCheckpoint', 'getState',
    ]);
    gameStateSpy.getState.and.returnValue({ phase: GamePhase.SETUP, wave: 0, isEndless: false } as ReturnType<GameStateService['getState']>);
    waveSpy = jasmine.createSpyObj<WaveService>('WaveService', ['restoreState', 'setCustomWaves']);
    enemySpy = jasmine.createSpyObj<EnemyService>('EnemyService', [
      'repathAffectedEnemies', 'restoreEnemies', 'updateHealthBars',
    ]);
    towerCombatSpy = jasmine.createSpyObj<TowerCombatService>(
      'TowerCombatService', ['restoreTowers', 'restoreMortarZones'],
    );
    gameStatsSpy = jasmine.createSpyObj<GameStatsService>('GameStatsService', ['restoreFromCheckpoint']);
    statusEffectSpy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['restoreEffects']);
    challengeTrackingSpy = jasmine.createSpyObj<ChallengeTrackingService>(
      'ChallengeTrackingService', ['restoreFromCheckpoint'],
    );
    gameSessionSpy = jasmine.createSpyObj<GameSessionService>('GameSessionService', ['resetAllServices']);
    meshRegistrySpy = jasmine.createSpyObj<BoardMeshRegistryService>(
      'BoardMeshRegistryService',
      ['translateTileMesh', 'rebuildTowerChildrenArray'],
      { towerMeshes: new Map() },
    );
    towerMeshFactorySpy = jasmine.createSpyObj<TowerMeshFactoryService>('TowerMeshFactoryService', ['createTowerMesh']);
    enemyMeshFactorySpy = jasmine.createSpyObj<EnemyMeshFactoryService>('EnemyMeshFactoryService', ['createEnemyMesh']);
    combatLoopSpy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['setTurnNumber', 'setLeakedThisWave']);
    challengeDisplaySpy = jasmine.createSpyObj<ChallengeDisplayService>(
      'ChallengeDisplayService', ['updateIndicators'], { indicators: [] },
    );
    ascensionSpy = jasmine.createSpyObj<AscensionModifierService>('AscensionModifierService', ['apply']);
    turnHistorySpy = jasmine.createSpyObj<TurnHistoryService>('TurnHistoryService', ['restore']);
    wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>('WavePreviewService', ['restore']);
    pathMutationSpy = jasmine.createSpyObj<PathMutationService>('PathMutationService', ['restore', 'swapMesh']);
    elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', ['restore', 'restoreCliffMeshes']);
    towerGraphSpy = jasmine.createSpyObj<TowerGraphService>('TowerGraphService', ['rebuild', 'restore']);
    spawnPreviewSpy = jasmine.createSpyObj<SpawnPreviewViewService>('SpawnPreviewViewService', ['refreshFor']);
    itemSpy = jasmine.createSpyObj<ItemService>('ItemService', ['restore']);
    runStateFlagSpy = jasmine.createSpyObj<RunStateFlagService>('RunStateFlagService', ['restore']);
    relicSpy = jasmine.createSpyObj<RelicService>('RelicService', ['restoreEncounterFlags']);
    cardEffectSpy = jasmine.createSpyObj<CardEffectService>('CardEffectService', ['restoreModifiers']);
    deckSpy = jasmine.createSpyObj<DeckService>('DeckService', ['restoreState', 'setRngState']);

    service = new CheckpointRestoreCoordinatorService(
      encounterCheckpointSpy, runSpy, sceneSpy, gameBoardSpy, gameStateSpy, waveSpy,
      enemySpy, towerCombatSpy, gameStatsSpy, statusEffectSpy, challengeTrackingSpy,
      gameSessionSpy, meshRegistrySpy, towerMeshFactorySpy, enemyMeshFactorySpy,
      combatLoopSpy, challengeDisplaySpy, ascensionSpy, turnHistorySpy, wavePreviewSpy,
      pathMutationSpy, elevationSpy, towerGraphSpy, spawnPreviewSpy, itemSpy,
      runStateFlagSpy, relicSpy, cardEffectSpy, deckSpy,
    );
  });

  it('falls back when no checkpoint is present', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(null);
    const onFallback = jasmine.createSpy('onFallback');
    service.restore({ onFallback });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(runSpy.isRestoringCheckpoint).toBe(false);
    // Did NOT touch any restore service when no checkpoint
    expect(deckSpy.restoreState).not.toHaveBeenCalled();
  });

  it('runs the full restore on the happy path', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint());
    service.restore({ onFallback: () => {} });
    expect(runSpy.restoreRngState).toHaveBeenCalledWith(1);
    expect(combatLoopSpy.setTurnNumber).toHaveBeenCalledWith(3);
    expect(deckSpy.restoreState).toHaveBeenCalled();
    expect(gameStateSpy.restoreFromCheckpoint).toHaveBeenCalled();
    expect(encounterCheckpointSpy.clearCheckpoint).toHaveBeenCalled();
    expect(runSpy.isRestoringCheckpoint).toBe(false);
    expect(challengeDisplaySpy.updateIndicators).toHaveBeenCalledWith('forest');
  });

  it('skips deck.setRngState when deckRngState is undefined (pre-v4 migration)', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(
      makeCheckpoint({ deckRngState: undefined }),
    );
    service.restore({ onFallback: () => {} });
    expect(deckSpy.restoreState).toHaveBeenCalled();
    expect(deckSpy.setRngState).not.toHaveBeenCalled();
  });

  it('calls deck.setRngState when deckRngState is present (v4+)', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(
      makeCheckpoint({ deckRngState: 42 }),
    );
    service.restore({ onFallback: () => {} });
    expect(deckSpy.setRngState).toHaveBeenCalledWith(42);
  });

  it('seeds spawn preview when restored phase is COMBAT', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint());
    gameStateSpy.getState.and.returnValue(
      { phase: GamePhase.COMBAT, wave: 1, isEndless: false } as ReturnType<GameStateService['getState']>,
    );
    service.restore({ onFallback: () => {} });
    expect(spawnPreviewSpy.refreshFor).toHaveBeenCalled();
  });

  it('skips spawn preview seed for SETUP / VICTORY / DEFEAT phases', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint());
    gameStateSpy.getState.and.returnValue(
      { phase: GamePhase.VICTORY, wave: 1, isEndless: false } as ReturnType<GameStateService['getState']>,
    );
    service.restore({ onFallback: () => {} });
    expect(spawnPreviewSpy.refreshFor).not.toHaveBeenCalled();
  });

  it('falls back via gameSession reset + onFallback when restore throws', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint());
    pathMutationSpy.restore.and.throwError('boom');
    spyOn(console, 'error');
    const onFallback = jasmine.createSpy('onFallback');
    service.restore({ onFallback });
    expect(gameSessionSpy.resetAllServices).toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(runSpy.isRestoringCheckpoint).toBe(false);
    expect(encounterCheckpointSpy.clearCheckpoint).toHaveBeenCalled();
  });

  it('rebuilds tower graph and restores graph overlay (Step 4.5 + 4.6)', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint());
    const order: string[] = [];
    towerGraphSpy.rebuild.and.callFake(() => { order.push('rebuild'); });
    towerGraphSpy.restore.and.callFake(() => { order.push('restore'); });
    service.restore({ onFallback: () => {} });
    expect(order).toEqual(['rebuild', 'restore']);
  });

  it('preserves Step 15 ordering: setMaxWaves before gameState restoreFromCheckpoint', () => {
    encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint());
    const order: string[] = [];
    gameStateSpy.setMaxWaves.and.callFake(() => { order.push('setMaxWaves'); });
    gameStateSpy.restoreFromCheckpoint.and.callFake(() => { order.push('restoreFromCheckpoint'); });
    service.restore({ onFallback: () => {} });
    // setMaxWaves (Step 15) must run BEFORE gameState.restoreFromCheckpoint (Step 17)
    expect(order.indexOf('setMaxWaves'))
      .toBeLessThan(order.indexOf('restoreFromCheckpoint'));
  });

  // ─── Step 3.5: path-mutation replay loop ───────────────────────────────────

  describe('Step 3.5 — path-mutation replay', () => {
    /**
     * BlockType is a const enum exported from game-board-tile.ts:
     *   BASE = 0, EXIT = 1, SPAWNER = 2, TOWER = 3, WALL = 4
     * The coordinator imports BlockType from there; the spec mirrors the
     * raw values to avoid a duplicate const-enum import.
     */
    const BLOCK_BASE = 0;
    const BLOCK_WALL = 4;

    function makeMutation(op: string, row: number, col: number, priorType = BLOCK_BASE) {
      return {
        id: `m-${row}-${col}`,
        op,
        row,
        col,
        appliedOnTurn: 1,
        expiresOnTurn: null,
        priorType,
        source: 'card',
        sourceId: 'TEST',
      };
    }

    it("maps op 'build' to BlockType.BASE on setTileType", () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [makeMutation('build', 2, 3)], nextId: 1 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(gameBoardSpy.setTileType).toHaveBeenCalledWith(2, 3, BLOCK_BASE, 'build', BLOCK_BASE);
    });

    it("maps op 'block' to BlockType.WALL on setTileType", () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [makeMutation('block', 4, 5)], nextId: 1 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(gameBoardSpy.setTileType).toHaveBeenCalledWith(4, 5, BLOCK_WALL, 'block', BLOCK_BASE);
    });

    it("maps op 'destroy' to BlockType.WALL on setTileType", () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [makeMutation('destroy', 6, 7)], nextId: 1 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(gameBoardSpy.setTileType).toHaveBeenCalledWith(6, 7, BLOCK_WALL, 'destroy', BLOCK_BASE);
    });

    it("maps op 'bridgehead' to BlockType.WALL on setTileType", () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [makeMutation('bridgehead', 8, 9)], nextId: 1 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(gameBoardSpy.setTileType).toHaveBeenCalledWith(8, 9, BLOCK_WALL, 'bridgehead', BLOCK_BASE);
    });

    it('forwards priorType from the mutation entry to setTileType', () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [makeMutation('block', 1, 2, BLOCK_WALL)], nextId: 1 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(gameBoardSpy.setTileType).toHaveBeenCalledWith(1, 2, BLOCK_WALL, 'block', BLOCK_WALL);
    });

    it('swaps the tile mesh with the same target type used for setTileType', () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [makeMutation('build', 2, 3)], nextId: 1 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      // swapMesh receives the SAME targetType derived from op (build → BASE).
      expect(pathMutationSpy.swapMesh).toHaveBeenCalledWith(2, 3, BLOCK_BASE, jasmine.any(Object));
    });

    it('replays mutations in the order stored in the journal', () => {
      const order: number[] = [];
      gameBoardSpy.setTileType.and.callFake((r: number) => { order.push(r); return null; });
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: {
          mutations: [
            makeMutation('build', 1, 1),
            makeMutation('block', 2, 2),
            makeMutation('destroy', 3, 3),
          ],
          nextId: 3,
        } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(order).toEqual([1, 2, 3]);
    });

    it('invalidates the path cache exactly once after replaying mutations', () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: {
          mutations: [makeMutation('build', 1, 1), makeMutation('block', 2, 2)],
          nextId: 2,
        } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(enemySpy.repathAffectedEnemies).toHaveBeenCalledTimes(1);
      expect(enemySpy.repathAffectedEnemies).toHaveBeenCalledWith(-1, -1);
    });

    it('skips repath when the mutation list is empty', () => {
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        pathMutations: { mutations: [], nextId: 0 } as unknown as EncounterCheckpoint['pathMutations'],
      }));
      service.restore({ onFallback: () => {} });
      expect(enemySpy.repathAffectedEnemies).not.toHaveBeenCalled();
    });
  });

  // ─── Step 4: tower restoration loop (incl. elevation Y fixup) ──────────────

  describe('Step 4 — tower restoration', () => {
    function makeTower(id: string, row: number, col: number) {
      return {
        id,
        type: TowerType.BASIC,
        level: 1,
        row,
        col,
        kills: 0,
        totalInvested: 50,
        targetingMode: 'FIRST',
      };
    }

    it('creates a mesh, adds it to the scene, and registers it on the registry', () => {
      const tower = makeTower('t1', 3, 4);
      const fakeMesh = new THREE.Group();
      towerMeshFactorySpy.createTowerMesh.and.returnValue(fakeMesh);
      const scene = new THREE.Scene();
      sceneSpy.getScene.and.returnValue(scene);
      spyOn(scene, 'add').and.callThrough();

      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: [tower] as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });

      expect(towerMeshFactorySpy.createTowerMesh).toHaveBeenCalledWith(3, 4, TowerType.BASIC, 8, 8);
      expect(scene.add).toHaveBeenCalledWith(fakeMesh);
      expect(meshRegistrySpy.towerMeshes.get('t1')).toBe(fakeMesh);
    });

    it('marks the board tile as occupied via forceSetTower (bypasses BFS)', () => {
      const tower = makeTower('t1', 5, 6);
      towerMeshFactorySpy.createTowerMesh.and.returnValue(new THREE.Group());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: [tower] as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });
      expect(gameBoardSpy.forceSetTower).toHaveBeenCalledWith(5, 6, TowerType.BASIC);
    });

    it('passes ALL towers to TowerCombatService.restoreTowers in one call', () => {
      const towers = [makeTower('t1', 1, 1), makeTower('t2', 2, 2)];
      towerMeshFactorySpy.createTowerMesh.and.callFake(() => new THREE.Group());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: towers as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });
      expect(towerCombatSpy.restoreTowers).toHaveBeenCalledTimes(1);
      const [restoredTowers, meshMap] = towerCombatSpy.restoreTowers.calls.mostRecent().args;
      expect(restoredTowers).toEqual(towers as unknown as Parameters<typeof towerCombatSpy.restoreTowers>[0]);
      expect(meshMap.size).toBe(2);
    });

    it('rebuilds the tower-children array after restoreTowers', () => {
      const order: string[] = [];
      towerCombatSpy.restoreTowers.and.callFake(() => { order.push('restoreTowers'); });
      meshRegistrySpy.rebuildTowerChildrenArray.and.callFake(() => { order.push('rebuildChildren'); });

      const tower = makeTower('t1', 0, 0);
      towerMeshFactorySpy.createTowerMesh.and.returnValue(new THREE.Group());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: [tower] as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });
      expect(order).toEqual(['restoreTowers', 'rebuildChildren']);
    });

    it('does NOT shift mesh.position.y when the underlying tile elevation is 0', () => {
      const tower = makeTower('t1', 1, 1);
      const mesh = new THREE.Group();
      mesh.position.y = 0.5;  // arbitrary baseline from createTowerMesh
      towerMeshFactorySpy.createTowerMesh.and.returnValue(mesh);
      gameBoardSpy.getGameBoard.and.returnValue(
        [[{ elevation: 0 }, { elevation: 0 }], [{ elevation: 0 }, { elevation: 0 }]] as unknown as ReturnType<GameBoardService['getGameBoard']>,
      );
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: [tower] as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });
      // Y unchanged from the factory's default.
      expect(mesh.position.y).toBe(0.5);
    });

    it('shifts mesh.position.y by elevation + tileHeight when the tile is raised (the audit-flagged fixup)', () => {
      const tower = makeTower('t1', 1, 1);
      const mesh = new THREE.Group();
      mesh.position.y = 0.5;
      towerMeshFactorySpy.createTowerMesh.and.returnValue(mesh);
      gameBoardSpy.getGameBoard.and.returnValue(
        [[{ elevation: 0 }, { elevation: 0 }], [{ elevation: 0 }, { elevation: 2 }]] as unknown as ReturnType<GameBoardService['getGameBoard']>,
      );
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: [tower] as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });
      // BOARD_CONFIG.tileHeight = 0.2 → expected Y = 2 + 0.2 = 2.2
      expect(mesh.position.y).toBeCloseTo(2.2, 5);
    });

    it('treats a missing board snapshot row/col gracefully (elevation defaults to 0)', () => {
      const tower = makeTower('t1', 99, 99);  // out of bounds
      const mesh = new THREE.Group();
      mesh.position.y = 0.5;
      towerMeshFactorySpy.createTowerMesh.and.returnValue(mesh);
      gameBoardSpy.getGameBoard.and.returnValue([[{ elevation: 0 }]] as unknown as ReturnType<GameBoardService['getGameBoard']>);
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        towers: [tower] as unknown as EncounterCheckpoint['towers'],
      }));
      service.restore({ onFallback: () => {} });
      // Out-of-range lookup → elevation 0 → Y not shifted.
      expect(mesh.position.y).toBe(0.5);
    });
  });

  // ─── Step 6: enemy restoration loop ───────────────────────────────────────

  describe('Step 6 — enemy restoration', () => {
    function makeEnemy(id: string) {
      return {
        id,
        type: 'BASIC',
        position: { x: 0, y: 0, z: 0 },
        gridPosition: { row: 0, col: 0 },
        health: 10,
        maxHealth: 10,
        speed: 1,
        value: 5,
        path: [
          { x: 0, y: 0, f: 1, g: 1, h: 0 },
          { x: 1, y: 0, f: 2, g: 2, h: 0 },
        ],
        pathIndex: 0,
        distanceTraveled: 0,
        leakDamage: 1,
      };
    }

    it('passes a parent-stripped enemy with cleared mesh / particle fields to the mesh factory', () => {
      const enemy = makeEnemy('e1');
      enemyMeshFactorySpy.createEnemyMesh.and.callFake(() => new THREE.Mesh());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        enemies: [enemy] as unknown as EncounterCheckpoint['enemies'],
      }));
      service.restore({ onFallback: () => {} });

      expect(enemyMeshFactorySpy.createEnemyMesh).toHaveBeenCalledTimes(1);
      const [tempEnemy] = enemyMeshFactorySpy.createEnemyMesh.calls.mostRecent().args as unknown as [{
        id: string;
        path: Array<{ parent?: unknown }>;
        mesh: unknown;
        statusParticles: unknown[];
        statusParticleEffectType: unknown;
      }];
      expect(tempEnemy.id).toBe('e1');
      expect(tempEnemy.mesh).toBeUndefined();
      expect(tempEnemy.statusParticles).toEqual([]);
      expect(tempEnemy.statusParticleEffectType).toBeUndefined();
      // Every path node gets parent: undefined to break the circular reference
      // the live A* graph would otherwise hold.
      expect(tempEnemy.path.length).toBe(2);
      for (const node of tempEnemy.path) {
        expect(node.parent).toBeUndefined();
      }
    });

    it('adds each enemy mesh to the scene', () => {
      const enemies = [makeEnemy('e1'), makeEnemy('e2'), makeEnemy('e3')];
      enemyMeshFactorySpy.createEnemyMesh.and.callFake(() => new THREE.Mesh());
      const scene = new THREE.Scene();
      sceneSpy.getScene.and.returnValue(scene);
      spyOn(scene, 'add').and.callThrough();
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        enemies: enemies as unknown as EncounterCheckpoint['enemies'],
      }));
      service.restore({ onFallback: () => {} });
      // 3 enemy meshes (scene.add is also called for tower meshes if any, so check ≥ 3).
      expect((scene.add as jasmine.Spy).calls.count()).toBeGreaterThanOrEqual(3);
    });

    it('passes ALL enemies plus the enemyCounter to EnemyService.restoreEnemies', () => {
      const enemies = [makeEnemy('e1'), makeEnemy('e2')];
      enemyMeshFactorySpy.createEnemyMesh.and.callFake(() => new THREE.Mesh());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        enemies: enemies as unknown as EncounterCheckpoint['enemies'],
        enemyCounter: 42,
      }));
      service.restore({ onFallback: () => {} });
      expect(enemySpy.restoreEnemies).toHaveBeenCalledTimes(1);
      const [restoredEnemies, meshMap, counter] = enemySpy.restoreEnemies.calls.mostRecent().args;
      expect(restoredEnemies).toEqual(enemies as unknown as Parameters<typeof enemySpy.restoreEnemies>[0]);
      expect(meshMap.size).toBe(2);
      expect(counter).toBe(42);
    });

    it('updates enemy health bars only when a camera is present', () => {
      enemyMeshFactorySpy.createEnemyMesh.and.callFake(() => new THREE.Mesh());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        enemies: [makeEnemy('e1')] as unknown as EncounterCheckpoint['enemies'],
      }));
      // Default beforeEach: getCamera returns null → updateHealthBars NOT called.
      service.restore({ onFallback: () => {} });
      expect(enemySpy.updateHealthBars).not.toHaveBeenCalled();
    });

    it('updates enemy health bars with the camera quaternion when camera is present', () => {
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      sceneSpy.getCamera.and.returnValue(camera);
      enemyMeshFactorySpy.createEnemyMesh.and.callFake(() => new THREE.Mesh());
      encounterCheckpointSpy.loadCheckpoint.and.returnValue(makeCheckpoint({
        enemies: [makeEnemy('e1')] as unknown as EncounterCheckpoint['enemies'],
      }));
      service.restore({ onFallback: () => {} });
      expect(enemySpy.updateHealthBars).toHaveBeenCalledWith(camera.quaternion);
    });
  });
});
