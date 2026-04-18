import { BlockType, GameBoardTile } from './game-board-tile';
import { MutationOp } from '../services/path-mutation.types';

describe('GameBoardTile', () => {

  // ── Factory methods — backward compat (mutation fields must be undefined) ──

  describe('createBase', () => {
    let tile: GameBoardTile;
    beforeEach(() => { tile = GameBoardTile.createBase(3, 5); });

    it('has correct coordinates', () => {
      expect(tile.x).toBe(3);
      expect(tile.y).toBe(5);
    });
    it('is BASE type', () => { expect(tile.type).toBe(BlockType.BASE); });
    it('is traversable', () => { expect(tile.isTraversable).toBeTrue(); });
    it('is purchasable', () => { expect(tile.isPurchasable).toBeTrue(); });
    it('has 0 cost', () => { expect(tile.cost).toBe(0); });
    it('has no towerType', () => { expect(tile.towerType).toBeNull(); });
    it('mutationOp is undefined', () => { expect(tile.mutationOp).toBeUndefined(); });
    it('priorType is undefined', () => { expect(tile.priorType).toBeUndefined(); });
  });

  describe('createSpawner', () => {
    let tile: GameBoardTile;
    beforeEach(() => { tile = GameBoardTile.createSpawner(0, 0); });

    it('is SPAWNER type', () => { expect(tile.type).toBe(BlockType.SPAWNER); });
    it('is not traversable', () => { expect(tile.isTraversable).toBeFalse(); });
    it('mutationOp is undefined', () => { expect(tile.mutationOp).toBeUndefined(); });
    it('priorType is undefined', () => { expect(tile.priorType).toBeUndefined(); });
  });

  describe('createExit', () => {
    let tile: GameBoardTile;
    beforeEach(() => { tile = GameBoardTile.createExit(9, 11); });

    it('is EXIT type', () => { expect(tile.type).toBe(BlockType.EXIT); });
    it('is not traversable', () => { expect(tile.isTraversable).toBeFalse(); });
    it('mutationOp is undefined', () => { expect(tile.mutationOp).toBeUndefined(); });
    it('priorType is undefined', () => { expect(tile.priorType).toBeUndefined(); });
  });

  describe('createWall', () => {
    let tile: GameBoardTile;
    beforeEach(() => { tile = GameBoardTile.createWall(2, 4); });

    it('is WALL type', () => { expect(tile.type).toBe(BlockType.WALL); });
    it('is not traversable', () => { expect(tile.isTraversable).toBeFalse(); });
    it('is not purchasable', () => { expect(tile.isPurchasable).toBeFalse(); });
    it('mutationOp is undefined', () => { expect(tile.mutationOp).toBeUndefined(); });
    it('priorType is undefined', () => { expect(tile.priorType).toBeUndefined(); });
  });

  // ── createMutated ──

  describe('createMutated — build (WALL → BASE)', () => {
    let tile: GameBoardTile;
    beforeEach(() => {
      tile = GameBoardTile.createMutated(5, 3, BlockType.BASE, BlockType.WALL, 'build');
    });

    it('sets x and y', () => {
      expect(tile.x).toBe(5);
      expect(tile.y).toBe(3);
    });
    it('type is BASE', () => { expect(tile.type).toBe(BlockType.BASE); });
    it('is traversable', () => { expect(tile.isTraversable).toBeTrue(); });
    it('is purchasable', () => { expect(tile.isPurchasable).toBeTrue(); });
    it('cost is 0', () => { expect(tile.cost).toBe(0); });
    it('mutationOp is build', () => { expect(tile.mutationOp).toBe('build' as MutationOp); });
    it('priorType is WALL', () => { expect(tile.priorType).toBe(BlockType.WALL); });
  });

  describe('createMutated — block (BASE → WALL)', () => {
    let tile: GameBoardTile;
    beforeEach(() => {
      tile = GameBoardTile.createMutated(2, 7, BlockType.WALL, BlockType.BASE, 'block');
    });

    it('type is WALL', () => { expect(tile.type).toBe(BlockType.WALL); });
    it('is not traversable', () => { expect(tile.isTraversable).toBeFalse(); });
    it('is not purchasable', () => { expect(tile.isPurchasable).toBeFalse(); });
    it('mutationOp is block', () => { expect(tile.mutationOp).toBe('block' as MutationOp); });
    it('priorType is BASE', () => { expect(tile.priorType).toBe(BlockType.BASE); });
  });

  describe('createMutated — destroy (BASE → WALL)', () => {
    let tile: GameBoardTile;
    beforeEach(() => {
      tile = GameBoardTile.createMutated(1, 1, BlockType.WALL, BlockType.BASE, 'destroy');
    });

    it('type is WALL', () => { expect(tile.type).toBe(BlockType.WALL); });
    it('is not traversable', () => { expect(tile.isTraversable).toBeFalse(); });
    it('mutationOp is destroy', () => { expect(tile.mutationOp).toBe('destroy' as MutationOp); });
    it('priorType is BASE', () => { expect(tile.priorType).toBe(BlockType.BASE); });
  });

  describe('createMutated — bridgehead (WALL → WALL with bridgehead op)', () => {
    let tile: GameBoardTile;
    beforeEach(() => {
      // bridgehead uses WALL type (non-traversable) but carries mutationOp='bridgehead'
      // so tower-placement logic can query it via the mutationOp side-channel.
      tile = GameBoardTile.createMutated(4, 4, BlockType.WALL, BlockType.WALL, 'bridgehead');
    });

    it('type is WALL', () => { expect(tile.type).toBe(BlockType.WALL); });
    it('is non-traversable (not a path)', () => { expect(tile.isTraversable).toBeFalse(); });
    it('is not purchasable', () => { expect(tile.isPurchasable).toBeFalse(); });
    it('mutationOp is bridgehead — distinct marker for tower placement queries', () => {
      expect(tile.mutationOp).toBe('bridgehead' as MutationOp);
    });
    it('priorType is WALL', () => { expect(tile.priorType).toBe(BlockType.WALL); });
  });

  // ── elevation field (sprint 25 — Highground archetype) ──

  describe('elevation field', () => {
    it('is undefined on createBase tiles', () => {
      expect(GameBoardTile.createBase(0, 0).elevation).toBeUndefined();
    });

    it('is undefined on createWall tiles', () => {
      expect(GameBoardTile.createWall(0, 0).elevation).toBeUndefined();
    });

    it('is undefined on createSpawner tiles', () => {
      expect(GameBoardTile.createSpawner(0, 0).elevation).toBeUndefined();
    });

    it('is undefined on createExit tiles', () => {
      expect(GameBoardTile.createExit(0, 0).elevation).toBeUndefined();
    });
  });

  // ── withElevation() clone method ──

  describe('withElevation()', () => {
    let base: GameBoardTile;

    beforeEach(() => {
      base = GameBoardTile.createBase(3, 5);
    });

    it('returns a new tile instance (not the same reference)', () => {
      const elevated = base.withElevation(2);
      expect(elevated).not.toBe(base);
    });

    it('sets the elevation field to the provided value', () => {
      const elevated = base.withElevation(2);
      expect(elevated.elevation).toBe(2);
    });

    it('preserves x and y', () => {
      const elevated = base.withElevation(1);
      expect(elevated.x).toBe(base.x);
      expect(elevated.y).toBe(base.y);
    });

    it('preserves type', () => {
      const elevated = base.withElevation(1);
      expect(elevated.type).toBe(BlockType.BASE);
    });

    it('preserves isTraversable', () => {
      const elevated = base.withElevation(1);
      expect(elevated.isTraversable).toBe(base.isTraversable);
    });

    it('preserves isPurchasable', () => {
      const elevated = base.withElevation(1);
      expect(elevated.isPurchasable).toBe(base.isPurchasable);
    });

    it('preserves cost', () => {
      const elevated = base.withElevation(1);
      expect(elevated.cost).toBe(base.cost);
    });

    it('preserves towerType', () => {
      const elevated = base.withElevation(1);
      expect(elevated.towerType).toBe(base.towerType);
    });

    it('preserves mutationOp', () => {
      const mutated = GameBoardTile.createMutated(3, 5, BlockType.BASE, BlockType.WALL, 'build');
      const elevated = mutated.withElevation(1);
      expect(elevated.mutationOp).toBe('build' as MutationOp);
    });

    it('preserves priorType', () => {
      const mutated = GameBoardTile.createMutated(3, 5, BlockType.BASE, BlockType.WALL, 'build');
      const elevated = mutated.withElevation(1);
      expect(elevated.priorType).toBe(BlockType.WALL);
    });

    it('supports negative elevation (depression)', () => {
      const depressed = base.withElevation(-1);
      expect(depressed.elevation).toBe(-1);
    });

    it('can be called with elevation 0 (explicit zero)', () => {
      const el = base.withElevation(0);
      expect(el.elevation).toBe(0);
    });

    it('does NOT change isTraversable — elevation is orthogonal to traversability', () => {
      const elevated = base.withElevation(3);
      expect(elevated.isTraversable).toBeTrue();
    });
  });
});
