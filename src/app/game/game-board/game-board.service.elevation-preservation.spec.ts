import { TestBed } from '@angular/core/testing';
import { GameBoardService } from './game-board.service';
import { BlockType } from './models/game-board-tile';
import { TowerType } from './models/tower.model';

/**
 * Regression specs for Phase 3 red-team Finding 1 (extended):
 * tile-mutation paths (placeTower, forceSetTower, setTileType) must preserve
 * the `elevation` field on existing tiles. Prior to this fix, placeTower() and
 * forceSetTower() reconstructed GameBoardTile via the constructor without
 * forwarding `oldTile.elevation`, silently zeroing elevation on elevated tiles.
 */
describe('GameBoardService tower placement preserves tile fields', () => {
  let service: GameBoardService;

  /** Row and column of a board-interior tile guaranteed to be BASE after resetBoard(). */
  const TEST_ROW = 5;
  const TEST_COL = 5;
  const TEST_ELEVATION = 2;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameBoardService],
    });
    service = TestBed.inject(GameBoardService);
    service.resetBoard();
    // Elevate the target tile before placing a tower on it.
    service.setTileElevation(TEST_ROW, TEST_COL, TEST_ELEVATION);
  });

  it('placeTower() preserves elevation on an elevated tile', () => {
    const placed = service.placeTower(TEST_ROW, TEST_COL, TowerType.BASIC);
    expect(placed).toBeTrue();
    const tile = service.getGameBoard()[TEST_ROW][TEST_COL];
    expect(tile.type).toBe(BlockType.TOWER);
    expect(tile.elevation).toBe(TEST_ELEVATION);
  });

  it('forceSetTower() preserves elevation on an elevated tile', () => {
    service.forceSetTower(TEST_ROW, TEST_COL, TowerType.BASIC);
    const tile = service.getGameBoard()[TEST_ROW][TEST_COL];
    expect(tile.type).toBe(BlockType.TOWER);
    expect(tile.elevation).toBe(TEST_ELEVATION);
  });

  it('setTileType() preserves elevation (regression coverage for the original fix)', () => {
    // setTileType was the first site fixed in Phase 3. Verify it still holds.
    const mutated = service.setTileType(TEST_ROW, TEST_COL, BlockType.WALL, 'block');
    expect(mutated).not.toBeNull();
    expect(mutated!.type).toBe(BlockType.WALL);
    expect(mutated!.elevation).toBe(TEST_ELEVATION);
  });

  it('placeTower() on a non-elevated tile leaves elevation undefined', () => {
    // Baseline: tiles without elevation should not gain a spurious elevation value.
    const otherRow = 3;
    const otherCol = 3;
    const placed = service.placeTower(otherRow, otherCol, TowerType.BASIC);
    expect(placed).toBeTrue();
    const tile = service.getGameBoard()[otherRow][otherCol];
    expect(tile.type).toBe(BlockType.TOWER);
    expect(tile.elevation).toBeUndefined();
  });

  it('forceSetTower() on a non-elevated tile leaves elevation undefined', () => {
    const otherRow = 3;
    const otherCol = 3;
    service.forceSetTower(otherRow, otherCol, TowerType.BASIC);
    const tile = service.getGameBoard()[otherRow][otherCol];
    expect(tile.type).toBe(BlockType.TOWER);
    expect(tile.elevation).toBeUndefined();
  });
});
