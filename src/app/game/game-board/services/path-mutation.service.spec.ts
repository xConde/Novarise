import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { PathMutationService } from './path-mutation.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { PathfindingService } from './pathfinding.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { SerializablePathMutationState } from './path-mutation.types';
import { TowerType } from '../models/tower.model';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a GameBoardTile[][] of all BASE tiles of given (cols) width × (rows) height. */
function makeBoard(rows: number, cols: number): GameBoardTile[][] {
  const board: GameBoardTile[][] = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = GameBoardTile.createBase(c, r);
    }
  }
  return board;
}

/**
 * Create a minimal board wired as a real GameBoardService so that
 * setTileType / wouldBlockPathIfSet / getGameBoard all work correctly.
 *
 * Board layout (7×4):
 *
 *   Row 0: SPAWNER | BASE | BASE | BASE | BASE | BASE | EXIT
 *   Row 1: SPAWNER | BASE | BASE | BASE | BASE | BASE | EXIT
 *   Row 2: WALL   | WALL | WALL | WALL | WALL | WALL | WALL
 *   Row 3: WALL   | WALL | WALL | WALL | WALL | WALL | WALL
 *
 * Two rows of traversable tiles so individual block mutations don't
 * immediately cut all spawner→exit paths. Tests that need a chokepoint
 * block both rows explicitly.
 *
 * Wall tiles at rows 1-2 are also available as targets for `build` and
 * `bridgehead` mutations.
 */
function makeOpenBoard7x4(): GameBoardService {
  const svc = new GameBoardService();
  const board = makeBoard(4, 7);

  // Spawner group: column 0, rows 0-1
  board[0][0] = GameBoardTile.createSpawner(0, 0);
  board[1][0] = GameBoardTile.createSpawner(0, 1);

  // Exit group: column 6, rows 0-1
  board[0][6] = GameBoardTile.createExit(6, 0);
  board[1][6] = GameBoardTile.createExit(6, 1);

  // Rows 2-3 are all wall
  for (let col = 0; col < 7; col++) {
    board[2][col] = GameBoardTile.createWall(col, 2);
    board[3][col] = GameBoardTile.createWall(col, 3);
  }

  svc.importBoard(board, 7, 4);
  return svc;
}

/** Create a fake THREE.Scene that silently accepts add/remove. */
function makeScene(): THREE.Scene {
  return new THREE.Scene();
}

describe('PathMutationService', () => {
  let service: PathMutationService;
  let gameBoardService: GameBoardService;
  let pathfindingSpy: jasmine.SpyObj<PathfindingService>;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let scene: THREE.Scene;

  /** Meshes created during tests — disposed in afterEach. */
  const createdMeshes: THREE.Mesh[] = [];

  beforeEach(() => {
    scene = makeScene();
    gameBoardService = makeOpenBoard7x4();

    pathfindingSpy = jasmine.createSpyObj<PathfindingService>('PathfindingService', [
      'invalidateCache',
      'findPath',
    ]);

    // Registry: spy on replaceTileMesh + rebuildTileMeshArray, but keep tileMeshes real.
    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'replaceTileMesh',
      'rebuildTileMeshArray',
    ]);
    (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes =
      new Map<string, THREE.Mesh>();

    TestBed.configureTestingModule({
      providers: [
        PathMutationService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: PathfindingService, useValue: pathfindingSpy },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
      ],
    });

    service = TestBed.inject(PathMutationService);

    // Wire the repath hook (normally done by GameBoardComponent.ngOnInit)
    service.setRepathHook(() => { /* no-op in unit tests */ });

    // Stub createTileMesh so swapMesh doesn't need real WebGL
    spyOn(gameBoardService, 'createTileMesh').and.callFake((row: number, col: number) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial(),
      );
      createdMeshes.push(m);
      m.userData = { row, col };
      return m;
    });
  });

  afterEach(() => {
    for (const m of createdMeshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    createdMeshes.length = 0;
    scene.clear();
    service.reset();
  });

  // ── Creation ────────────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getActive() starts empty', () => {
    expect(service.getActive().length).toBe(0);
  });

  it('turnsSinceLastMutation(currentTurn) returns Infinity with no mutations', () => {
    expect(service.turnsSinceLastMutation(5)).toBe(Infinity);
  });

  it('wasMutatedInLastTurns is false when journal is empty', () => {
    expect(service.wasMutatedInLastTurns(5, 3)).toBeFalse();
  });

  // ── block — succeeds on BASE tile ─────────────────────────────────────────
  // Board: row 0 and 1 are BASE path rows; blocking one tile in row 0 leaves
  // row 1 as an alternative path, so wouldBlockPathIfSet returns false.

  describe('block — succeeds on BASE', () => {
    it('returns ok:true', () => {
      // Block a tile in the middle of row 0 (row 1 provides alternative path)
      const result = service.block(0, 3, 3, 'test-card', 1, scene);
      expect(result.ok).toBeTrue();
    });

    it('journal grows by 1', () => {
      service.block(0, 3, 3, 'test-card', 1, scene);
      expect(service.getActive().length).toBe(1);
    });

    it('mutation has correct fields', () => {
      service.block(0, 3, 3, 'test-card', 1, scene);
      const m = service.getActive()[0];
      expect(m.op).toBe('block');
      expect(m.row).toBe(0);
      expect(m.col).toBe(3);
      expect(m.appliedOnTurn).toBe(1);
      expect(m.expiresOnTurn).toBe(4);
      expect(m.priorType).toBe(BlockType.BASE);
      expect(m.source).toBe('card');
      expect(m.sourceId).toBe('test-card');
    });

    it('tile type changes to WALL on the board', () => {
      service.block(0, 3, 3, 'test-card', 1, scene);
      expect(gameBoardService.getGameBoard()[0][3].type).toBe(BlockType.WALL);
    });

    it('calls pathfindingService.invalidateCache()', () => {
      service.block(0, 3, 3, 'test-card', 1, scene);
      expect(pathfindingSpy.invalidateCache).toHaveBeenCalled();
    });

    it('calls registry.replaceTileMesh()', () => {
      service.block(0, 3, 3, 'test-card', 1, scene);
      expect(registrySpy.replaceTileMesh).toHaveBeenCalledWith(0, 3, jasmine.any(THREE.Mesh));
    });
  });

  // ── build — succeeds on WALL tile ─────────────────────────────────────────

  describe('build — succeeds on WALL tile', () => {
    it('converts WALL → BASE', () => {
      // Rows 2-3 are all WALL — build on (2,3)
      const result = service.build(2, 3, null, 'test-card', 1, scene);
      expect(result.ok).toBeTrue();
      expect(gameBoardService.getGameBoard()[2][3].type).toBe(BlockType.BASE);
    });

    it('mutation op is build', () => {
      service.build(2, 3, null, 'test-card', 1, scene);
      expect(service.getActive()[0].op).toBe('build');
    });

    it('permanent build has expiresOnTurn = null', () => {
      service.build(2, 3, null, 'test-card', 1, scene);
      expect(service.getActive()[0].expiresOnTurn).toBeNull();
    });

    it('temporary build has computed expiresOnTurn', () => {
      service.build(2, 3, 5, 'test-card', 2, scene);
      expect(service.getActive()[0].expiresOnTurn).toBe(7);
    });
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  describe('destroy — always permanent', () => {
    it('converts BASE → WALL', () => {
      // Block a mid-corridor tile; row 1 provides alternative path
      const result = service.destroy(0, 3, 'blast-card', 1, scene);
      expect(result.ok).toBeTrue();
      expect(gameBoardService.getGameBoard()[0][3].type).toBe(BlockType.WALL);
    });

    it('expiresOnTurn is null', () => {
      service.destroy(0, 3, 'blast-card', 1, scene);
      expect(service.getActive()[0].expiresOnTurn).toBeNull();
    });

    it('op is destroy', () => {
      service.destroy(0, 3, 'blast-card', 1, scene);
      expect(service.getActive()[0].op).toBe('destroy');
    });
  });

  // ── bridgehead ────────────────────────────────────────────────────────────

  describe('bridgehead — WALL tile marked with bridgehead op', () => {
    it('returns ok:true', () => {
      // Apply bridgehead on a WALL tile (rows 2-3)
      const result = service.bridgehead(2, 3, 3, 'bh-card', 1, scene);
      expect(result.ok).toBeTrue();
    });

    it('tile type is WALL (non-traversable)', () => {
      service.bridgehead(2, 3, 3, 'bh-card', 1, scene);
      const tile = gameBoardService.getGameBoard()[2][3];
      expect(tile.type).toBe(BlockType.WALL);
      expect(tile.isTraversable).toBeFalse();
    });

    it('tile mutationOp is bridgehead', () => {
      service.bridgehead(2, 3, 3, 'bh-card', 1, scene);
      const tile = gameBoardService.getGameBoard()[2][3];
      expect(tile.mutationOp).toBe('bridgehead');
    });

    it('mutation op in journal is bridgehead', () => {
      service.bridgehead(2, 3, 3, 'bh-card', 1, scene);
      expect(service.getActive()[0].op).toBe('bridgehead');
    });
  });

  // ── Validation — rejection cases ──────────────────────────────────────────

  // Board dimensions: 7 cols × 4 rows
  describe('Validation: out-of-bounds', () => {
    it('rejects negative row', () => {
      const r = service.block(-1, 3, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('out-of-bounds');
    });

    it('rejects row >= boardHeight (4)', () => {
      const r = service.block(4, 3, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('out-of-bounds');
    });

    it('rejects negative col', () => {
      const r = service.block(0, -1, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('out-of-bounds');
    });

    it('rejects col >= boardWidth (7)', () => {
      const r = service.block(0, 7, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('out-of-bounds');
    });
  });

  describe('Validation: spawner-or-exit', () => {
    it('rejects mutation on SPAWNER tile', () => {
      // (0,0) is SPAWNER
      const r = service.block(0, 0, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('spawner-or-exit');
    });

    it('rejects mutation on EXIT tile', () => {
      // (0,6) is EXIT
      const r = service.block(0, 6, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('spawner-or-exit');
    });
  });

  describe('Validation: tower-occupied', () => {
    it('rejects mutation when tile has a TOWER', () => {
      // Place tower at (0,3) — a mid-corridor BASE tile that won't block paths
      gameBoardService.placeTower(0, 3, TowerType.BASIC);
      const r = service.build(0, 3, null, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('tower-occupied');
    });
  });

  describe('Validation: already-mutated-this-turn', () => {
    it('rejects second mutation on same tile in the same turn', () => {
      // First block succeeds (row 1 is alternative path, not blocked)
      const r1 = service.block(0, 3, 3, 'c', 1, scene);
      expect(r1.ok).toBeTrue();
      // Second mutation — same tile, same turn — should be rejected before no-op check
      // The tile is now WALL; build(BASE) would not be no-op, but anti-spam fires first
      const r2 = service.build(0, 3, null, 'c', 1, scene);
      expect(r2.ok).toBeFalse();
      expect(r2.reason).toBe('already-mutated-this-turn');
    });

    it('allows a second mutation on a different turn after expiry', () => {
      service.block(0, 3, 3, 'c', 1, scene); // expiresOnTurn = 4
      service.tickTurn(4, scene); // Expire the block — tile back to BASE
      const r2 = service.block(0, 3, 3, 'c', 2, scene);
      expect(r2.ok).toBeTrue();
    });
  });

  describe('Validation: no-op', () => {
    it('rejects block on an already-WALL tile', () => {
      // Row 2 is already all WALL
      const r = service.block(2, 3, 3, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('no-op');
    });

    it('rejects build on an already-BASE tile', () => {
      // Row 0, col 3 is already BASE
      const r = service.build(0, 3, null, 'c', 1, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('no-op');
    });
  });

  describe('Validation: would-block-all-paths', () => {
    it('rejects block mutation that cuts both path rows', () => {
      // Block col 3 on both row 0 and row 1 — this cuts all paths (turn 1 and turn 2).
      service.block(0, 3, 5, 'c', 1, scene); // blocks row 0 col 3
      // Now only row 1 col 3 remains; blocking it would cut all paths
      const r = service.block(1, 3, 5, 'c', 2, scene);
      expect(r.ok).toBeFalse();
      expect(r.reason).toBe('would-block-all-paths');
    });
  });

  // ── Query methods ─────────────────────────────────────────────────────────

  describe('isPlayerBuilt / isPlayerBlocked / isPlayerDestroyed', () => {
    it('isPlayerBuilt returns true after build', () => {
      service.build(2, 3, null, 'c', 1, scene); // WALL tile → BASE
      expect(service.isPlayerBuilt(2, 3)).toBeTrue();
    });

    it('isPlayerBuilt returns false for block', () => {
      service.block(0, 3, 3, 'c', 1, scene); // BASE tile → WALL
      expect(service.isPlayerBuilt(0, 3)).toBeFalse();
    });

    it('isPlayerBlocked returns true after block', () => {
      service.block(0, 3, 3, 'c', 1, scene);
      expect(service.isPlayerBlocked(0, 3)).toBeTrue();
    });

    it('isPlayerBlocked returns true after destroy', () => {
      service.destroy(0, 3, 'c', 1, scene);
      expect(service.isPlayerBlocked(0, 3)).toBeTrue();
    });

    it('isPlayerDestroyed returns true after destroy', () => {
      service.destroy(0, 3, 'c', 1, scene);
      expect(service.isPlayerDestroyed(0, 3)).toBeTrue();
    });

    it('isPlayerDestroyed returns false after block', () => {
      service.block(0, 3, 3, 'c', 1, scene);
      expect(service.isPlayerDestroyed(0, 3)).toBeFalse();
    });
  });

  describe('turnsSinceLastMutation', () => {
    it('returns Infinity with no mutations regardless of currentTurn', () => {
      expect(service.turnsSinceLastMutation(0)).toBe(Infinity);
      expect(service.turnsSinceLastMutation(100)).toBe(Infinity);
    });

    it('returns correct delta from the most recent mutation', () => {
      service.block(0, 2, 3, 'c', 5, scene);
      expect(service.turnsSinceLastMutation(5)).toBe(0);
      expect(service.turnsSinceLastMutation(6)).toBe(1);
      expect(service.turnsSinceLastMutation(8)).toBe(3);
    });

    it('uses the LATEST applied-on-turn when multiple mutations exist', () => {
      service.block(0, 2, 5, 'a', 3, scene);
      service.block(0, 4, 5, 'b', 7, scene);
      expect(service.turnsSinceLastMutation(10)).toBe(3);
    });
  });

  describe('wasMutatedInLastTurns', () => {
    it('returns false when journal is empty', () => {
      expect(service.wasMutatedInLastTurns(5, 3)).toBeFalse();
    });

    it('returns true when the most recent mutation is within window', () => {
      service.block(0, 3, 3, 'c', 9, scene);
      expect(service.wasMutatedInLastTurns(10, 3)).toBeTrue();  // 1 turn ago
      expect(service.wasMutatedInLastTurns(12, 3)).toBeTrue();  // 3 turns ago (edge)
    });

    it('returns false when the most recent mutation is outside window', () => {
      service.block(0, 3, 3, 'c', 9, scene);
      expect(service.wasMutatedInLastTurns(13, 3)).toBeFalse(); // 4 turns ago
    });

    it('respects the latest mutation, not the earliest', () => {
      service.block(0, 2, 5, 'a', 1, scene);
      service.block(0, 4, 5, 'b', 8, scene);
      // Earliest = 1, latest = 8. At turn 10, only 2 turns since the latest.
      expect(service.wasMutatedInLastTurns(10, 3)).toBeTrue();
    });
  });

  // ── tickTurn — expire ─────────────────────────────────────────────────────

  describe('tickTurn expiry', () => {
    it('removes expired mutations from journal', () => {
      service.block(0, 3, 3, 'c', 1, scene); // expiresOnTurn = 4
      expect(service.getActive().length).toBe(1);

      service.tickTurn(4, scene);

      expect(service.getActive().length).toBe(0);
    });

    it('restores tile to priorType on expiry', () => {
      service.block(0, 3, 3, 'c', 1, scene);
      expect(gameBoardService.getGameBoard()[0][3].type).toBe(BlockType.WALL);

      service.tickTurn(4, scene);

      expect(gameBoardService.getGameBoard()[0][3].type).toBe(BlockType.BASE);
    });

    it('invalidates path cache on expiry', () => {
      service.block(0, 3, 3, 'c', 1, scene);
      pathfindingSpy.invalidateCache.calls.reset();

      service.tickTurn(4, scene);

      expect(pathfindingSpy.invalidateCache).toHaveBeenCalled();
    });

    it('does not expire mutations whose expiresOnTurn !== currentTurn', () => {
      service.block(0, 3, 5, 'c', 1, scene); // expiresOnTurn = 6
      service.tickTurn(4, scene);
      expect(service.getActive().length).toBe(1);
    });

    it('only expires mutations for the matching turn', () => {
      service.block(0, 3, 2, 'c', 1, scene); // expiresOnTurn = 3
      service.build(2, 3, 4, 'c', 1, scene);  // expiresOnTurn = 5 (on WALL row)

      service.tickTurn(3, scene);

      expect(service.getActive().length).toBe(1);
      expect(service.getActive()[0].op).toBe('build');
    });

    it('does not expire permanent mutations (expiresOnTurn = null)', () => {
      service.destroy(0, 3, 'c', 1, scene); // permanent
      service.tickTurn(1, scene);
      expect(service.getActive().length).toBe(1);
    });
  });

  // ── Multi-mutation sequence ───────────────────────────────────────────────

  describe('multi-mutation sequence: three independent expirations', () => {
    it('each mutation expires independently', () => {
      // block a BASE tile (row 0, row 1 provides alternative path)
      service.block(0, 3, 2, 'c1', 1, scene); // expires turn 3
      // build on WALL tiles (rows 2-3 are all WALL)
      service.build(2, 3, 3, 'c2', 1, scene); // expires turn 4
      service.build(2, 4, 4, 'c3', 1, scene); // expires turn 5

      expect(service.getActive().length).toBe(3);

      service.tickTurn(3, scene);
      expect(service.getActive().length).toBe(2);
      // block expired: tile (0,3) restored to BASE
      expect(gameBoardService.getGameBoard()[0][3].type).toBe(BlockType.BASE);

      service.tickTurn(4, scene);
      expect(service.getActive().length).toBe(1);
      // first build expired: tile (2,3) restored to WALL
      expect(gameBoardService.getGameBoard()[2][3].type).toBe(BlockType.WALL);

      service.tickTurn(5, scene);
      expect(service.getActive().length).toBe(0);
      // second build expired: tile (2,4) restored to WALL
      expect(gameBoardService.getGameBoard()[2][4].type).toBe(BlockType.WALL);
    });
  });

  // ── serialize / restore ───────────────────────────────────────────────────

  describe('serialize / restore round-trip', () => {
    it('serialize returns empty state when journal is empty', () => {
      const s = service.serialize();
      expect(s.mutations.length).toBe(0);
      expect(s.nextId).toBe(0);
    });

    it('round-trip preserves mutations and nextId', () => {
      service.block(0, 3, 3, 'c1', 1, scene);  // BASE → WALL
      service.build(2, 3, null, 'c2', 2, scene); // WALL → BASE
      const snapshot = service.serialize();
      expect(snapshot.nextId).toBe(2);

      service.reset();
      expect(service.getActive().length).toBe(0);

      service.restore(snapshot);
      expect(service.getActive().length).toBe(2);
      expect(service.serialize().nextId).toBe(2);

      const m0 = service.getActive()[0];
      expect(m0.op).toBe('block');
      expect(m0.row).toBe(0);
      expect(m0.col).toBe(3);
      expect(m0.expiresOnTurn).toBe(4);

      const m1 = service.getActive()[1];
      expect(m1.op).toBe('build');
      expect(m1.expiresOnTurn).toBeNull();
    });

    it('restored nextId ensures new IDs do not collide with restored ones', () => {
      service.block(0, 3, 3, 'c1', 1, scene);
      const snapshot = service.serialize(); // nextId = 1

      service.reset();
      service.restore(snapshot);

      // Apply another mutation — its id should be '1' (not '0' again)
      service.build(2, 3, null, 'c2', 2, scene);
      expect(service.getActive()[1].id).toBe('1');
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears journal', () => {
      service.block(0, 2, 3, 'c', 1, scene);
      service.reset();
      expect(service.getActive().length).toBe(0);
    });

    it('resets nextId to 0', () => {
      service.block(0, 2, 3, 'c', 1, scene);
      service.reset();
      const s = service.serialize();
      expect(s.nextId).toBe(0);
    });
  });

  // ── Mesh disposal assertions ───────────────────────────────────────────────

  describe('mesh disposal on mutation revert', () => {
    it('disposes old mesh geometry and material when swapMesh is called', () => {
      const oldMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial(),
      );
      createdMeshes.push(oldMesh);

      // Put old mesh in the registry map so swapMesh finds it at (0,3)
      (registrySpy as unknown as { tileMeshes: Map<string, THREE.Mesh> })
        .tileMeshes.set('0-3', oldMesh);
      scene.add(oldMesh);

      spyOn(oldMesh.geometry, 'dispose');
      spyOn(oldMesh.material as THREE.Material, 'dispose');

      // block(0,3) triggers swapMesh which disposes oldMesh
      service.block(0, 3, 3, 'c', 1, scene);

      expect(oldMesh.geometry.dispose).toHaveBeenCalled();
      expect((oldMesh.material as THREE.Material).dispose).toHaveBeenCalled();
    });
  });

  // ── Perf stress spec (Step 9) ─────────────────────────────────────────────

  describe('perf: 10 mutations in a single turn', () => {
    it('10 apply calls complete in under 50ms on a 25×20 board', () => {
      // Build a real 25×20 board with spawner + exit
      const svc25x20 = new GameBoardService();
      const board = makeBoard(20, 25);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][1] = GameBoardTile.createSpawner(1, 0);
      board[19][24] = GameBoardTile.createExit(24, 19);
      svc25x20.importBoard(board, 25, 20);

      const pfService = jasmine.createSpyObj<PathfindingService>('PathfindingService', [
        'invalidateCache',
        'findPath',
      ]);
      const regService = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
        'replaceTileMesh',
        'rebuildTileMeshArray',
      ]);
      (regService as unknown as { tileMeshes: Map<string, THREE.Mesh> }).tileMeshes =
        new Map<string, THREE.Mesh>();

      const bigService = new PathMutationService(svc25x20, regService, pfService);
      bigService.setRepathHook(() => { /* no-op */ });

      spyOn(svc25x20, 'createTileMesh').and.callFake((row: number, col: number) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial(),
        );
        createdMeshes.push(m);
        m.userData = { row, col };
        return m;
      });

      const perfScene = new THREE.Scene();

      // Apply 10 mutations on row 5 (all BASE tiles, non-chokepoints at mid-board)
      const start = performance.now();
      for (let col = 5; col < 15; col++) {
        bigService.block(5, col, 3, `stress-${col}`, 1, perfScene);
      }
      const elapsed = performance.now() - start;

      perfScene.clear();

      expect(elapsed).toBeLessThan(50);
      expect(bigService.getActive().length).toBe(10);
    });
  });

  // ── Empty snapshot wiring ─────────────────────────────────────────────────

  describe('empty SerializablePathMutationState (v7→v8 migration default)', () => {
    it('restore from empty snapshot leaves journal empty', () => {
      const empty: SerializablePathMutationState = { mutations: [], nextId: 0 };
      service.restore(empty);
      expect(service.getActive().length).toBe(0);
    });
  });
});
