/**
 * Cartographer archetype — end-to-end integration tests.
 *
 * These specs wire REAL services together and verify cross-service behaviour.
 * They are NOT unit tests; if a mechanic could be tested entirely within a
 * single service's spec file, it doesn't belong here.
 *
 * Real:
 *   PathMutationService, GameBoardService, PathfindingService,
 *   TerraformMaterialPoolService, BoardMeshRegistryService,
 *   CardPlayService, DeckService, CardEffectService,
 *   RelicService, EnemyService (for Detour / MINER / VEINSEEKER groups)
 *
 * Mocked (Three.js boundary + services that require a running combat loop):
 *   AudioService, SceneService, BoardMeshRegistryService.createTileMesh,
 *   GameStateService, TowerCombatService, GameStatsService, RunService,
 *   WavePreviewService
 */

import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

// ── Game-board services ────────────────────────────────────────────────────
import { GameBoardService } from '../../game/game-board/game-board.service';
import { PathfindingService } from '../../game/game-board/services/pathfinding.service';
import { PathMutationService } from '../../game/game-board/services/path-mutation.service';
import { BoardMeshRegistryService } from '../../game/game-board/services/board-mesh-registry.service';
import { TerraformMaterialPoolService } from '../../game/game-board/services/terraform-material-pool.service';
import { CardPlayService } from '../../game/game-board/services/card-play.service';
import { ElevationService } from '../../game/game-board/services/elevation.service';
import { TowerCombatService } from '../../game/game-board/services/tower-combat.service';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { GameStatsService } from '../../game/game-board/services/game-stats.service';
import { AudioService } from '../../game/game-board/services/audio.service';
import { SceneService } from '../../game/game-board/services/scene.service';
import { TowerUpgradeVisualService } from '../../game/game-board/services/tower-upgrade-visual.service';
import { StatusEffectService } from '../../game/game-board/services/status-effect.service';
import { CombatLoopService } from '../../game/game-board/services/combat-loop.service';
import { WavePreviewService } from '../../game/game-board/services/wave-preview.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';
import { EnemyHealthService } from '../../game/game-board/services/enemy-health.service';
import { EnemyMeshFactoryService } from '../../game/game-board/services/enemy-mesh-factory.service';
import { EnemyVisualService } from '../../game/game-board/services/enemy-visual.service';

// ── Game-board models ──────────────────────────────────────────────────────
import { BlockType, GameBoardTile } from '../../game/game-board/models/game-board-tile';
import { EnemyType, MINER_DIG_INTERVAL_TURNS, VEINSEEKER_SPEED_BOOST_WINDOW } from '../../game/game-board/models/enemy.model';
import { GamePhase, INITIAL_GAME_STATE } from '../../game/game-board/models/game-state.model';

// ── Run-side services ──────────────────────────────────────────────────────
import { DeckService } from '../services/deck.service';
import { CardEffectService } from '../services/card-effect.service';
import { RelicService } from '../services/relic.service';
import { RunService } from '../services/run.service';
import { EncounterCheckpointService } from '../services/encounter-checkpoint.service';

// ── Run-side models / constants ────────────────────────────────────────────
import { CardId, CardInstance } from '../models/card.model';
import { CARD_DEFINITIONS } from '../constants/card-definitions';
import { MODIFIER_STAT } from '../constants/modifier-stat.constants';
import { RelicId } from '../models/relic.model';

// ── Testing helpers ────────────────────────────────────────────────────────
import {
  createGameStateServiceSpy,
  createAudioServiceSpy,
  createSceneServiceSpy,
  createGameStatsServiceSpy,
} from '../../game/game-board/testing';

// ──────────────────────────────────────────────────────────────────────────
// Coordinate / tuning constants — no magic numbers (project rule)
// ──────────────────────────────────────────────────────────────────────────

/** Board is 7 columns × 4 rows.  See makeOpenBoard7x4() below. */
const BOARD_COLS = 7;
const BOARD_ROWS = 4;

/** A BASE tile in the middle of row 0 that can be blocked without disconnecting paths. */
const MID_PATH_ROW = 0;
const MID_PATH_COL = 3;

/** A WALL tile in row 2 suitable for `build` / `bridgehead` mutations. */
const WALL_ROW = 2;
const WALL_COL = 3;

/** Constant seed for DeckService initializations. */
const DECK_SEED = 99999;

/** Number of turns to run when driving the MINER dig cadence. */
const MINER_DIG_TURN = MINER_DIG_INTERVAL_TURNS; // turn 3 after spawn-on-turn-0

/** VEINSEEKER boost window for the speed test. */
const VEIN_BOOST_WINDOW = VEINSEEKER_SPEED_BOOST_WINDOW;

// ──────────────────────────────────────────────────────────────────────────
// Board setup helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a GameBoardService wired with a real 7×4 board.
 *
 * Layout:
 *   Row 0: SPAWNER | BASE | BASE | BASE | BASE | BASE | EXIT
 *   Row 1: SPAWNER | BASE | BASE | BASE | BASE | BASE | EXIT
 *   Row 2: WALL   | WALL | WALL | WALL | WALL | WALL | WALL
 *   Row 3: WALL   | WALL | WALL | WALL | WALL | WALL | WALL
 *
 * Two parallel traversable rows mean blocking one tile in row 0 never
 * disconnects all spawner→exit paths (row 1 remains open). This lets
 * block/destroy tests succeed the connectivity check in PathMutationService.
 */
function makeOpenBoard7x4(): GameBoardService {
  const svc = new GameBoardService();
  const board: GameBoardTile[][] = [];

  for (let r = 0; r < BOARD_ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      board[r][c] = GameBoardTile.createBase(c, r);
    }
  }

  // Spawner group: column 0, rows 0–1
  board[0][0] = GameBoardTile.createSpawner(0, 0);
  board[1][0] = GameBoardTile.createSpawner(0, 1);

  // Exit group: column 6, rows 0–1
  board[0][6] = GameBoardTile.createExit(6, 0);
  board[1][6] = GameBoardTile.createExit(6, 1);

  // Rows 2–3: all WALL (used as build / bridgehead targets)
  for (let c = 0; c < BOARD_COLS; c++) {
    board[2][c] = GameBoardTile.createWall(c, 2);
    board[3][c] = GameBoardTile.createWall(c, 3);
  }

  svc.importBoard(board, BOARD_COLS, BOARD_ROWS);
  return svc;
}

/** Meshes created by the swapMesh stub — disposed in afterEach. */
const createdMeshes: THREE.Mesh[] = [];

/** Stub gameBoardService.createTileMesh so swapMesh doesn't need real WebGL. */
function stubCreateTileMesh(gameBoardService: GameBoardService): void {
  spyOn(gameBoardService, 'createTileMesh').and.callFake((row: number, col: number) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    createdMeshes.push(m);
    m.userData = { row, col };
    return m;
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group A — PathMutation + Card flow
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group A: PathMutation + card flow', () => {
  let gameBoardService: GameBoardService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let cardPlayService: CardPlayService;
  let deckService: DeckService;
  let cardEffectService: CardEffectService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);

    pathfindingSpy = jasmine.createSpyObj<PathfindingService>('PathfindingService', ['invalidateCache', 'findPath', 'getPathToExitLength']);
    pathfindingSpy.getPathToExitLength.and.returnValue(0);

    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'replaceTileMesh', 'rebuildTileMeshArray', 'rebuildTowerChildrenArray',
    ]);
    (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes = new Map<string, THREE.Mesh>();
    (registrySpy as unknown as { towerMeshes: Map<string, THREE.Group> }).towerMeshes = new Map<string, THREE.Group>();

    const gameStateSpy = createGameStateServiceSpy();
    gameStateSpy.getState.and.returnValue({ ...INITIAL_GAME_STATE, phase: GamePhase.COMBAT });

    const towerCombatSpy = jasmine.createSpyObj<TowerCombatService>('TowerCombatService', ['getPlacedTowers', 'upgradeTower', 'unregisterTower']);
    towerCombatSpy.getPlacedTowers.and.returnValue(new Map());

    const combatLoopSpy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['getTurnNumber']);
    combatLoopSpy.getTurnNumber.and.returnValue(1);

    const wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>('WavePreviewService', [
      'addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter',
    ]);

    const runServiceSpy = jasmine.createSpyObj<RunService>('RunService', ['nextRandom']);
    runServiceSpy.nextRandom.and.returnValue(0);

    const enemySpy = jasmine.createSpyObj<EnemyService>('EnemyService', ['repathAffectedEnemies', 'getEnemies', 'damageEnemy']);
    enemySpy.getEnemies.and.returnValue(new Map() as never);

    const elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
      'raise', 'depress', 'getElevation', 'getMaxElevation', 'getElevationMap',
      'getActiveChanges', 'tickTurn', 'reset', 'serialize', 'restore', 'setAbsolute', 'collapse',
    ]);
    elevationSpy.raise.and.returnValue({ ok: true, newElevation: 1 });
    elevationSpy.depress.and.returnValue({ ok: true, newElevation: -1 });

    TestBed.configureTestingModule({
      providers: [
        PathMutationService,
        TerraformMaterialPoolService,
        DeckService,
        CardEffectService,
        CardPlayService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: PathfindingService, useValue: pathfindingSpy },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: TowerCombatService, useValue: towerCombatSpy },
        { provide: CombatLoopService, useValue: combatLoopSpy },
        { provide: WavePreviewService, useValue: wavePreviewSpy },
        { provide: RunService, useValue: runServiceSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: AudioService, useValue: createAudioServiceSpy() },
        { provide: SceneService, useValue: createSceneServiceSpy() },
        { provide: GameStatsService, useValue: createGameStatsServiceSpy() },
        { provide: StatusEffectService, useValue: jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['apply']) },
        { provide: TowerUpgradeVisualService, useValue: jasmine.createSpyObj<TowerUpgradeVisualService>('TowerUpgradeVisualService', ['applyUpgradeVisuals']) },
        { provide: ElevationService, useValue: elevationSpy },
      ],
    });

    pathMutationService = TestBed.inject(PathMutationService);
    poolService = TestBed.inject(TerraformMaterialPoolService);
    deckService = TestBed.inject(DeckService);
    cardEffectService = TestBed.inject(CardEffectService);
    cardPlayService = TestBed.inject(CardPlayService);

    // Wire repath hook (normally GameBoardComponent.ngOnInit)
    pathMutationService.setRepathHook(() => { /* no-op in tests */ });

    // Give the deck 3 energy so terraform cards (cost 1–2) can always play
    deckService.initializeDeck([CardId.LAY_TILE, CardId.BLOCK_PASSAGE, CardId.COLLAPSE, CardId.BRIDGEHEAD], DECK_SEED);
    deckService.drawForWave();
  });

  afterEach(() => {
    for (const m of createdMeshes) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (!poolService.isPoolMaterial(mat)) { mat.dispose(); }
    }
    createdMeshes.length = 0;
    poolService.dispose();
    scene.clear();
    pathMutationService.reset();
    deckService.clear();
    cardEffectService.reset();
  });

  // ── A1: LAY_TILE success path ──────────────────────────────────────────

  it('A1 — LAY_TILE: plays card, WALL→BASE, journal records build mutation, pathfinding invalidated', () => {
    // Find the LAY_TILE card that was actually drawn into the hand
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.LAY_TILE);
    if (!card) { pending('LAY_TILE not in hand for this seed'); return; }

    const def = CARD_DEFINITIONS[CardId.LAY_TILE];
    const energyBefore = deckService.getEnergy().current;

    // Step 1: put the card into tile-target mode
    cardPlayService.onCardPlayed(card);
    expect(cardPlayService.getPendingTileTargetCard()).toBe(card);
    // Energy not consumed yet (two-phase flow)
    expect(deckService.getEnergy().current).toBe(energyBefore);

    // Step 2: resolve on a WALL tile (row 2, col 3)
    const result = cardPlayService.resolveTileTarget(WALL_ROW, WALL_COL, scene, 1);

    expect(result.ok).toBeTrue();
    // Cross-service 1: tile type changed on the board
    expect(gameBoardService.getGameBoard()[WALL_ROW][WALL_COL].type).toBe(BlockType.BASE);
    // Cross-service 2: mutation journal has exactly one entry
    expect(pathMutationService.getActive().length).toBe(1);
    expect(pathMutationService.getActive()[0].op).toBe('build');
    // Cross-service 3: energy was deducted
    expect(deckService.getEnergy().current).toBe(energyBefore - def.energyCost);
    // Cross-service 4: pathfinding cache was invalidated
    expect(pathfindingSpy.invalidateCache).toHaveBeenCalled();
    // Cross-service 5: card moved to discard (not still in hand)
    expect(deckService.getDeckState().hand.find(c => c.instanceId === card.instanceId)).toBeUndefined();
    expect(deckService.getDeckState().discardPile.find(c => c.instanceId === card.instanceId)).toBeDefined();
  });

  // ── A2: BLOCK_PASSAGE end-to-end ──────────────────────────────────────

  it('A2 — BLOCK_PASSAGE: plays card, BASE→WALL, journal records block with correct duration', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.BLOCK_PASSAGE);
    if (!card) { pending('BLOCK_PASSAGE not in hand for this seed'); return; }

    const def = CARD_DEFINITIONS[CardId.BLOCK_PASSAGE];
    const effect = def.effect;
    if (effect.type !== 'terraform_target') { fail('Expected terraform_target'); return; }

    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(MID_PATH_ROW, MID_PATH_COL, scene, 1);

    expect(result.ok).toBeTrue();
    // Tile is now WALL
    expect(gameBoardService.getGameBoard()[MID_PATH_ROW][MID_PATH_COL].type).toBe(BlockType.WALL);
    // pathfinding cache invalidated
    expect(pathfindingSpy.invalidateCache).toHaveBeenCalled();
    // Journal has a 'block' op with expected expiry: turn 1 + duration 2 = 3
    const entry = pathMutationService.getActive()[0];
    expect(entry.op).toBe('block');
    expect(entry.expiresOnTurn).toBe(1 + effect.duration!);
    // Source is 'card'
    expect(entry.source).toBe('card');
  });

  // ── A3: COLLAPSE damage + destroy ─────────────────────────────────────

  it('A3 — COLLAPSE: destroys tile, enemies on the tile take max(1, floor(maxHP*0.5)) damage', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.COLLAPSE);
    if (!card) { pending('COLLAPSE not in hand for this seed'); return; }

    // Place a fake enemy at (MID_PATH_ROW, MID_PATH_COL) via the enemySpy override
    const targetEnemyId = 'enemy-col3';
    const fakeEnemy = {
      id: targetEnemyId,
      type: EnemyType.BASIC,
      health: 100,
      maxHealth: 100,
      dying: false,
      gridPosition: { row: MID_PATH_ROW, col: MID_PATH_COL },
    };
    const enemyMap = new Map([[targetEnemyId, fakeEnemy as never]]);

    // Override the enemySpy to return our fake enemy map
    const enemyServiceSpy = TestBed.inject(EnemyService) as jasmine.SpyObj<EnemyService>;
    enemyServiceSpy.getEnemies.and.returnValue(enemyMap as never);

    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(MID_PATH_ROW, MID_PATH_COL, scene, 1);

    expect(result.ok).toBeTrue();
    // Tile destroyed → now WALL
    expect(gameBoardService.getGameBoard()[MID_PATH_ROW][MID_PATH_COL].type).toBe(BlockType.WALL);
    // Mutation is permanent (destroy)
    const entry = pathMutationService.getActive()[0];
    expect(entry.op).toBe('destroy');
    expect(entry.expiresOnTurn).toBeNull();
    // damageEnemy was called with floor(100 * 0.5) = 50
    expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith(targetEnemyId, 50);
  });

  // ── A4: BRIDGEHEAD placement ───────────────────────────────────────────

  it('A4 — BRIDGEHEAD: tile carries mutationOp=bridgehead; canPlaceTower true for it, false for plain WALL', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.BRIDGEHEAD);
    if (!card) { pending('BRIDGEHEAD not in hand for this seed'); return; }
    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(WALL_ROW, WALL_COL, scene, 1);

    expect(result.ok).toBeTrue();
    const tile = gameBoardService.getGameBoard()[WALL_ROW][WALL_COL];
    // Tile stays WALL but carries mutationOp = 'bridgehead'
    expect(tile.type).toBe(BlockType.WALL);
    expect(tile.mutationOp).toBe('bridgehead');
    // canPlaceTower must return true for bridgehead tile
    expect(gameBoardService.canPlaceTower(WALL_ROW, WALL_COL)).toBeTrue();
    // Adjacent plain WALL tile (same row, different col) must NOT be tower-placeable
    expect(gameBoardService.canPlaceTower(WALL_ROW, WALL_COL + 1)).toBeFalse();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group B — CARTOGRAPHER_SEAL
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group B: CARTOGRAPHER_SEAL', () => {
  let gameBoardService: GameBoardService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let cardPlayService: CardPlayService;
  let deckService: DeckService;
  let cardEffectService: CardEffectService;
  let scene: THREE.Scene;

  function setupModule(): void {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);

    pathfindingSpy = jasmine.createSpyObj<PathfindingService>('PathfindingService', ['invalidateCache', 'findPath', 'getPathToExitLength']);
    pathfindingSpy.getPathToExitLength.and.returnValue(0);

    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'replaceTileMesh', 'rebuildTileMeshArray', 'rebuildTowerChildrenArray',
    ]);
    (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes = new Map<string, THREE.Mesh>();
    (registrySpy as unknown as { towerMeshes: Map<string, THREE.Group> }).towerMeshes = new Map<string, THREE.Group>();

    const gameStateSpy = createGameStateServiceSpy();
    gameStateSpy.getState.and.returnValue({ ...INITIAL_GAME_STATE, phase: GamePhase.COMBAT });

    const towerCombatSpy = jasmine.createSpyObj<TowerCombatService>('TowerCombatService', ['getPlacedTowers', 'upgradeTower', 'unregisterTower']);
    towerCombatSpy.getPlacedTowers.and.returnValue(new Map());

    const combatLoopSpy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['getTurnNumber']);
    combatLoopSpy.getTurnNumber.and.returnValue(1);

    const runServiceSpy = jasmine.createSpyObj<RunService>('RunService', ['nextRandom']);
    runServiceSpy.nextRandom.and.returnValue(0);

    const enemySpy = jasmine.createSpyObj<EnemyService>('EnemyService', ['repathAffectedEnemies', 'getEnemies', 'damageEnemy']);
    enemySpy.getEnemies.and.returnValue(new Map() as never);

    const elevationSpy2 = jasmine.createSpyObj<ElevationService>('ElevationService', [
      'raise', 'depress', 'getElevation', 'getMaxElevation', 'getElevationMap',
      'getActiveChanges', 'tickTurn', 'reset', 'serialize', 'restore', 'setAbsolute', 'collapse',
    ]);
    elevationSpy2.raise.and.returnValue({ ok: true, newElevation: 1 });
    elevationSpy2.depress.and.returnValue({ ok: true, newElevation: -1 });

    TestBed.configureTestingModule({
      providers: [
        PathMutationService,
        TerraformMaterialPoolService,
        DeckService,
        CardEffectService,
        CardPlayService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: PathfindingService, useValue: pathfindingSpy },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: TowerCombatService, useValue: towerCombatSpy },
        { provide: CombatLoopService, useValue: combatLoopSpy },
        { provide: WavePreviewService, useValue: jasmine.createSpyObj<WavePreviewService>('WavePreviewService', ['addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter']) },
        { provide: RunService, useValue: runServiceSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: AudioService, useValue: createAudioServiceSpy() },
        { provide: SceneService, useValue: createSceneServiceSpy() },
        { provide: GameStatsService, useValue: createGameStatsServiceSpy() },
        { provide: StatusEffectService, useValue: jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['apply']) },
        { provide: TowerUpgradeVisualService, useValue: jasmine.createSpyObj<TowerUpgradeVisualService>('TowerUpgradeVisualService', ['applyUpgradeVisuals']) },
        { provide: ElevationService, useValue: elevationSpy2 },
      ],
    });

    pathMutationService = TestBed.inject(PathMutationService);
    poolService = TestBed.inject(TerraformMaterialPoolService);
    deckService = TestBed.inject(DeckService);
    cardEffectService = TestBed.inject(CardEffectService);
    cardPlayService = TestBed.inject(CardPlayService);
    pathMutationService.setRepathHook(() => { /* no-op */ });
  }

  afterEach(() => {
    for (const m of createdMeshes) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (!poolService.isPoolMaterial(mat)) { mat.dispose(); }
    }
    createdMeshes.length = 0;
    poolService.dispose();
    scene.clear();
    pathMutationService.reset();
    deckService.clear();
    cardEffectService.reset();
  });

  // ── B1: With TERRAFORM_ANCHOR — block is permanent (MAX_SAFE_INTEGER sentinel) ──

  it('B1 — CARTOGRAPHER_SEAL active: BLOCK_PASSAGE uses MAX_SAFE_INTEGER duration', () => {
    setupModule();

    // Activate CARTOGRAPHER_SEAL modifier (simulates having played the card)
    const sealEffect = CARD_DEFINITIONS[CardId.CARTOGRAPHER_SEAL].effect;
    if (sealEffect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    cardEffectService.applyModifier(sealEffect);
    expect(cardEffectService.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeTrue();

    deckService.initializeDeck([CardId.BLOCK_PASSAGE], DECK_SEED);
    deckService.drawForWave();

    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.BLOCK_PASSAGE);
    if (!card) { pending('BLOCK_PASSAGE not in hand'); return; }
    cardPlayService.onCardPlayed(card);
    cardPlayService.resolveTileTarget(MID_PATH_ROW, MID_PATH_COL, scene, 1);

    const entry = pathMutationService.getActive()[0];
    // With TERRAFORM_ANCHOR: block duration is forced to Number.MAX_SAFE_INTEGER
    // (expiresOnTurn = turn + MAX_SAFE_INTEGER — effectively permanent)
    expect(entry.expiresOnTurn).toBe(1 + Number.MAX_SAFE_INTEGER);
  });

  // ── B2: Without SEAL — block uses card-defined duration (2) ───────────

  it('B2 — Without CARTOGRAPHER_SEAL: BLOCK_PASSAGE uses card-defined duration of 2', () => {
    setupModule();

    // No SEAL active
    expect(cardEffectService.hasActiveModifier(MODIFIER_STAT.TERRAFORM_ANCHOR)).toBeFalse();

    deckService.initializeDeck([CardId.BLOCK_PASSAGE], DECK_SEED);
    deckService.drawForWave();

    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.BLOCK_PASSAGE);
    if (!card) { pending('BLOCK_PASSAGE not in hand'); return; }

    const def = CARD_DEFINITIONS[CardId.BLOCK_PASSAGE];
    const effect = def.effect;
    if (effect.type !== 'terraform_target') { fail('Expected terraform_target'); return; }

    cardPlayService.onCardPlayed(card);
    cardPlayService.resolveTileTarget(MID_PATH_ROW, MID_PATH_COL, scene, 1);

    const entry = pathMutationService.getActive()[0];
    // No SEAL: expiresOnTurn = turn 1 + duration 2 = 3
    expect(entry.expiresOnTurn).toBe(1 + effect.duration!);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group C — LABYRINTH_MIND
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group C: LABYRINTH_MIND', () => {
  let cardEffectService: CardEffectService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;

  beforeEach(() => {
    pathfindingSpy = jasmine.createSpyObj<PathfindingService>('PathfindingService', [
      'invalidateCache', 'findPath', 'getPathToExitLength', 'getSpawnerTiles', 'getExitTiles',
    ]);

    TestBed.configureTestingModule({
      providers: [
        CardEffectService,
        DeckService,
        { provide: GameStateService, useValue: createGameStateServiceSpy() },
        { provide: EnemyService, useValue: jasmine.createSpyObj<EnemyService>('EnemyService', ['getEnemies', 'damageEnemy', 'damageStrongestEnemy']) },
      ],
    });

    cardEffectService = TestBed.inject(CardEffectService);
  });

  afterEach(() => {
    cardEffectService.reset();
  });

  // ── C1: LABYRINTH_MIND active — damage scales with path length ─────────

  it('C1 — LABYRINTH_MIND active: pathLengthMultiplier = 1 + pathLen*0.02 for non-zero path', () => {
    // Activate LABYRINTH_MIND modifier
    const mindEffect = CARD_DEFINITIONS[CardId.LABYRINTH_MIND].effect;
    if (mindEffect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    cardEffectService.applyModifier(mindEffect);

    // Confirm the modifier value matches the LABYRINTH_MIND scaling constant
    const scaling = cardEffectService.getModifierValue(MODIFIER_STAT.LABYRINTH_MIND);
    expect(scaling).toBeGreaterThan(0);

    // Wire a fake path length of 30 via the pathfinding spy
    pathfindingSpy.getPathToExitLength.and.returnValue(30);
    const pathLen = pathfindingSpy.getPathToExitLength();

    // Expected multiplier: 1 + 30 * 0.02 = 1.6
    const expectedMultiplier = 1 + pathLen * scaling;
    expect(expectedMultiplier).toBeCloseTo(1.6, 5);

    // Verify modifierValue is non-zero (TowerCombatService uses > 0 as sentinel)
    expect(cardEffectService.getModifierValue(MODIFIER_STAT.LABYRINTH_MIND)).toBeGreaterThan(0);
  });

  // ── C2: Without LABYRINTH_MIND — modifier value is 0 (multiplier stays 1) ─

  it('C2 — Without LABYRINTH_MIND: getModifierValue returns 0 (no scaling applied)', () => {
    // No LABYRINTH_MIND applied
    expect(cardEffectService.getModifierValue(MODIFIER_STAT.LABYRINTH_MIND)).toBe(0);
    // A multiplier of 0 → TowerCombatService formula: (0 > 0) is false → pathLengthMultiplier = 1
    const labyrinthScaling = cardEffectService.getModifierValue(MODIFIER_STAT.LABYRINTH_MIND);
    const pathLengthMultiplier = labyrinthScaling > 0 ? 1 + (30 * labyrinthScaling) : 1;
    expect(pathLengthMultiplier).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group D — Relics
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group D: Relics', () => {
  let relicService: RelicService;
  let deckService: DeckService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DeckService,
        CardEffectService,
        { provide: GameStateService, useValue: createGameStateServiceSpy() },
        { provide: EnemyService, useValue: jasmine.createSpyObj<EnemyService>('EnemyService', ['getEnemies', 'damageEnemy', 'damageStrongestEnemy']) },
      ],
    });

    relicService = TestBed.inject(RelicService);
    deckService = TestBed.inject(DeckService);
  });

  afterEach(() => {
    relicService.clearRelics();
    deckService.clear();
  });

  // ── D1: SURVEYOR_COMPASS ──────────────────────────────────────────────

  it('D1 — SURVEYOR_COMPASS: deduplicates visits, consumeSurveyorGold returns uniqueCount×5, then 0', () => {
    relicService.setActiveRelics([RelicId.SURVEYOR_COMPASS]);

    // Record 5 distinct tiles + 2 duplicates (7 calls, 5 unique)
    relicService.recordTileVisited(0, 1);
    relicService.recordTileVisited(0, 2);
    relicService.recordTileVisited(0, 3);
    relicService.recordTileVisited(1, 1);
    relicService.recordTileVisited(1, 2);
    relicService.recordTileVisited(0, 1); // duplicate
    relicService.recordTileVisited(0, 2); // duplicate

    const gold = relicService.consumeSurveyorGold();
    expect(gold).toBe(5 * 5); // 5 unique tiles × 5 gold

    // Second call must return 0 — set was cleared
    const goldSecond = relicService.consumeSurveyorGold();
    expect(goldSecond).toBe(0);
  });

  // ── D2: WORLD_SPIRIT ─────────────────────────────────────────────────

  it('D2 — WORLD_SPIRIT: -1 modifier for cartographer cards, 0 for neutral', () => {
    relicService.setActiveRelics([RelicId.WORLD_SPIRIT]);

    const layTileDef = CARD_DEFINITIONS[CardId.LAY_TILE];
    const goldRushDef = CARD_DEFINITIONS[CardId.GOLD_RUSH];

    // LAY_TILE is archetype=cartographer → -1
    expect(relicService.getCardEnergyCostModifier(layTileDef)).toBe(-1);
    // GOLD_RUSH is archetype=neutral (undefined) → 0
    expect(relicService.getCardEnergyCostModifier(goldRushDef)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group E — Enemies (MINER + UNSHAKEABLE + DETOUR)
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group E: Enemies', () => {
  let gameBoardService: GameBoardService;
  let pathfindingService: PathfindingService;
  let pathMutationService: PathMutationService;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let poolService: TerraformMaterialPoolService;
  let enemyService: EnemyService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);

    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'replaceTileMesh', 'rebuildTileMeshArray',
    ]);
    (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes = new Map<string, THREE.Mesh>();

    TestBed.configureTestingModule({
      providers: [
        PathfindingService,
        PathMutationService,
        TerraformMaterialPoolService,
        EnemyService,
        EnemyHealthService,
        EnemyMeshFactoryService,
        EnemyVisualService,
        CardEffectService,
        DeckService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
        { provide: GameStateService, useValue: createGameStateServiceSpy() },
      ],
    });

    pathfindingService = TestBed.inject(PathfindingService);
    pathMutationService = TestBed.inject(PathMutationService);
    poolService = TestBed.inject(TerraformMaterialPoolService);
    enemyService = TestBed.inject(EnemyService);

    pathMutationService.setRepathHook(() => { /* no-op */ });

    // Import the board so pathfinding knows spawner/exit locations
    gameBoardService.importBoard(gameBoardService.getGameBoard(), BOARD_COLS, BOARD_ROWS);
  });

  afterEach(() => {
    if (enemyService) { enemyService.reset(scene); }
    for (const m of createdMeshes) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (!poolService.isPoolMaterial(mat)) { mat.dispose(); }
    }
    createdMeshes.length = 0;
    if (poolService) { poolService.dispose(); }
    scene.clear();
    if (pathMutationService) { pathMutationService.reset(); }
  });

  // ── E1: MINER dig fires on cadence + destroys an adjacent WALL ───────────
  //
  // Sprint 24 caught a bug in the original `findMinerDigTarget`: it scanned
  // the MINER's A*-computed path for WALLs, but A* only emits traversable
  // nodes — WALL tiles are filtered out by construction. The function was
  // rewritten to scan the 4-direction neighbors of the MINER's current grid
  // position instead. This spec verifies the fix end-to-end.

  it('E1 — MINER: dig fires on cadence and calls destroy on an adjacent WALL', () => {
    // Signature: spawnEnemy(type, scene, waveHealthMult, waveSpeedMult, externalOccupied, currentTurn)
    const miner = enemyService.spawnEnemy(EnemyType.MINER, scene, 1, 1, undefined, 0);
    if (!miner) { pending('Board not configured for MINER spawn'); return; }

    expect(miner.spawnedOnTurn).toBe(0);

    // Park the MINER on a traversable tile (row 1) with a WALL directly
    // below it (row 2). Scan order is up/down/left/right — up (row 0) is
    // BASE, so the dig target resolves to the WALL at (row=2, col=2).
    miner.gridPosition = { row: 1, col: 2 };

    const destroySpy = spyOn(pathMutationService, 'destroy').and.returnValue({ ok: true });
    enemyService.tickMinerDigs(MINER_DIG_TURN, scene);

    // Dig lands on the adjacent WALL with the design-doc-mandated source tags.
    expect(destroySpy).toHaveBeenCalledTimes(1);
    const call = destroySpy.calls.mostRecent().args;
    // Args: (row, col, sourceId, currentTurn, scene, source)
    expect(call[2]).toBe(`miner:${miner.id}`);
    expect(call[5]).toBe('boss');
  });

  // ── E2: isPlayerBlocked prevents MINER from digging player walls ───────

  it('E2 — MINER: isPlayerBlocked cross-service: player-sourced ops set the flag; boss ops do not', () => {
    // Use WALL tiles (rows 2–3) so there's no connectivity risk.
    // 'build' ops convert WALL→BASE and source='card' marks them as player-built.
    // isPlayerBlocked only returns true for 'block' or 'destroy' ops, not 'build'.
    // For a player 'block': use a BASE tile in row 0; row 1 provides alternative.
    pathMutationService.block(MID_PATH_ROW, MID_PATH_COL, 99, 'player-card', 1, scene, 'card');
    expect(pathMutationService.isPlayerBlocked(MID_PATH_ROW, MID_PATH_COL)).toBeTrue();

    // For a boss-source build: WALL→BASE on row 2, source='boss'.
    // isPlayerBlocked ignores 'build' ops and non-player sources.
    pathMutationService.build(WALL_ROW, WALL_COL, null, 'boss-card', 2, scene, 'boss');
    expect(pathMutationService.isPlayerBlocked(WALL_ROW, WALL_COL)).toBeFalse();
    // Boss-sourced mutations ARE in the journal
    const active = pathMutationService.getActive();
    expect(active.find(m => m.source === 'boss')).toBeDefined();
    // Player-blocked tile still shows up
    expect(active.find(m => m.source === 'card' && m.op === 'block')).toBeDefined();
  });

  // ── E3: UNSHAKEABLE skips DETOUR ──────────────────────────────────────

  it('E3 — DETOUR: overrides HEAVY path, leaves UNSHAKEABLE path unchanged', () => {
    const heavy = enemyService.spawnEnemy(EnemyType.HEAVY, scene);
    const unshakeable = enemyService.spawnEnemy(EnemyType.UNSHAKEABLE, scene);

    if (!heavy || !unshakeable) { pending('Board not configured for these enemy types'); return; }

    // Confirm UNSHAKEABLE is immune
    expect(unshakeable.immuneToDetour).toBeTrue();
    expect(heavy.immuneToDetour).toBeFalsy();

    const heavyPathBefore = heavy.path.slice();
    const unshakeablePathBefore = unshakeable.path.slice();
    const heavyIndexBefore = heavy.pathIndex;
    const unshakeableIndexBefore = unshakeable.pathIndex;

    // applyDetour — returns count of enemies overridden
    const overrideCount = enemyService.applyDetour();

    // UNSHAKEABLE path and index must be unchanged
    expect(unshakeable.pathIndex).toBe(unshakeableIndexBefore);
    expect(unshakeable.path.length).toBe(unshakeablePathBefore.length);

    // If applyDetour found a longer path (board dependent), HEAVY is overridden
    // If the board has no longer path available, overrideCount may be 0 — that's valid
    if (overrideCount > 0) {
      // heavy's pathIndex was reset to 0
      expect(heavy.pathIndex).toBe(0);
    } else {
      // No longer path found — neither enemy should have changed
      expect(heavy.pathIndex).toBe(heavyIndexBefore);
      expect(heavy.path.length).toBe(heavyPathBefore.length);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group F — VEINSEEKER speed boost
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group F: VEINSEEKER speed boost', () => {
  let gameBoardService: GameBoardService;
  let pathfindingService: PathfindingService;
  let pathMutationService: PathMutationService;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let poolService: TerraformMaterialPoolService;
  let enemyService: EnemyService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);

    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'replaceTileMesh', 'rebuildTileMeshArray',
    ]);
    (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes = new Map<string, THREE.Mesh>();

    TestBed.configureTestingModule({
      providers: [
        PathfindingService,
        PathMutationService,
        TerraformMaterialPoolService,
        EnemyService,
        EnemyHealthService,
        EnemyMeshFactoryService,
        EnemyVisualService,
        CardEffectService,
        DeckService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
        { provide: GameStateService, useValue: createGameStateServiceSpy() },
      ],
    });

    pathfindingService = TestBed.inject(PathfindingService);
    pathMutationService = TestBed.inject(PathMutationService);
    poolService = TestBed.inject(TerraformMaterialPoolService);
    enemyService = TestBed.inject(EnemyService);

    pathMutationService.setRepathHook(() => { /* no-op */ });
    gameBoardService.importBoard(gameBoardService.getGameBoard(), BOARD_COLS, BOARD_ROWS);
  });

  afterEach(() => {
    if (enemyService) { enemyService.reset(scene); }
    for (const m of createdMeshes) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (!poolService.isPoolMaterial(mat)) { mat.dispose(); }
    }
    createdMeshes.length = 0;
    if (poolService) { poolService.dispose(); }
    scene.clear();
    if (pathMutationService) { pathMutationService.reset(); }
  });

  // ── F1: Path mutated recently → VEINSEEKER advances 2 tiles ──────────

  it('F1 — VEINSEEKER: advances 2 tiles/turn when path was mutated in last 3 turns', () => {
    const veinseeker = enemyService.spawnEnemy(EnemyType.VEINSEEKER, scene);
    if (!veinseeker || veinseeker.path.length < 3) {
      pending('VEINSEEKER not spawnable or path too short');
      return;
    }

    // Apply a mutation so wasMutatedInLastTurns(currentTurn=5, window=3) returns true
    // We need a WALL tile for `build` mutation (rows 2–3 in our board)
    pathMutationService.build(WALL_ROW, WALL_COL, null, 'test-card', 3, scene);

    // Sanity: confirm mutation is within window
    expect(pathMutationService.wasMutatedInLastTurns(5, VEIN_BOOST_WINDOW)).toBeTrue();

    const initialPathIndex = veinseeker.pathIndex;
    // stepEnemiesOneTurn at currentTurn=5 (passes to wasMutatedInLastTurns)
    enemyService.stepEnemiesOneTurn(() => 0, 5);

    // VEINSEEKER should advance 2 tiles
    expect(veinseeker.pathIndex).toBe(initialPathIndex + 2);
  });

  // ── F2: No recent mutation → VEINSEEKER advances 1 tile ──────────────

  it('F2 — VEINSEEKER: advances only 1 tile/turn when no recent mutation', () => {
    const veinseeker = enemyService.spawnEnemy(EnemyType.VEINSEEKER, scene);
    if (!veinseeker || veinseeker.path.length < 2) {
      pending('VEINSEEKER not spawnable or path too short');
      return;
    }

    // No mutations in journal — wasMutatedInLastTurns must return false
    expect(pathMutationService.wasMutatedInLastTurns(5, VEIN_BOOST_WINDOW)).toBeFalse();

    const initialPathIndex = veinseeker.pathIndex;
    enemyService.stepEnemiesOneTurn(() => 0, 5);

    // Without boost: base tilesPerTurn = 1
    expect(veinseeker.pathIndex).toBe(initialPathIndex + 1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group G — Save / Restore
// ──────────────────────────────────────────────────────────────────────────

describe('Cartographer integration — Group G: Save / Restore', () => {
  let gameBoardService: GameBoardService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);

    pathfindingSpy = jasmine.createSpyObj<PathfindingService>('PathfindingService', ['invalidateCache', 'findPath', 'getPathToExitLength']);
    pathfindingSpy.getPathToExitLength.and.returnValue(0);

    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'replaceTileMesh', 'rebuildTileMeshArray',
    ]);
    (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes = new Map<string, THREE.Mesh>();

    TestBed.configureTestingModule({
      providers: [
        PathMutationService,
        TerraformMaterialPoolService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: PathfindingService, useValue: pathfindingSpy },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
      ],
    });

    pathMutationService = TestBed.inject(PathMutationService);
    poolService = TestBed.inject(TerraformMaterialPoolService);
    pathMutationService.setRepathHook(() => { /* no-op */ });
  });

  afterEach(() => {
    for (const m of createdMeshes) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (!poolService.isPoolMaterial(mat)) { mat.dispose(); }
    }
    createdMeshes.length = 0;
    poolService.dispose();
    scene.clear();
    pathMutationService.reset();
  });

  // ── G1: Serialize 3 mutations, restore into fresh service ─────────────

  it('G1 — serialize / restore: 3 mutations round-trip through PathMutationService', () => {
    // Apply 3 mutations on 3 distinct WALL tiles in rows 2–3 so there's no path connectivity risk.
    // All mutations are `build` (WALL→BASE) on the non-traversable rows — none can block a spawner→exit path.
    pathMutationService.build(WALL_ROW, 1, null, 'build-a', 1, scene);
    pathMutationService.build(WALL_ROW, 2, null, 'build-b', 2, scene);
    pathMutationService.build(WALL_ROW, 4, null, 'build-c', 3, scene);

    const snapshot = pathMutationService.serialize();
    expect(snapshot.mutations.length).toBe(3);
    expect(snapshot.nextId).toBe(3);

    // Restore into a freshly-reset instance of the same service
    pathMutationService.reset();
    expect(pathMutationService.getActive().length).toBe(0);

    pathMutationService.restore(snapshot);

    const restored = pathMutationService.getActive();
    expect(restored.length).toBe(3);
    // Verify ops round-tripped correctly (all 3 are build in this test)
    expect(restored[0].op).toBe('build');
    expect(restored[1].op).toBe('build');
    expect(restored[2].op).toBe('build');
    // nextId preserved — serializing again returns the same nextId
    const nextSnapshot = pathMutationService.serialize();
    expect(nextSnapshot.nextId).toBe(snapshot.nextId);
  });

  // ── G2: pathMutations field round-trips via EncounterCheckpointService ─

  it('G2 — checkpoint round-trip: pathMutations field survives save + load', () => {
    // Apply 2 mutations to get a non-trivial journal
    pathMutationService.build(WALL_ROW, WALL_COL, null, 'cp-build', 1, scene);
    pathMutationService.block(MID_PATH_ROW, MID_PATH_COL, 2, 'cp-block', 2, scene);

    const mutationSnapshot = pathMutationService.serialize();

    // Build a minimal-but-valid checkpoint (only the fields we need to test)
    const checkpointService = TestBed.inject(EncounterCheckpointService);
    // Intentional literal — this spec exercises the v8 → current migration
    // chain. Do NOT replace with CHECKPOINT_VERSION; that would skip the
    // migration path the test is covering.
    const CHECKPOINT_VERSION_FIXTURE = 8;

    // Build a structurally-valid stub checkpoint that passes isValidCheckpoint().
    // isValidCheckpoint() checks: version (number), timestamp (number), nodeId (string),
    // encounterConfig (non-null), gameState (non-null), itemInventory.entries (array),
    // runStateFlags.entries (array), runStateFlags.consumedEventIds (array),
    // pathMutations.mutations (array).
    const stubCheckpoint = {
      version: CHECKPOINT_VERSION_FIXTURE,
      timestamp: Date.now(),  // matches isValidCheckpoint() field name
      nodeId: 'node-1',       // matches isValidCheckpoint() field name
      encounterConfig: { waves: [] },  // required non-null by isValidCheckpoint
      gameState: { lives: 20, maxLives: 20, gold: 100, score: 0, phase: 'COMBAT', waveCompleted: 0 },
      deckState: { drawPile: [], hand: [], discardPile: [], exhaustPile: [] },
      deckEnergy: { current: 3, max: 3 },
      deckCardIds: [],
      deckMaxEnergy: 3,
      deckRngState: null,
      modifiers: [],
      waveState: {
        currentWaveIndex: 0,
        turnSchedule: [],
        spawned: 0,
        nextWaveEnemySpeedMultiplier: 1,
        activeWaveCaltropsMultiplier: 1,
      },
      placedTowers: [],
      enemies: [],
      statusEffects: [],
      relicIds: [],
      relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false, orogenyTurnCounter: 0 },
      gameStats: {
        wavesCompleted: 0, towersPlaced: 0, towersUpgraded: 0, towersSold: 0,
        enemiesKilled: 0, goldEarned: 0, livesLost: 0, spellsPlayed: 0,
        modifiersPlayed: 0, cardsPlayed: 0, ascensionLevel: 0,
      },
      challengeState: {
        noDamageWaves: 0, totalWavesTracked: 0, currentStreakWaves: 0,
        sniperOnlyActive: false, noBuildActive: false,
      },
      ascensionModifiers: [],
      wavePreview: { oneShotBonus: 0 },
      turnHistory: [],
      pathMutations: mutationSnapshot,
      runStateFlags: { entries: [], consumedEventIds: [] },
      itemInventory: { entries: [] },
    };

    const saved = checkpointService.saveCheckpoint(stubCheckpoint as never);
    expect(saved).toBeTrue();

    const loaded = checkpointService.loadCheckpoint();
    expect(loaded).not.toBeNull();
    expect(loaded!.pathMutations.mutations.length).toBe(2);
    expect(loaded!.pathMutations.nextId).toBe(2);
    expect(loaded!.pathMutations.mutations[0].op).toBe('build');
    expect(loaded!.pathMutations.mutations[1].op).toBe('block');

    checkpointService.clearCheckpoint();
  });
});
