import { gridToWorld, worldToGrid, dist2d, isInBounds, shuffleInPlace } from './coordinate-utils';

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

  describe('isInBounds', () => {
    it('returns true for the origin (0,0) on any positive grid', () => {
      expect(isInBounds(0, 0, 10, 10)).toBeTrue();
    });

    it('returns false when row equals height (upper-edge exclusion)', () => {
      expect(isInBounds(10, 0, 10, 10)).toBeFalse();
    });

    it('returns false when col equals width (upper-edge exclusion)', () => {
      expect(isInBounds(0, 10, 10, 10)).toBeFalse();
    });

    it('returns false for negative row', () => {
      expect(isInBounds(-1, 5, 10, 10)).toBeFalse();
    });

    it('returns false for negative col', () => {
      expect(isInBounds(5, -1, 10, 10)).toBeFalse();
    });

    it('row/col swap matters: (height-1, width) is false, (width-1, height) may differ', () => {
      // 5×10 grid: row=4 col=5 is in bounds; row=5 col=4 is not
      expect(isInBounds(4, 5, 5, 10)).toBeTrue();
      expect(isInBounds(5, 4, 5, 10)).toBeFalse();
    });
  });

  describe('shuffleInPlace', () => {
    it('is a noop for an empty array', () => {
      const arr: number[] = [];
      shuffleInPlace(arr, Math.random);
      expect(arr).toEqual([]);
    });

    it('is a noop for a single-element array', () => {
      const arr = [42];
      shuffleInPlace(arr, Math.random);
      expect(arr).toEqual([42]);
    });

    it('preserves all elements regardless of RNG output', () => {
      const original = [1, 2, 3, 4, 5];
      const arr = [...original];
      shuffleInPlace(arr, Math.random);
      expect(arr.slice().sort((a, b) => a - b)).toEqual(original);
    });

    it('produces the same order for the same seeded RNG', () => {
      const makeSeeded = (): (() => number) => {
        let s = 0x12345678;
        return () => {
          s ^= s << 13; s ^= s >> 17; s ^= s << 5;
          return (s >>> 0) / 0xffffffff;
        };
      };
      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
      const arr2 = [...arr1];
      shuffleInPlace(arr1, makeSeeded());
      shuffleInPlace(arr2, makeSeeded());
      expect(arr1).toEqual(arr2);
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
