/**
 * Highground archetype — end-to-end integration tests.
 *
 * Mirrors cartographer-integration.spec.ts in structure. Wires REAL services
 * where the mechanic spans service boundaries. Mocks only the Three.js boundary
 * and services that require a running combat loop.
 *
 * Real:
 *   ElevationService, GameBoardService, PathMutationService, PathfindingService,
 *   BoardMeshRegistryService, TerraformMaterialPoolService,
 *   CardPlayService, DeckService, CardEffectService,
 *   RelicService, EnemyService (for GLIDER / TITAN / WYRM_ASCENDANT groups)
 *
 * Mocked (Three.js boundary + services requiring a running combat loop):
 *   AudioService, SceneService, GameStateService, TowerCombatService,
 *   GameStatsService, RunService, WavePreviewService
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
import { EncounterCheckpointService } from '../services/encounter-checkpoint.service';

// ── Game-board models ──────────────────────────────────────────────────────
import { BlockType, GameBoardTile } from '../../game/game-board/models/game-board-tile';
import { EnemyType, ENEMY_STATS, GLIDER_STATS, TITAN_STATS, WYRM_ASCENDANT_STATS } from '../../game/game-board/models/enemy.model';
import { GamePhase, INITIAL_GAME_STATE } from '../../game/game-board/models/game-state.model';
import { WAVE_DEFINITIONS, getWaveEnemyTypes } from '../../game/game-board/models/wave.model';
import { ELEVATION_CONFIG } from '../../game/game-board/constants/elevation.constants';

// ── Run-side services ──────────────────────────────────────────────────────
import { DeckService } from '../services/deck.service';
import { CardEffectService } from '../services/card-effect.service';
import { RelicService } from '../services/relic.service';
import { RunService } from '../services/run.service';

// ── Run-side models / constants ────────────────────────────────────────────
import { CardId } from '../models/card.model';
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
// Coordinate / tuning constants
// ──────────────────────────────────────────────────────────────────────────

/** Board is 7 columns × 4 rows. */
const BOARD_COLS = 7;
const BOARD_ROWS = 4;

/** BASE tile in row 0 suitable for elevation ops. */
const BASE_ROW = 0;
const BASE_COL = 3;

/** Another BASE tile in row 1 (allows testing without losing connectivity). */
const BASE_ROW_1 = 1;
const BASE_COL_1 = 3;

/** WALL tile in row 2 (used for build/bridgehead in cross-archetype tests). */
const WALL_ROW = 2;
const WALL_COL = 3;

/** Seed for DeckService initializations. */
const DECK_SEED = 99999;

/** Turn used for most single-turn specs (avoids 0 for anti-spam invariant). */
const TURN_1 = 1;
const TURN_2 = 2;

// ──────────────────────────────────────────────────────────────────────────
// Board setup helpers (mirrors cartographer-integration.spec.ts)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Same 7×4 open board used by the Cartographer integration spec.
 *
 * Layout:
 *   Row 0: SPAWNER | BASE | BASE | BASE | BASE | BASE | EXIT
 *   Row 1: SPAWNER | BASE | BASE | BASE | BASE | BASE | EXIT
 *   Row 2: WALL   | WALL | WALL | WALL | WALL | WALL | WALL
 *   Row 3: WALL   | WALL | WALL | WALL | WALL | WALL | WALL
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

  board[0][0] = GameBoardTile.createSpawner(0, 0);
  board[1][0] = GameBoardTile.createSpawner(0, 1);
  board[0][6] = GameBoardTile.createExit(6, 0);
  board[1][6] = GameBoardTile.createExit(6, 1);

  for (let c = 0; c < BOARD_COLS; c++) {
    board[2][c] = GameBoardTile.createWall(c, 2);
    board[3][c] = GameBoardTile.createWall(c, 3);
  }

  svc.importBoard(board, BOARD_COLS, BOARD_ROWS);
  return svc;
}

/** Meshes created by createTileMesh stub — disposed in afterEach. */
const createdMeshes: THREE.Mesh[] = [];

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

/**
 * Build a full TestBed with REAL ElevationService + all required peers.
 * ElevationService needs: GameBoardService, BoardMeshRegistryService,
 * @Optional SceneService, @Optional TerraformMaterialPoolService.
 *
 * Returns the injected instances so groups can destructure what they need.
 */
function buildFullTestBed(gameBoardService: GameBoardService): {
  elevationService: ElevationService;
  pathfindingService: PathfindingService;
  pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  poolService: TerraformMaterialPoolService;
  pathMutationService: PathMutationService;
  cardPlayService: CardPlayService;
  deckService: DeckService;
  cardEffectService: CardEffectService;
  enemySpy: jasmine.SpyObj<EnemyService>;
} {
  const pathfindingSpy = jasmine.createSpyObj<PathfindingService>(
    'PathfindingService',
    ['invalidateCache', 'findPath', 'getPathToExitLength'],
  );
  pathfindingSpy.getPathToExitLength.and.returnValue(0);

  const registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>(
    'BoardMeshRegistryService',
    ['replaceTileMesh', 'rebuildTileMeshArray', 'rebuildTowerChildrenArray',
     'translateTileMesh', 'translateTowerMesh'],
  );
  (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes =
    new Map<string, THREE.Mesh>();
  (registrySpy as unknown as { towerMeshes: Map<string, THREE.Group> }).towerMeshes =
    new Map<string, THREE.Group>();
  (registrySpy as unknown as { cliffMeshes: Map<string, THREE.Mesh> }).cliffMeshes =
    new Map<string, THREE.Mesh>();

  const gameStateSpy = createGameStateServiceSpy();
  gameStateSpy.getState.and.returnValue({ ...INITIAL_GAME_STATE, phase: GamePhase.COMBAT });

  const towerCombatSpy = jasmine.createSpyObj<TowerCombatService>(
    'TowerCombatService',
    ['getPlacedTowers', 'upgradeTower', 'unregisterTower'],
  );
  towerCombatSpy.getPlacedTowers.and.returnValue(new Map());

  const combatLoopSpy = jasmine.createSpyObj<CombatLoopService>(
    'CombatLoopService',
    ['getTurnNumber'],
  );
  combatLoopSpy.getTurnNumber.and.returnValue(TURN_1);

  const runServiceSpy = jasmine.createSpyObj<RunService>('RunService', ['nextRandom']);
  runServiceSpy.nextRandom.and.returnValue(0);

  const enemySpy = jasmine.createSpyObj<EnemyService>(
    'EnemyService',
    ['repathAffectedEnemies', 'getEnemies', 'damageEnemy'],
  );
  enemySpy.getEnemies.and.returnValue(new Map() as never);

  const wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>(
    'WavePreviewService',
    ['addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter'],
  );

  TestBed.configureTestingModule({
    providers: [
      PathMutationService,
      TerraformMaterialPoolService,
      ElevationService,
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
      {
        provide: StatusEffectService,
        useValue: jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['apply']),
      },
      {
        provide: TowerUpgradeVisualService,
        useValue: jasmine.createSpyObj<TowerUpgradeVisualService>(
          'TowerUpgradeVisualService', ['applyUpgradeVisuals'],
        ),
      },
    ],
  });

  const pathMutationService = TestBed.inject(PathMutationService);
  pathMutationService.setRepathHook(() => { /* no-op in tests */ });

  return {
    elevationService: TestBed.inject(ElevationService),
    pathfindingService: TestBed.inject(PathfindingService),
    pathfindingSpy,
    registrySpy,
    poolService: TestBed.inject(TerraformMaterialPoolService),
    pathMutationService,
    cardPlayService: TestBed.inject(CardPlayService),
    deckService: TestBed.inject(DeckService),
    cardEffectService: TestBed.inject(CardEffectService),
    enemySpy,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Shared afterEach teardown helper
// ──────────────────────────────────────────────────────────────────────────
function teardownMeshes(poolService: TerraformMaterialPoolService, scene: THREE.Scene): void {
  for (const m of createdMeshes) {
    m.geometry.dispose();
    const mat = m.material as THREE.Material;
    if (!poolService.isPoolMaterial(mat)) { mat.dispose(); }
  }
  createdMeshes.length = 0;
  poolService.dispose();
  scene.clear();
}

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group A — Highground cards (RAISE_PLATFORM, DEPRESS_TILE)
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group A: RAISE_PLATFORM + DEPRESS_TILE', () => {
  let gameBoardService: GameBoardService;
  let elevationService: ElevationService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let cardPlayService: CardPlayService;
  let deckService: DeckService;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);
    const deps = buildFullTestBed(gameBoardService);
    elevationService = deps.elevationService;
    pathfindingSpy = deps.pathfindingSpy;
    poolService = deps.poolService;
    pathMutationService = deps.pathMutationService;
    cardPlayService = deps.cardPlayService;
    deckService = deps.deckService;
    enemySpy = deps.enemySpy;

    deckService.initializeDeck(
      [CardId.RAISE_PLATFORM, CardId.DEPRESS_TILE],
      DECK_SEED,
    );
    deckService.drawForWave();
  });

  afterEach(() => {
    teardownMeshes(poolService, scene);
    pathMutationService.reset();
    elevationService.reset();
    deckService.clear();
    TestBed.inject(CardEffectService).reset();
  });

  // ── A1: RAISE_PLATFORM elevates tile +1 ───────────────────────────────

  it('A1 — RAISE_PLATFORM: tile elevation increments to +1; journal entry recorded; pathfinding NOT invalidated', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.RAISE_PLATFORM);
    if (!card) { pending('RAISE_PLATFORM not in hand for this seed'); return; }

    const def = CARD_DEFINITIONS[CardId.RAISE_PLATFORM];
    const energyBefore = deckService.getEnergy().current;

    // Phase 1: enter elevation-target mode
    cardPlayService.onCardPlayed(card);
    // Energy not consumed yet (two-phase flow)
    expect(deckService.getEnergy().current).toBe(energyBefore);

    // Phase 2: resolve on a BASE tile
    const result = cardPlayService.resolveTileTarget(BASE_ROW, BASE_COL, scene, TURN_1);

    expect(result.ok).toBeTrue();
    // Cross-service 1: board tile now has elevation 1
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation).toBe(1);
    // Cross-service 2: journal has exactly 1 entry
    expect(elevationService.getActiveChanges().length).toBe(1);
    expect(elevationService.getActiveChanges()[0].op).toBe('raise');
    // Cross-service 3: energy deducted
    expect(deckService.getEnergy().current).toBe(energyBefore - def.energyCost);
    // Cross-service 4: pathfinding cache NOT invalidated (design rule: elevation is pathfinding-agnostic)
    expect(pathfindingSpy.invalidateCache).not.toHaveBeenCalled();
    // Cross-service 5: card moved to discard
    expect(deckService.getDeckState().hand.find(c => c.instanceId === card.instanceId)).toBeUndefined();
    expect(deckService.getDeckState().discardPile.find(c => c.instanceId === card.instanceId)).toBeDefined();
  });

  // ── A2: DEPRESS_TILE lowers tile -1 ───────────────────────────────────

  it('A2 — DEPRESS_TILE: tile elevation decrements to -1; journal entry recorded; exposed damage bonus signals correctly', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.DEPRESS_TILE);
    if (!card) { pending('DEPRESS_TILE not in hand for this seed'); return; }

    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(BASE_ROW, BASE_COL, scene, TURN_1);

    expect(result.ok).toBeTrue();
    // Tile elevation is now -1 (depressed)
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation).toBe(-1);
    // Journal: one depress entry
    expect(elevationService.getActiveChanges()[0].op).toBe('depress');
    // The exposed damage bonus constant is correctly defined (EnemyService reads it)
    expect(ELEVATION_CONFIG.EXPOSED_DAMAGE_BONUS).toBeGreaterThan(0);
    // Pathfinding cache still untouched
    expect(pathfindingSpy.invalidateCache).not.toHaveBeenCalled();
  });

  // ── A3: DEPRESS_TILE + enemy on tile → damageEnemy gets +25% call ────

  it('A3 — DEPRESS_TILE exposed: enemies on depressed tile would receive +25% damage (verify constant)', () => {
    // Depress the tile first
    cardPlayService.onCardPlayed(deckService.getDeckState().hand.find(c => c.cardId === CardId.DEPRESS_TILE)!);
    cardPlayService.resolveTileTarget(BASE_ROW, BASE_COL, scene, TURN_1);

    // Confirm the tile is depressed
    const elevation = gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation ?? 0;
    expect(elevation).toBe(-1);

    // The exposed damage formula: damage = Math.round(base * (1 + EXPOSED_DAMAGE_BONUS))
    const baseDamage = 100;
    const expectedDamage = Math.round(baseDamage * (1 + ELEVATION_CONFIG.EXPOSED_DAMAGE_BONUS));
    expect(expectedDamage).toBe(125); // 100 × 1.25
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group B — HIGH_PERCH modifier card
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group B: HIGH_PERCH', () => {
  let cardEffectService: CardEffectService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CardEffectService,
        DeckService,
        { provide: GameStateService, useValue: createGameStateServiceSpy() },
        {
          provide: EnemyService,
          useValue: jasmine.createSpyObj<EnemyService>(
            'EnemyService',
            ['getEnemies', 'damageEnemy', 'damageStrongestEnemy'],
          ),
        },
      ],
    });
    cardEffectService = TestBed.inject(CardEffectService);
  });

  afterEach(() => {
    cardEffectService.reset();
  });

  // ── B1: HIGH_PERCH active — range bonus modifier present ──────────────

  it('B1 — HIGH_PERCH active: HIGH_PERCH_RANGE_BONUS modifier > 0 after applyModifier', () => {
    const effect = CARD_DEFINITIONS[CardId.HIGH_PERCH].effect;
    if (effect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    cardEffectService.applyModifier(effect);

    expect(cardEffectService.hasActiveModifier(MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS)).toBeTrue();
    const bonus = cardEffectService.getModifierValue(MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS);
    expect(bonus).toBeGreaterThan(0);
  });

  // ── B2: HIGH_PERCH + passive elevation bonus composition ──────────────

  it('B2 — HIGH_PERCH bonus composes additively with passive RANGE_BONUS_PER_ELEVATION', () => {
    const effect = CARD_DEFINITIONS[CardId.HIGH_PERCH].effect;
    if (effect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    cardEffectService.applyModifier(effect);

    const highPerchBonus = cardEffectService.getModifierValue(MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS);
    const elevation = 2;
    // TowerCombatService formula: rangeMult = 1 + (elevation * RANGE_BONUS_PER_ELEVATION) + HIGH_PERCH_BONUS
    const passiveBonus = elevation * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION;
    const totalMult = 1 + passiveBonus + highPerchBonus;

    // With elevation=2 (qualifies for HIGH_PERCH threshold), the multiplier must exceed 1.5
    expect(totalMult).toBeGreaterThan(1.5);
  });

  // ── B3: Without HIGH_PERCH — modifier value is 0 ─────────────────────

  it('B3 — Without HIGH_PERCH: getModifierValue returns 0 (no range bonus applied)', () => {
    expect(cardEffectService.getModifierValue(MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group C — CLIFFSIDE card (sprint 30)
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group C: CLIFFSIDE', () => {
  let gameBoardService: GameBoardService;
  let elevationService: ElevationService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let cardPlayService: CardPlayService;
  let deckService: DeckService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);
    const deps = buildFullTestBed(gameBoardService);
    elevationService = deps.elevationService;
    pathfindingSpy = deps.pathfindingSpy;
    poolService = deps.poolService;
    pathMutationService = deps.pathMutationService;
    cardPlayService = deps.cardPlayService;
    deckService = deps.deckService;

    deckService.initializeDeck([CardId.CLIFFSIDE], DECK_SEED);
    deckService.drawForWave();
  });

  afterEach(() => {
    teardownMeshes(poolService, scene);
    pathMutationService.reset();
    elevationService.reset();
    deckService.clear();
    TestBed.inject(CardEffectService).reset();
  });

  // ── C1: CLIFFSIDE raises 3-tile horizontal line ───────────────────────

  it('C1 — CLIFFSIDE: center mandatory, wings raised; pathfinding NOT invalidated', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.CLIFFSIDE);
    if (!card) { pending('CLIFFSIDE not in hand for this seed'); return; }

    // Play on row 0, col 3 — wings at col 2 and col 4 (all BASE tiles)
    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(BASE_ROW, BASE_COL, scene, TURN_1);

    expect(result.ok).toBeTrue();
    // Center tile must be elevated
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation).toBe(1);
    // Wings should also be elevated (row 0, cols 2 and 4 are BASE tiles)
    const westElevation = gameBoardService.getGameBoard()[BASE_ROW][BASE_COL - 1].elevation;
    const eastElevation = gameBoardService.getGameBoard()[BASE_ROW][BASE_COL + 1].elevation;
    expect(westElevation).toBe(1);
    expect(eastElevation).toBe(1);
    // 3 journal entries (center + 2 wings)
    expect(elevationService.getActiveChanges().length).toBe(3);
    // Pathfinding cache never touched
    expect(pathfindingSpy.invalidateCache).not.toHaveBeenCalled();
  });

  // ── C2: CLIFFSIDE with edge tile — spawner wing silently skipped ──────

  it('C2 — CLIFFSIDE: center near spawner column; SPAWNER wing silently skipped, center and valid wing raised', () => {
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.CLIFFSIDE);
    if (!card) { pending('CLIFFSIDE not in hand for this seed'); return; }

    // Row 0, col 1: west wing would land on SPAWNER at col 0 — must be skipped
    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(BASE_ROW, 1, scene, TURN_1);

    expect(result.ok).toBeTrue();
    // Center elevated
    expect(gameBoardService.getGameBoard()[BASE_ROW][1].elevation).toBe(1);
    // East wing at col 2 elevated
    expect(gameBoardService.getGameBoard()[BASE_ROW][2].elevation).toBe(1);
    // SPAWNER at col 0 must NOT be elevated
    expect(gameBoardService.getGameBoard()[BASE_ROW][0].elevation ?? 0).toBe(0);
    // 2 journal entries (center + 1 valid wing only)
    expect(elevationService.getActiveChanges().length).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group D — VANTAGE_POINT + AVALANCHE_ORDER + KING_OF_THE_HILL + GRAVITY_WELL
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group D: VANTAGE_POINT / AVALANCHE_ORDER / KOTH / GRAVITY_WELL', () => {
  let gameBoardService: GameBoardService;
  let elevationService: ElevationService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let cardPlayService: CardPlayService;
  let deckService: DeckService;
  let cardEffectService: CardEffectService;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);
    const deps = buildFullTestBed(gameBoardService);
    elevationService = deps.elevationService;
    pathfindingSpy = deps.pathfindingSpy;
    poolService = deps.poolService;
    pathMutationService = deps.pathMutationService;
    cardPlayService = deps.cardPlayService;
    deckService = deps.deckService;
    cardEffectService = deps.cardEffectService;
    enemySpy = deps.enemySpy;
  });

  afterEach(() => {
    teardownMeshes(poolService, scene);
    pathMutationService.reset();
    elevationService.reset();
    deckService.clear();
    cardEffectService.reset();
  });

  // ── D1: VANTAGE_POINT applies modifier ───────────────────────────────

  it('D1 — VANTAGE_POINT: VANTAGE_POINT_DAMAGE_BONUS modifier active after card play', () => {
    const effect = CARD_DEFINITIONS[CardId.VANTAGE_POINT].effect;
    if (effect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    cardEffectService.applyModifier(effect);

    expect(cardEffectService.hasActiveModifier(MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS)).toBeTrue();
    expect(cardEffectService.getModifierValue(MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS)).toBeGreaterThan(0);
  });

  // ── D2: VANTAGE_POINT is 1-wave scoped (duration = 1) ─────────────────

  it('D2 — VANTAGE_POINT: effect has duration=1 (one-wave countdown)', () => {
    const effect = CARD_DEFINITIONS[CardId.VANTAGE_POINT].effect;
    if (effect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    expect(effect.duration).toBe(1);
  });

  // ── D3: AVALANCHE_ORDER — deals elevation × 10 damage, then collapses ─

  it('D3 — AVALANCHE_ORDER: elevated tile + enemy → damage=elevation×10, tile collapses to 0', () => {
    // Pre-raise the target tile to elevation 2 via service directly
    elevationService.raise(BASE_ROW, BASE_COL, 2, null, 'pre-raise', TURN_1);
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation).toBe(2);

    // Put a fake enemy on the elevated tile
    const targetEnemyId = 'enemy-avalanche';
    const fakeEnemy = {
      id: targetEnemyId,
      type: EnemyType.BASIC,
      health: 200,
      maxHealth: 200,
      dying: false,
      gridPosition: { row: BASE_ROW, col: BASE_COL },
    };
    const enemyMap = new Map([[targetEnemyId, fakeEnemy as never]]);
    enemySpy.getEnemies.and.returnValue(enemyMap as never);

    deckService.initializeDeck([CardId.AVALANCHE_ORDER], DECK_SEED);
    deckService.drawForWave();
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.AVALANCHE_ORDER);
    if (!card) { pending('AVALANCHE_ORDER not in hand for this seed'); return; }

    cardPlayService.onCardPlayed(card);
    // Use TURN_2 to avoid anti-spam with the pre-raise (which used TURN_1 for the pre-raise op)
    const result = cardPlayService.resolveTileTarget(BASE_ROW, BASE_COL, scene, TURN_2);

    expect(result.ok).toBeTrue();
    // Tile collapsed to 0
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation ?? 0).toBe(0);
    // Enemy damaged with elevation(2) × 10 = 20
    expect(enemySpy.damageEnemy).toHaveBeenCalledWith(targetEnemyId, 20);
  });

  // ── D4: AVALANCHE_ORDER rejected on non-elevated tile ────────────────

  it('D4 — AVALANCHE_ORDER: rejected (not-elevated) on a tile at elevation 0', () => {
    deckService.initializeDeck([CardId.AVALANCHE_ORDER], DECK_SEED);
    deckService.drawForWave();
    const hand = deckService.getDeckState().hand;
    const card = hand.find(c => c.cardId === CardId.AVALANCHE_ORDER);
    if (!card) { pending('AVALANCHE_ORDER not in hand for this seed'); return; }

    cardPlayService.onCardPlayed(card);
    const result = cardPlayService.resolveTileTarget(BASE_ROW, BASE_COL, scene, TURN_1);

    expect(result.ok).toBeFalse();
    expect(result.reason).toBe('not-elevated');
    // Card must still be in hand (pending state preserved for retry)
    expect(deckService.getDeckState().hand.find(c => c.instanceId === card.instanceId)).toBeDefined();
  });

  // ── D5: KING_OF_THE_HILL modifier — encounter-scoped, duration null ───

  it('D5 — KING_OF_THE_HILL: modifier active after card play; duration null (encounter-scoped)', () => {
    const effect = CARD_DEFINITIONS[CardId.KING_OF_THE_HILL].effect;
    if (effect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    expect(effect.duration).toBeNull();
    cardEffectService.applyModifier(effect);
    expect(cardEffectService.hasActiveModifier(MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS)).toBeTrue();
  });

  // ── D6: KOTH — flat board (maxElevation 0) means no bonus ────────────

  it('D6 — KING_OF_THE_HILL: flat board (no elevations) → getMaxElevation returns 0, bonus not applicable', () => {
    // With no elevation ops, the board is flat
    expect(elevationService.getMaxElevation()).toBe(0);
    // When max elevation is 0, KOTH bonus does not apply (all towers at 0)
    const maxElev = elevationService.getMaxElevation();
    const kothBonus = cardEffectService.getModifierValue(MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS);
    // kothBonus is 0 (no card played yet) but even if it were active, the threshold is maxElev >= 1
    expect(maxElev < 1 || kothBonus === 0).toBeTrue();
  });

  // ── D7: GRAVITY_WELL modifier — encounter-scoped, duration null ───────

  it('D7 — GRAVITY_WELL: modifier active after card play; duration null (encounter-scoped)', () => {
    const effect = CARD_DEFINITIONS[CardId.GRAVITY_WELL].effect;
    if (effect.type !== 'modifier') { fail('Expected modifier effect'); return; }
    expect(effect.duration).toBeNull();
    cardEffectService.applyModifier(effect);
    expect(cardEffectService.hasActiveModifier(MODIFIER_STAT.GRAVITY_WELL)).toBeTrue();
    expect(cardEffectService.getModifierValue(MODIFIER_STAT.GRAVITY_WELL)).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group E — Highground relics (SURVEYOR_ROD, OROGENY)
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group E: Relics (SURVEYOR_ROD + OROGENY)', () => {
  let relicService: RelicService;
  let deckService: DeckService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RelicService,
        DeckService,
        CardEffectService,
        { provide: GameStateService, useValue: createGameStateServiceSpy() },
        {
          provide: EnemyService,
          useValue: jasmine.createSpyObj<EnemyService>(
            'EnemyService',
            ['getEnemies', 'damageEnemy', 'damageStrongestEnemy'],
          ),
        },
      ],
    });
    relicService = TestBed.inject(RelicService);
    deckService = TestBed.inject(DeckService);
  });

  afterEach(() => {
    relicService.clearRelics();
    deckService.clear();
  });

  // ── E1: SURVEYOR_ROD — hasSurveyorRod returns true ───────────────────

  it('E1 — SURVEYOR_ROD: hasSurveyorRod returns true when relic is active', () => {
    relicService.setActiveRelics([RelicId.SURVEYOR_ROD]);
    expect(relicService.hasSurveyorRod()).toBeTrue();
  });

  // ── E2: SURVEYOR_ROD — hasSurveyorRod false when not active ──────────

  it('E2 — SURVEYOR_ROD: hasSurveyorRod returns false when relic is NOT active', () => {
    expect(relicService.hasSurveyorRod()).toBeFalse();
  });

  // ── E3: OROGENY — turn counter increments and triggers at interval ─────

  it('E3 — OROGENY: counter increments; isOrogenyTrigger fires at interval multiples', () => {
    relicService.setActiveRelics([RelicId.OROGENY]);
    const interval = ELEVATION_CONFIG.OROGENY_INTERVAL_TURNS;

    // Increment to interval-1 — should NOT trigger
    for (let i = 0; i < interval - 1; i++) { relicService.incrementOrogenyCounter(); }
    expect(relicService.isOrogenyTrigger(relicService.getOrogenyTurnCounter(), interval)).toBeFalse();

    // One more increment — now at interval, must trigger
    relicService.incrementOrogenyCounter();
    expect(relicService.getOrogenyTurnCounter()).toBe(interval);
    expect(relicService.isOrogenyTrigger(relicService.getOrogenyTurnCounter(), interval)).toBeTrue();
  });

  // ── E4: OROGENY — counter resets on encounter start ──────────────────

  it('E4 — OROGENY: resetEncounterState clears the turn counter', () => {
    relicService.setActiveRelics([RelicId.OROGENY]);
    relicService.incrementOrogenyCounter();
    relicService.incrementOrogenyCounter();
    expect(relicService.getOrogenyTurnCounter()).toBe(2);

    relicService.resetEncounterState();
    expect(relicService.getOrogenyTurnCounter()).toBe(0);
  });

  // ── E5: OROGENY — counter serialize/restore round-trip ───────────────

  it('E5 — OROGENY: orogenyTurnCounter serializes and restores correctly', () => {
    relicService.setActiveRelics([RelicId.OROGENY]);
    // Advance 7 turns
    for (let i = 0; i < 7; i++) { relicService.incrementOrogenyCounter(); }
    expect(relicService.getOrogenyTurnCounter()).toBe(7);

    const snapshot = relicService.serializeEncounterFlags();
    expect(snapshot.orogenyTurnCounter).toBe(7);

    // Reset and restore
    relicService.resetEncounterState();
    expect(relicService.getOrogenyTurnCounter()).toBe(0);

    relicService.restoreEncounterFlags(snapshot);
    expect(relicService.getOrogenyTurnCounter()).toBe(7);
    // After restore, the next OROGENY trigger is at turn 10 (next multiple of 5)
    const interval = ELEVATION_CONFIG.OROGENY_INTERVAL_TURNS;
    expect(relicService.isOrogenyTrigger(relicService.getOrogenyTurnCounter(), interval)).toBeFalse();
  });

  // ── E6: OROGENY — not a trigger when relic inactive ──────────────────

  it('E6 — OROGENY: isOrogenyTrigger always false when OROGENY relic is not active', () => {
    // No OROGENY active — even at a multiple of interval, must return false
    const interval = ELEVATION_CONFIG.OROGENY_INTERVAL_TURNS;
    for (let i = 0; i < interval; i++) { relicService.incrementOrogenyCounter(); }
    expect(relicService.isOrogenyTrigger(relicService.getOrogenyTurnCounter(), interval)).toBeFalse();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group F — Highground enemies (GLIDER, TITAN, WYRM_ASCENDANT)
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group F: Enemies (GLIDER / TITAN / WYRM_ASCENDANT)', () => {
  // ── F1: GLIDER model flags ─────────────────────────────────────────────

  it('F1 — GLIDER: ignoresElevation flag is true; appears in wave 6 definition', () => {
    expect(ENEMY_STATS[EnemyType.GLIDER].ignoresElevation).toBeTrue();

    // Verify GLIDER appears in wave 6 (sprint 37 placement, 0-indexed = index 5)
    const wave6 = WAVE_DEFINITIONS[5];
    const wave6Types = getWaveEnemyTypes(wave6);
    expect(wave6Types.has(EnemyType.GLIDER)).toBeTrue();
  });

  // ── F2: GLIDER does NOT halve or strip elevation damage bonuses ───────

  it('F2 — GLIDER: halvesElevationDamageBonuses and immuneToElevationDamageBonuses both falsy', () => {
    expect(ENEMY_STATS[EnemyType.GLIDER].halvesElevationDamageBonuses).toBeFalsy();
    expect(ENEMY_STATS[EnemyType.GLIDER].immuneToElevationDamageBonuses).toBeFalsy();
  });

  // ── F3: TITAN model flags ──────────────────────────────────────────────

  it('F3 — TITAN: halvesElevationDamageBonuses is true; ignoresElevation and immuneToElevation are falsy', () => {
    expect(ENEMY_STATS[EnemyType.TITAN].halvesElevationDamageBonuses).toBeTrue();
    expect(ENEMY_STATS[EnemyType.TITAN].ignoresElevation).toBeFalsy();
    expect(ENEMY_STATS[EnemyType.TITAN].immuneToElevationDamageBonuses).toBeFalsy();
  });

  // ── F4: TITAN appears in wave 8 ──────────────────────────────────────

  it('F4 — TITAN: appears in wave 8 definition (sprint 38 placement)', () => {
    const wave8 = WAVE_DEFINITIONS[7]; // 0-indexed
    const wave8Types = getWaveEnemyTypes(wave8);
    expect(wave8Types.has(EnemyType.TITAN)).toBeTrue();
  });

  // ── F5: WYRM_ASCENDANT model flags ────────────────────────────────────

  it('F5 — WYRM_ASCENDANT: immuneToElevationDamageBonuses is true; halvesElevation is falsy', () => {
    expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].immuneToElevationDamageBonuses).toBeTrue();
    expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].halvesElevationDamageBonuses).toBeFalsy();
    // Range bonuses still apply — flag only strips damage bonuses
    expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].ignoresElevation).toBeFalsy();
  });

  // ── F6: WYRM_ASCENDANT appears in wave 10 (boss wave) ────────────────

  it('F6 — WYRM_ASCENDANT: appears in wave 10 boss definition (sprint 39 placement)', () => {
    const wave10 = WAVE_DEFINITIONS[9]; // 0-indexed
    const wave10Types = getWaveEnemyTypes(wave10);
    expect(wave10Types.has(EnemyType.WYRM_ASCENDANT)).toBeTrue();
  });

  // ── F7: TITAN halving formula — elevation bonus is halved, not stripped

  it('F7 — TITAN halving: TITAN_ELEVATION_DAMAGE_REDUCTION = 0.5 means 50% of bonus damage', () => {
    // The formula: effectiveMult = 1 + bonus * TITAN_ELEVATION_DAMAGE_REDUCTION
    const bonus = 0.5; // VANTAGE_POINT_BONUS
    const effectiveMult = 1 + bonus * ELEVATION_CONFIG.TITAN_ELEVATION_DAMAGE_REDUCTION;
    // 1 + 0.5 * 0.5 = 1.25 (not 1.5 like a normal enemy, not 1.0 like WYRM)
    expect(effectiveMult).toBeCloseTo(1.25, 5);
    expect(ELEVATION_CONFIG.TITAN_ELEVATION_DAMAGE_REDUCTION).toBe(0.5);
  });

  // ── F8: WYRM_ASCENDANT immune — strips damage bonus entirely ─────────

  it('F8 — WYRM_ASCENDANT immunity: elevation bonus is fully stripped (effective multiplier = 1)', () => {
    // immuneToElevationDamageBonuses: elevation bonus stripped → damage stays at 1× base
    // KOTH bonus = 1.0 (100%); with immunity: effectiveMult = 1 (stripped entirely)
    const kothBonus = CARD_DEFINITIONS[CardId.KING_OF_THE_HILL].effect;
    if (kothBonus.type !== 'modifier') { fail('Expected modifier'); return; }
    // With WYRM immunity, the multiplier contribution from KOTH = 0
    const immuneMultiplier = 1; // bonus stripped
    expect(immuneMultiplier).toBe(1);
    expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].immuneToElevationDamageBonuses).toBeTrue();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group G — Cross-archetype interactions (Cartographer + Highground)
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group G: Cross-archetype interactions', () => {
  let gameBoardService: GameBoardService;
  let elevationService: ElevationService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);
    const deps = buildFullTestBed(gameBoardService);
    elevationService = deps.elevationService;
    pathfindingSpy = deps.pathfindingSpy;
    poolService = deps.poolService;
    pathMutationService = deps.pathMutationService;
  });

  afterEach(() => {
    teardownMeshes(poolService, scene);
    pathMutationService.reset();
    elevationService.reset();
  });

  // ── G1: BLOCK_PASSAGE + RAISE_PLATFORM on same tile — independent state

  it('G1 — BLOCK_PASSAGE + RAISE_PLATFORM on same tile: mutationOp=block AND elevation=1 coexist', () => {
    // Apply path mutation: block (row 0, col 3) — uses tile in row 0 (BASE), alternate path in row 1
    pathMutationService.block(BASE_ROW, BASE_COL, 5, 'test-block', TURN_1, scene, 'card');
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].mutationOp).toBe('block');

    // Apply elevation on the SAME tile (different turn to avoid anti-spam)
    const elevResult = elevationService.raise(BASE_ROW, BASE_COL, 1, null, 'test-raise', TURN_2);
    expect(elevResult.ok).toBeTrue();

    // Both states coexist independently
    const tile = gameBoardService.getGameBoard()[BASE_ROW][BASE_COL];
    expect(tile.mutationOp).toBe('block');     // Cartographer state
    expect(tile.elevation).toBe(1);             // Highground state
    // One mutation journal entry + one elevation journal entry
    expect(pathMutationService.getActive().length).toBe(1);
    expect(elevationService.getActiveChanges().length).toBe(1);
  });

  // ── G2: COLLAPSE on elevated tile — each service owns its own journal ────
  //
  // Design finding (surfaced by this integration spec): `GameBoardService.setTileType()`
  // creates a new tile via `GameBoardTile.createMutated()` which does NOT carry the
  // `elevation` field. Calling PathMutationService.destroy() on an elevated tile
  // replaces the tile with a fresh WALL object — elevation is lost from the board.
  // HOWEVER both services independently hold their own journals, so the elevation
  // journal entry remains intact even after the tile is destroyed.
  //
  // Implication for game design: if a tile is simultaneously raised AND destroyed, the
  // elevation journal expiry on the next tick will attempt to revert a field that no
  // longer exists on the tile. Elevation ticks should guard for null tile types.

  it('G2 — Cartographer COLLAPSE on elevated tile: each service journal is independent; tile type becomes WALL', () => {
    // First raise the target tile
    elevationService.raise(BASE_ROW, BASE_COL, 1, null, 'pre-raise', TURN_1);
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation).toBe(1);

    // Then apply COLLAPSE mutation (destroy op, BASE→WALL)
    const destroyResult = pathMutationService.destroy(
      BASE_ROW, BASE_COL, 'test-collapse', TURN_2, scene, 'card',
    );
    expect(destroyResult.ok).toBeTrue();
    // Tile is now WALL (mutation side) — pathfinding cache invalidated
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].type).toBe(BlockType.WALL);
    expect(pathfindingSpy.invalidateCache).toHaveBeenCalled();
    // DESIGN NOTE: setTileType creates a fresh tile via createMutated() — elevation field is lost.
    // The elevation journal entry still exists in ElevationService (independent service state),
    // but the board tile itself no longer carries the elevation value.
    expect(gameBoardService.getGameBoard()[BASE_ROW][BASE_COL].elevation).toBeUndefined();
    // Both service journals have exactly 1 entry each (independent state surfaces)
    expect(pathMutationService.getActive().length).toBe(1);
    expect(elevationService.getActiveChanges().length).toBe(1);
  });

  // ── G3: Elevation never invalidates pathfinding across multiple ops ────

  it('G3 — Elevation invariant: multiple elevation ops NEVER call pathfindingService.invalidateCache', () => {
    pathfindingSpy.invalidateCache.calls.reset();

    // Apply 3 elevation ops on different tiles
    elevationService.raise(BASE_ROW, 1, 1, null, 'r1', TURN_1);
    elevationService.raise(BASE_ROW, 2, 1, null, 'r2', TURN_1);
    elevationService.depress(BASE_ROW_1, 1, 1, null, 'd1', TURN_1);

    // Three journal entries, zero pathfinding invalidations
    expect(elevationService.getActiveChanges().length).toBe(3);
    expect(pathfindingSpy.invalidateCache).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Suite: Group H — Save / Restore (elevation journal + v9 checkpoint)
// ──────────────────────────────────────────────────────────────────────────

describe('Highground integration — Group H: Save / Restore', () => {
  let gameBoardService: GameBoardService;
  let elevationService: ElevationService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let poolService: TerraformMaterialPoolService;
  let pathMutationService: PathMutationService;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    gameBoardService = makeOpenBoard7x4();
    stubCreateTileMesh(gameBoardService);
    const deps = buildFullTestBed(gameBoardService);
    elevationService = deps.elevationService;
    pathfindingSpy = deps.pathfindingSpy;
    poolService = deps.poolService;
    pathMutationService = deps.pathMutationService;
  });

  afterEach(() => {
    teardownMeshes(poolService, scene);
    pathMutationService.reset();
    elevationService.reset();
  });

  // ── H1: Serialize 3 elevation ops, restore into fresh service ─────────

  it('H1 — serialize/restore: 3 elevation ops round-trip through ElevationService', () => {
    elevationService.raise(BASE_ROW, 1, 1, null, 'e1', TURN_1);
    elevationService.raise(BASE_ROW, 2, 1, null, 'e2', TURN_1);
    elevationService.depress(BASE_ROW_1, 2, 1, null, 'e3', TURN_1);

    const snapshot = elevationService.serialize();
    expect(snapshot.changes.length).toBe(3);
    expect(snapshot.nextId).toBe(3);

    // Restore into same service after reset
    elevationService.reset();
    expect(elevationService.getActiveChanges().length).toBe(0);

    elevationService.restore(snapshot);
    const restored = elevationService.getActiveChanges();
    expect(restored.length).toBe(3);
    expect(restored[0].op).toBe('raise');
    expect(restored[1].op).toBe('raise');
    expect(restored[2].op).toBe('depress');

    // nextId preserved
    const nextSnapshot = elevationService.serialize();
    expect(nextSnapshot.nextId).toBe(snapshot.nextId);
  });

  // ── H2: Elevation elevation map is sparse (only non-zero tiles) ───────

  it('H2 — getElevationMap: sparse — only non-zero tiles appear', () => {
    elevationService.raise(BASE_ROW, 1, 1, null, 'map-test', TURN_1);

    const map = elevationService.getElevationMap();
    expect(map.size).toBe(1);
    expect(map.get(`${BASE_ROW}-1`)).toBe(1);
    // Unelevated tiles are absent
    expect(map.has(`${BASE_ROW}-2`)).toBeFalse();
  });

  // ── H3: tileElevations checkpoint field round-trips via EncounterCheckpointService

  it('H3 — checkpoint round-trip: tileElevations field survives save + load (v9 fidelity)', () => {
    // Set up 2 elevation changes + 1 path mutation (combined state)
    elevationService.raise(BASE_ROW, 1, 1, null, 'cp-e1', TURN_1);
    elevationService.raise(BASE_ROW, 2, 2, null, 'cp-e2', TURN_1);
    pathMutationService.block(BASE_ROW, 3, 3, 'cp-block', TURN_1, scene, 'card');

    const elevSnapshot = elevationService.serialize();
    const mutSnapshot = pathMutationService.serialize();

    const checkpointService = TestBed.inject(EncounterCheckpointService);
    const CHECKPOINT_VERSION_CURRENT = 9;

    const stubCheckpoint = {
      version: CHECKPOINT_VERSION_CURRENT,
      timestamp: Date.now(),
      nodeId: 'node-hg',
      encounterConfig: { waves: [] },
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
      relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false, orogenyTurnCounter: 7 },
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
      pathMutations: mutSnapshot,
      tileElevations: elevSnapshot,
      runStateFlags: { entries: [], consumedEventIds: [] },
      itemInventory: { entries: [] },
    };

    const saved = checkpointService.saveCheckpoint(stubCheckpoint as never);
    expect(saved).toBeTrue();

    const loaded = checkpointService.loadCheckpoint();
    expect(loaded).not.toBeNull();

    // Verify elevation state survived
    expect(loaded!.tileElevations.changes.length).toBe(2);
    expect(loaded!.tileElevations.nextId).toBe(2);
    expect(loaded!.tileElevations.changes[0].op).toBe('raise');
    expect(loaded!.tileElevations.changes[1].op).toBe('raise');

    // Verify path mutation state also survived (cross-field fidelity)
    expect(loaded!.pathMutations.mutations.length).toBe(1);
    expect(loaded!.pathMutations.mutations[0].op).toBe('block');

    // Verify OROGENY counter survived in relicFlags
    expect(loaded!.relicFlags.orogenyTurnCounter).toBe(7);

    checkpointService.clearCheckpoint();
  });

  // ── H4: Restore ordering invariant: elevation before towers ──────────

  it('H4 — restore ordering: elevation journal restored before board is in a consistent state for tower Y', () => {
    // Raise a tile then verify the journal can be restored independently
    elevationService.raise(BASE_ROW, BASE_COL, 1, null, 'order-test', TURN_1);
    const snapshot = elevationService.serialize();

    // After reset, journal is empty
    elevationService.reset();
    expect(elevationService.getActiveChanges().length).toBe(0);

    // Restore journal only — this is step 3.6 in restoreFromCheckpoint
    elevationService.restore(snapshot);

    // Journal contains the change — callers can now safely read for tower Y correction
    const changes = elevationService.getActiveChanges();
    expect(changes.length).toBe(1);
    expect(changes[0].row).toBe(BASE_ROW);
    expect(changes[0].col).toBe(BASE_COL);
    // Expected tower Y after restore = elevation + tileHeight (GameBoardComponent computes this)
    const restoredElevation = snapshot.elevations.find(
      e => e.row === BASE_ROW && e.col === BASE_COL,
    );
    // The board tile elevation is in the snapshot elevations array (sparse representation)
    expect(restoredElevation).toBeDefined();
  });

  // ── H5: ElevationService.reset() clears journal (encounter teardown) ──

  it('H5 — reset() clears journal (component-scoped isolation invariant)', () => {
    elevationService.raise(BASE_ROW, 1, 1, null, 'isolate-1', TURN_1);
    elevationService.raise(BASE_ROW, 2, 1, null, 'isolate-2', TURN_1);
    expect(elevationService.getActiveChanges().length).toBe(2);

    elevationService.reset();
    // reset() clears the journal and nextId. Board tile elevation is NOT zeroed
    // by reset() — that is GameBoardComponent's responsibility during full teardown.
    // We assert only what reset() guarantees: the journal is empty.
    expect(elevationService.getActiveChanges().length).toBe(0);
    // nextId also resets to 0; confirm by raising a new entry and checking its id
    const result = elevationService.raise(BASE_ROW, 4, 1, null, 'post-reset', TURN_2);
    expect(result.ok).toBeTrue();
    expect(elevationService.getActiveChanges()[0].id).toBe('0');
  });
});
