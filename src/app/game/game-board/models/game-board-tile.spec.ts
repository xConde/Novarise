import { GameBoardTile, BlockType } from './game-board-tile';
import { TowerType } from './tower.model';

describe('GameBoardTile', () => {

  // --- Constructor ---

  describe('constructor', () => {
    it('should assign all properties from constructor arguments', () => {
      const tile = new GameBoardTile(3, 7, BlockType.BASE, true, true, 0, null);

      expect(tile.x).toBe(3);
      expect(tile.y).toBe(7);
      expect(tile.type).toBe(BlockType.BASE);
      expect(tile.isTraversable).toBe(true);
      expect(tile.isPurchasable).toBe(true);
      expect(tile.cost).toBe(0);
      expect(tile.towerType).toBeNull();
    });

    it('should accept a TowerType for towerType parameter', () => {
      const tile = new GameBoardTile(1, 2, BlockType.TOWER, false, false, 50, TowerType.SNIPER);

      expect(tile.towerType).toBe(TowerType.SNIPER);
      expect(tile.cost).toBe(50);
    });

    it('should accept null for cost and towerType', () => {
      const tile = new GameBoardTile(0, 0, BlockType.WALL, false, false, null, null);

      expect(tile.cost).toBeNull();
      expect(tile.towerType).toBeNull();
    });

    it('should accept negative coordinates', () => {
      const tile = new GameBoardTile(-1, -5, BlockType.BASE, true, true, 0, null);

      expect(tile.x).toBe(-1);
      expect(tile.y).toBe(-5);
    });

    it('should accept zero coordinates', () => {
      const tile = new GameBoardTile(0, 0, BlockType.BASE, true, true, 0, null);

      expect(tile.x).toBe(0);
      expect(tile.y).toBe(0);
    });

    it('should store all six tower types correctly', () => {
      const towerTypes = [
        TowerType.BASIC,
        TowerType.SNIPER,
        TowerType.SPLASH,
        TowerType.SLOW,
        TowerType.CHAIN,
        TowerType.MORTAR,
      ];

      towerTypes.forEach(tt => {
        const tile = new GameBoardTile(0, 0, BlockType.TOWER, false, false, 100, tt);
        expect(tile.towerType).toBe(tt);
      });
    });
  });

  // --- Static Factory: createBase ---

  describe('createBase()', () => {
    it('should create a tile with BlockType.BASE', () => {
      const tile = GameBoardTile.createBase(2, 4);
      expect(tile.type).toBe(BlockType.BASE);
    });

    it('should set the correct coordinates', () => {
      const tile = GameBoardTile.createBase(5, 9);
      expect(tile.x).toBe(5);
      expect(tile.y).toBe(9);
    });

    it('should be traversable', () => {
      const tile = GameBoardTile.createBase(0, 0);
      expect(tile.isTraversable).toBe(true);
    });

    it('should be purchasable', () => {
      const tile = GameBoardTile.createBase(0, 0);
      expect(tile.isPurchasable).toBe(true);
    });

    it('should have a cost of 0', () => {
      const tile = GameBoardTile.createBase(0, 0);
      expect(tile.cost).toBe(0);
    });

    it('should have no tower type', () => {
      const tile = GameBoardTile.createBase(0, 0);
      expect(tile.towerType).toBeNull();
    });

    it('should return a GameBoardTile instance', () => {
      const tile = GameBoardTile.createBase(1, 1);
      expect(tile instanceof GameBoardTile).toBe(true);
    });
  });

  // --- Static Factory: createSpawner ---

  describe('createSpawner()', () => {
    it('should create a tile with BlockType.SPAWNER', () => {
      const tile = GameBoardTile.createSpawner(0, 0);
      expect(tile.type).toBe(BlockType.SPAWNER);
    });

    it('should set the correct coordinates', () => {
      const tile = GameBoardTile.createSpawner(3, 6);
      expect(tile.x).toBe(3);
      expect(tile.y).toBe(6);
    });

    it('should not be traversable', () => {
      const tile = GameBoardTile.createSpawner(0, 0);
      expect(tile.isTraversable).toBe(false);
    });

    it('should not be purchasable', () => {
      const tile = GameBoardTile.createSpawner(0, 0);
      expect(tile.isPurchasable).toBe(false);
    });

    it('should have null cost', () => {
      const tile = GameBoardTile.createSpawner(0, 0);
      expect(tile.cost).toBeNull();
    });

    it('should have no tower type', () => {
      const tile = GameBoardTile.createSpawner(0, 0);
      expect(tile.towerType).toBeNull();
    });
  });

  // --- Static Factory: createExit ---

  describe('createExit()', () => {
    it('should create a tile with BlockType.EXIT', () => {
      const tile = GameBoardTile.createExit(0, 0);
      expect(tile.type).toBe(BlockType.EXIT);
    });

    it('should set the correct coordinates', () => {
      const tile = GameBoardTile.createExit(7, 2);
      expect(tile.x).toBe(7);
      expect(tile.y).toBe(2);
    });

    it('should not be traversable', () => {
      const tile = GameBoardTile.createExit(0, 0);
      expect(tile.isTraversable).toBe(false);
    });

    it('should not be purchasable', () => {
      const tile = GameBoardTile.createExit(0, 0);
      expect(tile.isPurchasable).toBe(false);
    });

    it('should have null cost', () => {
      const tile = GameBoardTile.createExit(0, 0);
      expect(tile.cost).toBeNull();
    });

    it('should have no tower type', () => {
      const tile = GameBoardTile.createExit(0, 0);
      expect(tile.towerType).toBeNull();
    });
  });

  // --- Static Factory: createWall ---

  describe('createWall()', () => {
    it('should create a tile with BlockType.WALL', () => {
      const tile = GameBoardTile.createWall(0, 0);
      expect(tile.type).toBe(BlockType.WALL);
    });

    it('should set the correct coordinates', () => {
      const tile = GameBoardTile.createWall(10, 14);
      expect(tile.x).toBe(10);
      expect(tile.y).toBe(14);
    });

    it('should not be traversable', () => {
      const tile = GameBoardTile.createWall(0, 0);
      expect(tile.isTraversable).toBe(false);
    });

    it('should not be purchasable', () => {
      const tile = GameBoardTile.createWall(0, 0);
      expect(tile.isPurchasable).toBe(false);
    });

    it('should have null cost', () => {
      const tile = GameBoardTile.createWall(0, 0);
      expect(tile.cost).toBeNull();
    });

    it('should have no tower type', () => {
      const tile = GameBoardTile.createWall(0, 0);
      expect(tile.towerType).toBeNull();
    });
  });

  // --- Shared Behavior: Non-base factories ---

  describe('non-base factory consistency', () => {
    it('spawner, exit, and wall should all be non-traversable and non-purchasable', () => {
      const factories = [
        GameBoardTile.createSpawner,
        GameBoardTile.createExit,
        GameBoardTile.createWall,
      ];

      factories.forEach(factory => {
        const tile = factory(1, 1);
        expect(tile.isTraversable).toBe(false);
        expect(tile.isPurchasable).toBe(false);
        expect(tile.cost).toBeNull();
        expect(tile.towerType).toBeNull();
      });
    });

    it('only createBase should produce a traversable, purchasable tile', () => {
      const base = GameBoardTile.createBase(0, 0);
      const spawner = GameBoardTile.createSpawner(0, 0);
      const exit = GameBoardTile.createExit(0, 0);
      const wall = GameBoardTile.createWall(0, 0);

      expect(base.isTraversable).toBe(true);
      expect(base.isPurchasable).toBe(true);

      [spawner, exit, wall].forEach(tile => {
        expect(tile.isTraversable).toBe(false);
        expect(tile.isPurchasable).toBe(false);
      });
    });
  });

  // --- BlockType enum values ---

  describe('BlockType', () => {
    it('should have distinct numeric values for all block types', () => {
      const values = new Set([
        BlockType.BASE,
        BlockType.EXIT,
        BlockType.SPAWNER,
        BlockType.TOWER,
        BlockType.WALL,
      ]);
      expect(values.size).toBe(5);
    });
  });

  // --- Factory-produced tiles have distinct types ---

  describe('factory type distinction', () => {
    it('each factory should produce a tile with a unique BlockType', () => {
      const base = GameBoardTile.createBase(0, 0);
      const spawner = GameBoardTile.createSpawner(0, 0);
      const exit = GameBoardTile.createExit(0, 0);
      const wall = GameBoardTile.createWall(0, 0);

      const types = new Set([base.type, spawner.type, exit.type, wall.type]);
      expect(types.size).toBe(4);
    });

    it('no factory produces BlockType.TOWER (towers are placed, not factory-created)', () => {
      const base = GameBoardTile.createBase(0, 0);
      const spawner = GameBoardTile.createSpawner(0, 0);
      const exit = GameBoardTile.createExit(0, 0);
      const wall = GameBoardTile.createWall(0, 0);

      [base, spawner, exit, wall].forEach(tile => {
        expect(tile.type).not.toBe(BlockType.TOWER);
      });
    });
  });

  // --- Readonly properties ---

  describe('property immutability', () => {
    it('all properties should be readonly (TypeScript enforced)', () => {
      const tile = GameBoardTile.createBase(1, 2);

      // These properties are readonly at the type level.
      // At runtime, verify they hold their initial values after construction.
      expect(tile.x).toBe(1);
      expect(tile.y).toBe(2);
      expect(tile.type).toBe(BlockType.BASE);
      expect(tile.isTraversable).toBe(true);
      expect(tile.isPurchasable).toBe(true);
      expect(tile.cost).toBe(0);
      expect(tile.towerType).toBeNull();
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('should handle large coordinate values', () => {
      const tile = GameBoardTile.createBase(9999, 9999);
      expect(tile.x).toBe(9999);
      expect(tile.y).toBe(9999);
    });

    it('should handle fractional coordinates', () => {
      const tile = new GameBoardTile(1.5, 2.7, BlockType.BASE, true, true, 0, null);
      expect(tile.x).toBe(1.5);
      expect(tile.y).toBe(2.7);
    });

    it('should handle zero cost distinctly from null cost', () => {
      const base = GameBoardTile.createBase(0, 0);
      const spawner = GameBoardTile.createSpawner(0, 0);

      expect(base.cost).toBe(0);
      expect(spawner.cost).toBeNull();
      expect(base.cost).not.toBe(spawner.cost);
    });

    it('two tiles at the same position are independent instances', () => {
      const a = GameBoardTile.createBase(3, 4);
      const b = GameBoardTile.createBase(3, 4);

      expect(a).not.toBe(b);
      expect(a.x).toBe(b.x);
      expect(a.y).toBe(b.y);
      expect(a.type).toBe(b.type);
    });
  });
});
