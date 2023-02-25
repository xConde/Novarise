export class GameBoardTile {
  public readonly x: number;
  public readonly y: number;
  public readonly type: BlockType;
  public readonly isTraversable: boolean;
  public readonly isPurchasable: boolean;
  public readonly cost: number | null;
  public readonly towerType: TowerType | null;

  constructor(
    x: number,
    y: number,
    type: BlockType,
    isTraversable: boolean,
    isPurchasable: boolean,
    cost: number | null,
    towerType: TowerType | null,
    ) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.isTraversable = isTraversable;
    this.isPurchasable = isPurchasable;
    this.cost = cost;
    this.towerType = towerType;
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

  static createCanon(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.TOWER, false, false, 20, TowerType.CANON);
  }

  static createGatling(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.TOWER, false, false, 35, TowerType.GATLING);
  }

  static createSlowing(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.TOWER, false, false, 40, TowerType.SLOWING);
  }

  static createSniper(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.TOWER, false, false, 60, TowerType.SNIPER);
  }

  static createLaser(x: number, y: number): GameBoardTile {
    return new GameBoardTile(x, y, BlockType.TOWER, false, false, 100, TowerType.LASER);
  }

}

export interface Spawner {
  x: number;
  y: number;
  type: SpawnerType;
}

export enum BlockType {
  BASE,
  BLOCK,
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
