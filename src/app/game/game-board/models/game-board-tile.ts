import { TerrainType, TerrainHeight, DEFAULT_TERRAIN } from './terrain.model';

export class GameBoardTile {
  public readonly x: number;
  public readonly y: number;
  public readonly type: BlockType;
  public readonly isTraversable: boolean;
  public readonly isPurchasable: boolean;
  public readonly cost: number | null;
  public readonly towerType: TowerType | null;

  /** Terrain type for this tile (affects movement and visuals) */
  public terrainType: TerrainType;

  /** Height level of this tile (affects elevation and movement) */
  public terrainHeight: TerrainHeight;

  constructor(
    x: number,
    y: number,
    type: BlockType,
    isTraversable: boolean,
    isPurchasable: boolean,
    cost: number | null,
    towerType: TowerType | null,
    terrainType: TerrainType = DEFAULT_TERRAIN.type,
    terrainHeight: TerrainHeight = DEFAULT_TERRAIN.height
    ) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.isTraversable = isTraversable;
    this.isPurchasable = isPurchasable;
    this.cost = cost;
    this.towerType = towerType;
    this.terrainType = terrainType;
    this.terrainHeight = terrainHeight;
  }

  static createBase(x: number, y: number, terrainType?: TerrainType, terrainHeight?: TerrainHeight): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.BASE, true, true, 0, null, terrainType, terrainHeight);
  }

  static createSpawner(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.SPAWNER, false, false, null, null);
  }

  static createExit(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.EXIT, false, false, null, null);
  }

  /**
   * Update the terrain properties of this tile.
   * This allows modifying terrain after tile creation.
   */
  setTerrain(terrainType: TerrainType, terrainHeight?: TerrainHeight): void {
    this.terrainType = terrainType;
    if (terrainHeight !== undefined) {
      this.terrainHeight = terrainHeight;
    }
  }

  /**
   * Get the effective traversability of this tile considering both
   * block type and terrain type.
   */
  getEffectiveTraversability(): boolean {
    // If the block type is not traversable, terrain doesn't matter
    if (!this.isTraversable) {
      return false;
    }

    // Check if terrain is traversable (e.g., ABYSS is not)
    return this.terrainType !== TerrainType.ABYSS;
  }
}

export interface Spawner {
  x: number;
  y: number;
  type: SpawnerType;
}

export enum BlockType {
  BASE,
  EXIT,
  SPAWNER,
  TOWER,
}

export enum SpawnerType {
  TOP_LEFT,
  TOP_RIGHT,
  BOTTOM_LEFT,
  BOTTOM_RIGHT,
}

export enum TowerType {
  CANON,
  GATLING,
  SLOWING,
  SNIPER,
  LASER
}
