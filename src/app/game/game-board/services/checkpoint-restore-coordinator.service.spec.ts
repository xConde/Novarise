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
});
