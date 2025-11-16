import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockType, GameBoardTile, Spawner, SpawnerType } from './models/game-board-tile';

@Injectable()
export class GameBoardService {
  // Board configuration constants
  private readonly gameBoardWidth = 25;
  private readonly gameBoardHeight = 20;
  private readonly spawnerSize = 2;

  // Exit tile coordinates (center of board)
  private readonly exitTileCoordinates: number[][] = [
    [9, 11], [9, 12], [10, 11], [10, 12]
  ];

  // Tile shape dimensions
  private readonly baseTileSize = 0.5;
  private readonly spawnerTileSize = 1;
  private readonly exitTileSize = 1.5;

  // State
  private gameBoard: GameBoardTile[][] = [];
  private spawnerChoices: SpawnerType[] = [
    SpawnerType.TOP_LEFT,
    SpawnerType.TOP_RIGHT,
    SpawnerType.BOTTOM_LEFT,
    SpawnerType.BOTTOM_RIGHT
  ];
  private spawnerTiles: number[][] = [];
  private exitTiles: number[][] = [];
  private readonly spawnerPlacements: Spawner[] = [];

  constructor() {
    this.generateBaseBoard();
    this.generateExitTiles();
    this.generateSpawner();
  }

  generateBaseBoard(): void {
    for (let i = 0; i < this.gameBoardHeight; i++) {
      this.gameBoard.push([]);
      for (let j = 0; j < this.gameBoardWidth; j++) {
        this.gameBoard[i].push(GameBoardTile.createBase(i, j));
      }
    }
  }

  generateExitTiles(): void {
    this.exitTiles = this.exitTileCoordinates;

    for (const [exitX, exitY] of this.exitTiles) {
      this.gameBoard[exitX][exitY] = GameBoardTile.createExit(exitX, exitY);
    }
  }

  generateSpawner(): void {
    if (this.spawnerChoices.length === 0) { return; }
    const randIndex = Math.floor(Math.random() * this.spawnerChoices.length);
    this.generateSpawnerTiles(this.spawnerChoices[randIndex]);
    this.spawnerChoices.splice(randIndex, 1);
  }

  generateSpawnerTiles(type: SpawnerType): void {
    const range = this.getSpawnerRange(type);
    for (let i = range.minRow; i <= range.maxRow; i++) {
      for (let j = range.minCol; j <= range.maxCol; j++) {
        if (i === range.minRow || i === range.maxRow || j === range.minCol || j === range.maxCol) {
          this.gameBoard[i][j] = GameBoardTile.createSpawner(i, j);
          this.spawnerTiles.push([i, j]);
        } else {
          this.gameBoard[i][j] = GameBoardTile.createBase(i, j);
        }
      }
    }
    this.spawnerPlacements.push({ x: range.centerX, y: range.centerY, type });
  }

  private getSpawnerRange(type: SpawnerType) {
    switch (type) {
      case SpawnerType.TOP_LEFT:
        return { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1, centerX: 0, centerY: 0 };
      case SpawnerType.TOP_RIGHT:
        return { minRow: 0, maxRow: 1, minCol: 23, maxCol: 24, centerX: 0, centerY: 24 };
      case SpawnerType.BOTTOM_LEFT:
        return { minRow: 18, maxRow: 19, minCol: 0, maxCol: 1, centerX: 18, centerY: 0 };
      case SpawnerType.BOTTOM_RIGHT:
        return { minRow: 18, maxRow: 19, minCol: 23, maxCol: 24, centerX: 18, centerY: 24 };
    }
  }

  canPlaceBlock(x: number, y: number, tiles: number): boolean {
    const checkWithinRange = (targetX: number, targetY: number): boolean => {
      for (let i = x - tiles; i <= x + tiles; i++) {
        for (let j = y - tiles; j <= y + tiles; j++) {
          if (tileInRange(i, j) && this.gameBoard[i][j].type !== BlockType.BASE) {
            return false;
          }
        }
      }
      return true;
    };

    const tileInRange = (i: number, j: number): boolean => {
      return (i >= 0 && i < this.gameBoardHeight && j >= 0 && j < this.gameBoardWidth);
    };

    // Check if block within range of spawner
    if (this.spawnerPlacements.some(spawner => {
      return checkWithinRange(spawner.x, spawner.y);
    })) {
      return false;
    }

    // Check if block within range of exit
    const exitTile = this.getExitTile();
    if (!checkWithinRange(exitTile.x, exitTile.y)) {
      return false;
    }

    return true;
  }

  getExitTile(): GameBoardTile {
    for (let i = 0; i < this.gameBoardHeight; i++) {
      for (let j = 0; j < this.gameBoardWidth; j++) {
        if (this.gameBoard[i][j].type === BlockType.EXIT) {
          return this.gameBoard[i][j];
        }
      }
    }
    throw new Error('No exit tile found');
  }

  generateMesh(blockType: BlockType, shape: THREE.Shape, x: number, y: number): THREE.Mesh {
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color: this.getMeshColor(blockType) });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(y, 0, x);
    return mesh;
  }

  getMeshColor(blockType: BlockType): number {
    switch (blockType) {
      case BlockType.BASE:
        return 0xCCCCCC;
      case BlockType.SPAWNER:
        return 0x00FFFF;
      case BlockType.EXIT:
        return 0xFF00FF;
      default:
        throw new Error('Invalid block type');
    }
  }

  getMeshShape(blockType: BlockType): THREE.Shape {
    switch (blockType) {
      case BlockType.BASE:
        return new THREE.Shape([
          new THREE.Vector2(-this.baseTileSize, -this.baseTileSize),
          new THREE.Vector2(this.baseTileSize, -this.baseTileSize),
          new THREE.Vector2(this.baseTileSize, this.baseTileSize),
          new THREE.Vector2(-this.baseTileSize, this.baseTileSize)
        ]);
      case BlockType.SPAWNER:
        return new THREE.Shape([
          new THREE.Vector2(-this.spawnerTileSize, -this.spawnerTileSize),
          new THREE.Vector2(this.spawnerTileSize, -this.spawnerTileSize),
          new THREE.Vector2(this.spawnerTileSize, this.spawnerTileSize),
          new THREE.Vector2(-this.spawnerTileSize, this.spawnerTileSize)
        ]);
      case BlockType.EXIT:
        return new THREE.Shape([
          new THREE.Vector2(-this.exitTileSize, -this.exitTileSize),
          new THREE.Vector2(this.exitTileSize, -this.exitTileSize),
          new THREE.Vector2(this.exitTileSize, this.exitTileSize),
          new THREE.Vector2(-this.exitTileSize, this.exitTileSize)
        ]);
      default:
        throw new Error('Invalid block type');
    }
  }

  getSpawnerTiles(): number[][] {
    return this.spawnerTiles;
  }

  getExitTiles(): number[][] {
    return this.exitTiles;
  }

  getGameBoard(): GameBoardTile[][] {
    return this.gameBoard;
  }

}
