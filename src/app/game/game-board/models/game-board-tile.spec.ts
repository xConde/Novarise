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
});
