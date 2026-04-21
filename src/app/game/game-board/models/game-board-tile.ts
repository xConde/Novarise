import { TowerType } from './tower.model';
import { MutationOp } from '../services/path-mutation.types';

export class GameBoardTile {
  public readonly x: number;
  public readonly y: number;
  public readonly type: BlockType;
  public readonly isTraversable: boolean;
  public readonly isPurchasable: boolean;
  public readonly cost: number | null;
  public readonly towerType: TowerType | null;
  /** Set on mutated tiles only — undefined on all factory-created tiles. */
  public readonly mutationOp?: MutationOp;
  /** The BlockType that existed before this mutation — undefined on unmutated tiles. */
  public readonly priorType?: BlockType;
  /**
   * Per-tile elevation set by ElevationService (Highground archetype, sprint 25).
   * `undefined` on tiles that have never been elevated — treated as 0 by all query code.
   * Never fractional; always an integer in [-MAX_DEPRESS, +MAX_ELEVATION].
   */
  public readonly elevation?: number;

  constructor(
    x: number,
    y: number,
    type: BlockType,
    isTraversable: boolean,
    isPurchasable: boolean,
    cost: number | null,
    towerType: TowerType | null,
    mutationOp?: MutationOp,
    priorType?: BlockType,
    elevation?: number,
    ) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.isTraversable = isTraversable;
    this.isPurchasable = isPurchasable;
    this.cost = cost;
    this.towerType = towerType;
    this.mutationOp = mutationOp;
    this.priorType = priorType;
    this.elevation = elevation;
  }

  /**
   * Return a clone of this tile with the given elevation, preserving every other field.
   * Used by ElevationService to mutate elevation without side effects.
   * No pathfinding impact — elevation does not change isTraversable.
   */
  withElevation(elevation: number): GameBoardTile {
    return new GameBoardTile(
      this.x,
      this.y,
      this.type,
      this.isTraversable,
      this.isPurchasable,
      this.cost,
      this.towerType,
      this.mutationOp,
      this.priorType,
      elevation,
    );
  }

  static createBase(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.BASE, true, true, 0, null);
  }

  static createSpawner(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.SPAWNER, false, false, null, null);
  }

  static createExit(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.EXIT, false, false, null, null);
  }

  static createWall(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.WALL, false, false, null, null);
  }

  /**
   * Create a mutated tile. Semantics are derived from the target `type`:
   *  - BASE       → traversable, purchasable, 0-cost
   *  - WALL       → non-traversable, non-purchasable
   *  - TOWER_ONLY (BRIDGEHEAD) — represented as a WALL tile that is non-traversable
   *                but carries mutationOp = 'bridgehead' so tower-placement logic can
   *                query it via the mutationOp side-channel. No new BlockType needed.
   *
   * @param x         Board column (not row) — matches the tile's own x field convention.
   * @param y         Board row — matches the tile's own y field convention.
   * @param type      The target BlockType after mutation.
   * @param priorType The BlockType that existed before this mutation (for revert).
   * @param mutationOp The operation that produced this tile.
   */
  static createMutated(
    x: number,
    y: number,
    type: BlockType,
    priorType: BlockType,
    mutationOp: MutationOp,
  ): GameBoardTile {
    switch (type) {
      case BlockType.BASE:
        // Build: traversable and purchasable path tile
        return new GameBoardTile(x, y, type, true, true, 0, null, mutationOp, priorType);
      case BlockType.WALL:
        // Block / destroy: non-traversable, non-purchasable
        return new GameBoardTile(x, y, type, false, false, null, null, mutationOp, priorType);
      default:
        // Fallback for any future type extension — non-traversable by default
        return new GameBoardTile(x, y, type, false, false, null, null, mutationOp, priorType);
    }
  }
}

export const enum BlockType {
  BASE,
  EXIT,
  SPAWNER,
  TOWER,
  WALL,
}

export const enum SpawnerType {
  TOP_LEFT,
  TOP_RIGHT,
  BOTTOM_LEFT,
  BOTTOM_RIGHT,
}

// Re-export TowerType from tower.model.ts for backwards compatibility
export { TowerType } from './tower.model';
