import { gridToWorld, worldToGrid, dist2d } from './coordinate-utils';

describe('coordinate-utils', () => {
  const BOARD_WIDTH = 10;
  const BOARD_HEIGHT = 10;
  const TILE_SIZE = 1;

  describe('gridToWorld', () => {
    it('should convert center of board to world origin', () => {
      const result = gridToWorld(5, 5, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should convert top-left (0,0) to negative world coords', () => {
      const result = gridToWorld(0, 0, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      expect(result.x).toBe(-5);
      expect(result.z).toBe(-5);
    });

    it('should convert bottom-right to positive world coords', () => {
      const result = gridToWorld(9, 9, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      expect(result.x).toBe(4);
      expect(result.z).toBe(4);
    });

    it('should scale by tileSize', () => {
      const result = gridToWorld(0, 0, BOARD_WIDTH, BOARD_HEIGHT, 2);
      expect(result.x).toBe(-10);
      expect(result.z).toBe(-10);
    });

    it('should handle non-square boards', () => {
      const result = gridToWorld(0, 0, 12, 8, 1);
      expect(result.x).toBe(-6);
      expect(result.z).toBe(-4);
    });
  });

  describe('worldToGrid', () => {
    it('should convert world origin to board center', () => {
      const result = worldToGrid(0, 0, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      expect(result.row).toBe(5);
      expect(result.col).toBe(5);
    });

    it('should round to nearest tile', () => {
      const result = worldToGrid(-4.7, -4.7, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      expect(result.row).toBe(0);
      expect(result.col).toBe(0);
    });

    it('should be the inverse of gridToWorld', () => {
      const world = gridToWorld(3, 7, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      const grid = worldToGrid(world.x, world.z, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE);
      expect(grid.row).toBe(3);
      expect(grid.col).toBe(7);
    });

    it('should handle non-square boards', () => {
      const world = gridToWorld(2, 6, 12, 8, 1);
      const grid = worldToGrid(world.x, world.z, 12, 8, 1);
      expect(grid.row).toBe(2);
      expect(grid.col).toBe(6);
    });
  });

  describe('dist2d', () => {
    it('returns 0 for identical points', () => {
      expect(dist2d(3, 7, 3, 7)).toBe(0);
    });

    it('returns √2 for (0,0) → (1,1)', () => {
      expect(dist2d(0, 0, 1, 1)).toBeCloseTo(Math.sqrt(2), 10);
    });

    it('returns |dx| when dz is 0', () => {
      expect(dist2d(0, 5, 4, 5)).toBe(4);
    });

    it('is symmetric: dist2d(a,b,c,d) === dist2d(c,d,a,b)', () => {
      const forward = dist2d(1, 2, 5, 6);
      const backward = dist2d(5, 6, 1, 2);
      expect(forward).toBeCloseTo(backward, 10);
    });
  });
});
