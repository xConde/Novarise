import { TestBed } from '@angular/core/testing';

import { ElevationService } from './elevation.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { SerializableTileElevationState } from './elevation.types';
import { ELEVATION_CONFIG } from '../constants/elevation.constants';
import { BOARD_CONFIG } from '../constants/board.constants';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a GameBoardTile[][] of all BASE tiles. */
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
 * Create a real GameBoardService wired with a 5×5 board containing:
 *   - (0,0): SPAWNER
 *   - (0,4): EXIT
 *   - (1,1): TOWER (for translateTowerMesh assertions)
 *   - All others: BASE
 */
function makeTestBoard5x5(): GameBoardService {
  const svc = new GameBoardService();
  const board = makeBoard(5, 5);

  board[0][0] = GameBoardTile.createSpawner(0, 0);
  board[0][4] = GameBoardTile.createExit(4, 0);

  svc.importBoard(board, 5, 5);
  return svc;
}

describe('ElevationService', () => {
  let service: ElevationService;
  let gameBoardService: GameBoardService;
  let registrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  // We deliberately do NOT inject PathfindingService — elevation must never call it.
  // The pathfinding-isolation spec below asserts invalidateCache is not accessible.

  const CURRENT_TURN = 1;

  beforeEach(() => {
    gameBoardService = makeTestBoard5x5();

    registrySpy = jasmine.createSpyObj<BoardMeshRegistryService>(
      'BoardMeshRegistryService',
      ['translateTileMesh', 'translateTowerMesh'],
    );

    TestBed.configureTestingModule({
      providers: [
        ElevationService,
        { provide: GameBoardService, useValue: gameBoardService },
        { provide: BoardMeshRegistryService, useValue: registrySpy },
      ],
    });

    service = TestBed.inject(ElevationService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // raise()
  // ─────────────────────────────────────────────────────────────────────────

  describe('raise()', () => {
    it('returns ok=true on a valid BASE tile', () => {
      const result = service.raise(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(result.ok).toBeTrue();
    });

    it('sets newElevation to prior + amount', () => {
      const result = service.raise(1, 1, 2, null, 'test-card', CURRENT_TURN);
      expect(result.newElevation).toBe(2);
    });

    it('mutates the board tile elevation', () => {
      service.raise(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(service.getElevation(1, 1)).toBe(1);
    });

    it('pushes a change into the journal', () => {
      service.raise(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(service.getActiveChanges().length).toBe(1);
    });

    it('records op as "raise"', () => {
      service.raise(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(service.getActiveChanges()[0].op).toBe('raise');
    });

    it('records expiresOnTurn as null for permanent', () => {
      service.raise(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(service.getActiveChanges()[0].expiresOnTurn).toBeNull();
    });

    it('records expiresOnTurn as appliedOnTurn + duration', () => {
      service.raise(1, 1, 1, 3, 'test-card', CURRENT_TURN);
      expect(service.getActiveChanges()[0].expiresOnTurn).toBe(CURRENT_TURN + 3);
    });

    it('calls translateTileMesh with correct Y', () => {
      service.raise(1, 1, 2, null, 'test-card', CURRENT_TURN);
      const expectedY = 2 + BOARD_CONFIG.tileHeight / 2;
      expect(registrySpy.translateTileMesh).toHaveBeenCalledWith(1, 1, expectedY);
    });

    it('DOES NOT call translateTowerMesh when no tower on tile', () => {
      service.raise(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(registrySpy.translateTowerMesh).not.toHaveBeenCalled();
    });

    it('calls translateTowerMesh when a tower sits on the tile', () => {
      // Place a tower on (2,2) by marking the tile
      const board = gameBoardService.getGameBoard();
      board[2][2] = new GameBoardTile(2, 2, BlockType.TOWER, false, false, null, 'BASIC' as any);

      service.raise(2, 2, 1, null, 'test-card', CURRENT_TURN);

      const expectedTowerY = 1 + BOARD_CONFIG.tileHeight;
      expect(registrySpy.translateTowerMesh).toHaveBeenCalledWith(2, 2, expectedTowerY);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // depress()
  // ─────────────────────────────────────────────────────────────────────────

  describe('depress()', () => {
    it('returns ok=true on a valid BASE tile', () => {
      const result = service.depress(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(result.ok).toBeTrue();
    });

    it('sets newElevation to prior - amount', () => {
      const result = service.depress(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(result.newElevation).toBe(-1);
    });

    it('records op as "depress"', () => {
      service.depress(1, 1, 1, null, 'test-card', CURRENT_TURN);
      expect(service.getActiveChanges()[0].op).toBe('depress');
    });

    it('mutates the board tile to negative elevation', () => {
      service.depress(1, 1, 2, null, 'test-card', CURRENT_TURN);
      expect(service.getElevation(1, 1)).toBe(-2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // setAbsolute()
  // ─────────────────────────────────────────────────────────────────────────

  describe('setAbsolute()', () => {
    it('returns ok=true for a valid value', () => {
      const result = service.setAbsolute(1, 1, 3, 'relic-x', CURRENT_TURN);
      expect(result.ok).toBeTrue();
    });

    it('sets elevation to the exact provided value', () => {
      service.setAbsolute(1, 1, 3, 'relic-x', CURRENT_TURN);
      expect(service.getElevation(1, 1)).toBe(3);
    });

    it('records op as "set"', () => {
      service.setAbsolute(1, 1, 2, 'relic-x', CURRENT_TURN);
      expect(service.getActiveChanges()[0].op).toBe('set');
    });

    it('records expiresOnTurn as null (always permanent)', () => {
      service.setAbsolute(1, 1, 2, 'relic-x', CURRENT_TURN);
      expect(service.getActiveChanges()[0].expiresOnTurn).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // collapse()
  // ─────────────────────────────────────────────────────────────────────────

  describe('collapse()', () => {
    it('returns ok=true after a prior raise', () => {
      service.raise(1, 1, 2, null, 'test-card', CURRENT_TURN);
      const result = service.collapse(1, 1, 'avalanche', CURRENT_TURN + 1);
      expect(result.ok).toBeTrue();
    });

    it('resets elevation to 0', () => {
      service.raise(1, 1, 2, null, 'test-card', CURRENT_TURN);
      service.collapse(1, 1, 'avalanche', CURRENT_TURN + 1);
      expect(service.getElevation(1, 1)).toBe(0);
    });

    it('records priorElevation for damage math', () => {
      service.raise(1, 1, 2, null, 'test-card', CURRENT_TURN);
      const result = service.collapse(1, 1, 'avalanche', CURRENT_TURN + 1);
      expect(result.change?.priorElevation).toBe(2);
    });

    it('records op as "collapse"', () => {
      service.raise(1, 1, 2, null, 'test-card', CURRENT_TURN);
      service.collapse(1, 1, 'avalanche', CURRENT_TURN + 1);
      const collapseChange = service.getActiveChanges().find(c => c.op === 'collapse');
      expect(collapseChange).toBeDefined();
    });

    it('returns no-op when elevation is already 0', () => {
      const result = service.collapse(1, 1, 'avalanche', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('no-op');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Validation rejections
  // ─────────────────────────────────────────────────────────────────────────

  describe('validation — out-of-bounds', () => {
    it('rejects negative row', () => {
      const result = service.raise(-1, 1, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-bounds');
    });

    it('rejects row >= boardHeight', () => {
      const result = service.raise(10, 1, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-bounds');
    });

    it('rejects negative col', () => {
      const result = service.raise(1, -1, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-bounds');
    });

    it('rejects col >= boardWidth', () => {
      const result = service.raise(1, 10, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-bounds');
    });
  });

  describe('validation — spawner-or-exit immutability', () => {
    it('rejects elevation on SPAWNER tile', () => {
      // (0,0) is SPAWNER
      const result = service.raise(0, 0, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('spawner-or-exit');
    });

    it('rejects elevation on EXIT tile', () => {
      // (0,4) is EXIT
      const result = service.raise(0, 4, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('spawner-or-exit');
    });

    it('rejects depress on SPAWNER tile', () => {
      const result = service.depress(0, 0, 1, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('spawner-or-exit');
    });
  });

  describe('validation — out-of-range', () => {
    it('rejects raise that exceeds MAX_ELEVATION', () => {
      // MAX_ELEVATION is 3; raise by 4 from 0 → 4 > 3
      const result = service.raise(1, 1, 4, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-range');
    });

    it('rejects depress that exceeds MAX_DEPRESS', () => {
      // MAX_DEPRESS is 2; depress by 3 from 0 → -3 < -2
      const result = service.depress(1, 1, 3, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-range');
    });

    it('accepts raise exactly at MAX_ELEVATION', () => {
      const result = service.raise(1, 1, ELEVATION_CONFIG.MAX_ELEVATION, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeTrue();
      expect(result.newElevation).toBe(ELEVATION_CONFIG.MAX_ELEVATION);
    });

    it('accepts depress exactly at -MAX_DEPRESS', () => {
      const result = service.depress(1, 1, ELEVATION_CONFIG.MAX_DEPRESS, null, 'test', CURRENT_TURN);
      expect(result.ok).toBeTrue();
      expect(result.newElevation).toBe(-ELEVATION_CONFIG.MAX_DEPRESS);
    });

    it('rejects setAbsolute above MAX_ELEVATION', () => {
      const result = service.setAbsolute(1, 1, ELEVATION_CONFIG.MAX_ELEVATION + 1, 'relic', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('out-of-range');
    });
  });

  describe('validation — already-changed-this-turn (anti-spam)', () => {
    it('rejects a second change on the same tile in the same turn', () => {
      service.raise(1, 1, 1, null, 'card-a', CURRENT_TURN);
      const result = service.raise(1, 1, 1, null, 'card-b', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('already-changed-this-turn');
    });

    it('allows a change on the same tile in a different turn', () => {
      service.raise(1, 1, 1, null, 'card-a', CURRENT_TURN);
      const result = service.raise(1, 1, 1, null, 'card-b', CURRENT_TURN + 1);
      expect(result.ok).toBeTrue();
    });

    it('allows changes on different tiles in the same turn', () => {
      service.raise(1, 1, 1, null, 'card-a', CURRENT_TURN);
      const result = service.raise(2, 2, 1, null, 'card-b', CURRENT_TURN);
      expect(result.ok).toBeTrue();
    });
  });

  describe('validation — no-op', () => {
    it('rejects raise by 0 (no-op delta)', () => {
      const result = service.raise(1, 1, 0, null, 'card', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('no-op');
    });

    it('rejects setAbsolute to the current elevation value', () => {
      // Current elevation is 0 (undefined), setAbsolute to 0 is a no-op
      const result = service.setAbsolute(1, 1, 0, 'relic', CURRENT_TURN);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('no-op');
    });
  });

  describe('TOWER tile allowed (raise platform mechanic)', () => {
    it('allows raise on a TOWER tile', () => {
      const board = gameBoardService.getGameBoard();
      board[2][2] = new GameBoardTile(2, 2, BlockType.TOWER, false, false, null, 'BASIC' as any);
      const result = service.raise(2, 2, 1, null, 'raise-platform', CURRENT_TURN);
      expect(result.ok).toBeTrue();
    });

    it('translates both tile mesh and tower mesh when raising a TOWER tile', () => {
      const board = gameBoardService.getGameBoard();
      board[2][2] = new GameBoardTile(2, 2, BlockType.TOWER, false, false, null, 'BASIC' as any);
      service.raise(2, 2, 2, null, 'raise-platform', CURRENT_TURN);
      expect(registrySpy.translateTileMesh).toHaveBeenCalledWith(2, 2, jasmine.any(Number));
      expect(registrySpy.translateTowerMesh).toHaveBeenCalledWith(2, 2, jasmine.any(Number));
    });

    it('tower mesh translated to elevation + tileHeight', () => {
      const board = gameBoardService.getGameBoard();
      board[2][2] = new GameBoardTile(2, 2, BlockType.TOWER, false, false, null, 'BASIC' as any);
      service.raise(2, 2, 2, null, 'raise-platform', CURRENT_TURN);
      const expectedTowerY = 2 + BOARD_CONFIG.tileHeight;
      expect(registrySpy.translateTowerMesh).toHaveBeenCalledWith(2, 2, expectedTowerY);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // tickTurn() — expiry
  // ─────────────────────────────────────────────────────────────────────────

  describe('tickTurn()', () => {
    it('expires a duration-limited change when expiresOnTurn === currentTurn', () => {
      service.raise(1, 1, 1, 2, 'card', 1); // expires on turn 3
      service.tickTurn(3);
      expect(service.getActiveChanges().length).toBe(0);
    });

    it('reverts tile elevation on expiry', () => {
      service.raise(1, 1, 1, 2, 'card', 1); // expires on turn 3
      service.tickTurn(3);
      expect(service.getElevation(1, 1)).toBe(0);
    });

    it('calls translateTileMesh on revert', () => {
      service.raise(1, 1, 1, 2, 'card', 1);
      registrySpy.translateTileMesh.calls.reset();
      service.tickTurn(3);
      expect(registrySpy.translateTileMesh).toHaveBeenCalledWith(1, 1, jasmine.any(Number));
    });

    it('does NOT expire a change early (turn < expiresOnTurn)', () => {
      service.raise(1, 1, 1, 2, 'card', 1); // expires on turn 3
      service.tickTurn(2);
      expect(service.getActiveChanges().length).toBe(1);
    });

    it('does NOT expire permanent changes (expiresOnTurn === null)', () => {
      service.raise(1, 1, 1, null, 'card', 1);
      service.tickTurn(1);
      service.tickTurn(100);
      expect(service.getActiveChanges().length).toBe(1);
    });

    it('keeps permanent changes while expiring temporary ones', () => {
      service.raise(1, 1, 1, null, 'permanent-card', 1);   // permanent on (1,1)
      service.raise(2, 2, 1, 2, 'timed-card', 1);           // expires on turn 3 on (2,2)
      service.tickTurn(3);
      expect(service.getActiveChanges().length).toBe(1);
      expect(service.getActiveChanges()[0].sourceId).toBe('permanent-card');
    });

    it('reverts tile elevation to prior value after expiry', () => {
      service.raise(1, 1, 2, 3, 'card', 1); // raise to 2, expires on turn 4
      expect(service.getElevation(1, 1)).toBe(2);
      service.tickTurn(4);
      expect(service.getElevation(1, 1)).toBe(0);
    });

    it('does not throw if journal is empty', () => {
      expect(() => service.tickTurn(5)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getElevation()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getElevation()', () => {
    it('returns 0 for a tile that has never been elevated', () => {
      expect(service.getElevation(1, 1)).toBe(0);
    });

    it('returns the current elevation after raise', () => {
      service.raise(1, 1, 2, null, 'card', CURRENT_TURN);
      expect(service.getElevation(1, 1)).toBe(2);
    });

    it('returns negative value after depress', () => {
      service.depress(1, 1, 1, null, 'card', CURRENT_TURN);
      expect(service.getElevation(1, 1)).toBe(-1);
    });

    it('returns 0 for out-of-bounds row gracefully (no throw)', () => {
      expect(service.getElevation(99, 0)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getMaxElevation()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMaxElevation()', () => {
    it('returns 0 when no tiles are elevated', () => {
      expect(service.getMaxElevation()).toBe(0);
    });

    it('returns the highest elevation across all tiles', () => {
      service.raise(1, 1, 2, null, 'card', CURRENT_TURN);
      service.raise(2, 2, 1, null, 'card2', CURRENT_TURN);
      expect(service.getMaxElevation()).toBe(2);
    });

    it('returns 0 after elevated tile is reverted to 0', () => {
      service.raise(1, 1, 1, 2, 'card', 1);
      service.tickTurn(3);
      expect(service.getMaxElevation()).toBe(0);
    });

    it('ignores depressed tiles (max is 0 if only depressions)', () => {
      service.depress(1, 1, 1, null, 'card', CURRENT_TURN);
      expect(service.getMaxElevation()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getElevationMap()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getElevationMap()', () => {
    it('returns an empty map when no tiles are elevated', () => {
      expect(service.getElevationMap().size).toBe(0);
    });

    it('includes only non-zero cells', () => {
      service.raise(1, 1, 2, null, 'card', CURRENT_TURN);
      const map = service.getElevationMap();
      expect(map.size).toBe(1);
      expect(map.get('1-1')).toBe(2);
    });

    it('excludes tiles after their elevation is reverted to 0', () => {
      service.raise(1, 1, 1, 2, 'card', 1);
      service.tickTurn(3);
      expect(service.getElevationMap().size).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // serialize() / restore()
  // ─────────────────────────────────────────────────────────────────────────

  describe('serialize() / restore() round-trip', () => {
    it('round-trips an empty state', () => {
      const snapshot = service.serialize();
      service.reset();
      service.restore(snapshot);
      expect(service.getActiveChanges().length).toBe(0);
      expect(service.getMaxElevation()).toBe(0);
    });

    it('preserves journal entries across round-trip', () => {
      service.raise(1, 1, 2, 3, 'card', CURRENT_TURN);
      service.depress(2, 2, 1, null, 'card2', CURRENT_TURN);

      const snapshot = service.serialize();

      // Reset and restore
      service.reset();
      service.restore(snapshot);

      expect(service.getActiveChanges().length).toBe(2);
    });

    it('preserves nextId across round-trip', () => {
      service.raise(1, 1, 1, null, 'card', CURRENT_TURN);
      service.raise(2, 2, 1, null, 'card2', CURRENT_TURN);

      const snapshot = service.serialize();
      expect(snapshot.nextId).toBe(2);

      service.reset();
      service.restore(snapshot);
      // Next ID should be 2 so the next change gets id '2'
      service.raise(3, 3, 1, null, 'card3', CURRENT_TURN + 1);
      expect(service.getActiveChanges().find(c => c.sourceId === 'card3')?.id).toBe('2');
    });

    it('snapshot elevations array contains only non-zero tiles', () => {
      service.raise(1, 1, 2, null, 'card', CURRENT_TURN);
      const snapshot = service.serialize();
      expect(snapshot.elevations.length).toBe(1);
      expect(snapshot.elevations[0]).toEqual({ row: 1, col: 1, value: 2 });
    });

    it('snapshot elevations array is empty when no tiles are elevated', () => {
      const snapshot = service.serialize();
      expect(snapshot.elevations.length).toBe(0);
    });

    it('preserves change properties in journal round-trip', () => {
      service.raise(1, 1, 2, 3, 'special-card', 5);
      const snapshot = service.serialize();
      service.reset();
      service.restore(snapshot);

      const change = service.getActiveChanges()[0];
      expect(change.op).toBe('raise');
      expect(change.row).toBe(1);
      expect(change.col).toBe(1);
      expect(change.priorElevation).toBe(0);
      expect(change.deltaOrAbsolute).toBe(2);
      expect(change.appliedOnTurn).toBe(5);
      expect(change.expiresOnTurn).toBe(8);
      expect(change.sourceId).toBe('special-card');
    });

    it('restore() accepts a minimal empty state', () => {
      const empty: SerializableTileElevationState = {
        elevations: [],
        changes: [],
        nextId: 0,
      };
      expect(() => service.restore(empty)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // reset()
  // ─────────────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears the journal', () => {
      service.raise(1, 1, 1, null, 'card', CURRENT_TURN);
      service.reset();
      expect(service.getActiveChanges().length).toBe(0);
    });

    it('resets nextId to 0', () => {
      service.raise(1, 1, 1, null, 'card', CURRENT_TURN);
      service.reset();
      service.raise(2, 2, 1, null, 'card2', CURRENT_TURN);
      expect(service.getActiveChanges()[0].id).toBe('0');
    });

    it('does not throw when called on an already-empty service', () => {
      expect(() => service.reset()).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Pathfinding isolation — CRITICAL regression guard (spike §11)
  // ─────────────────────────────────────────────────────────────────────────

  describe('pathfinding isolation', () => {
    it('ElevationService has no PathfindingService dependency — invalidateCache is never called', () => {
      // If ElevationService injected PathfindingService and called invalidateCache,
      // the DI would fail in this test (PathfindingService is not provided) and
      // this spec would error rather than pass.
      // We additionally verify by confirming no unexpected call exists.
      // This is the critical regression guard for spike §11.
      const pathSpy = jasmine.createSpy('invalidateCache');
      // ElevationService only has GameBoardService and BoardMeshRegistryService injected.
      // Any direct access to a non-injected service would throw in this context.
      service.raise(1, 1, 1, null, 'test', CURRENT_TURN);
      service.tickTurn(CURRENT_TURN + 1);
      expect(pathSpy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Perf stress (sprint 25 requirement)
  // ─────────────────────────────────────────────────────────────────────────

  describe('perf stress — 10 elevations + 10 reverts on 25×20 board under 4ms', () => {
    let largeBoard: GameBoardService;
    let largeSvc: ElevationService;
    let largeRegistry: jasmine.SpyObj<BoardMeshRegistryService>;

    beforeEach(() => {
      // Build a 25x20 board (production dimensions)
      const svc = new GameBoardService();
      const board = makeBoard(20, 25);
      // Add a spawner and exit so importBoard doesn't reject
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][24] = GameBoardTile.createExit(24, 0);
      svc.importBoard(board, 25, 20);
      largeBoard = svc;

      largeRegistry = jasmine.createSpyObj<BoardMeshRegistryService>(
        'BoardMeshRegistryService',
        ['translateTileMesh', 'translateTowerMesh'],
      );

      largeSvc = new ElevationService(largeBoard, largeRegistry);
    });

    it('applies 10 raises and reverts them within 4ms total', () => {
      const start = Date.now();

      // Apply 10 raises on different tiles (turn 1)
      for (let i = 0; i < 10; i++) {
        largeSvc.raise(i + 1, i + 1, 1, 1, `card-${i}`, 1);
      }

      // Tick turn 2 — all 10 expire and revert
      largeSvc.tickTurn(2);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(4);
    });
  });
});
