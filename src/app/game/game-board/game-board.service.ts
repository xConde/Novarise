import { Injectable } from '@angular/core';
import { BlockType, GameBoardTile, Spawner, SpawnerType } from './models/game-board-tile';

@Injectable()
export class GameBoardService {
  private readonly gameBoardWidth = 25;
  private readonly gameBoardHeight = 20;
  private readonly gameBoard: GameBoardTile[][] = [];

  private readonly exitRows = [9, 9, 10, 10];
  private readonly exitCols = [11, 12, 11, 12];

  private readonly spawnerSize = 2;
  private readonly spawnerPlacements: Spawner[] = [];

  constructor() {
    this.generateBaseBoard();
  }

  generateBaseBoard(): void {
    for (let i = 0; i < this.gameBoardHeight; i++) {
      this.gameBoard.push([]);
      for (let j = 0; j < this.gameBoardWidth; j++) {
        this.gameBoard[i].push(GameBoardTile.createBase(i, j));
      }
    }

    for (let i = 0; i < this.exitRows.length; i++) {
      const exitX = this.exitRows[i];
      const exitY = this.exitCols[i];
      this.gameBoard[exitX][exitY] = GameBoardTile.createExit(exitX, exitY);
      this.gameBoard[exitX][exitY+1] = GameBoardTile.createExit(exitX, exitY+1);
      this.gameBoard[exitX+1][exitY] = GameBoardTile.createExit(exitX+1, exitY);
      this.gameBoard[exitX+1][exitY+1] = GameBoardTile.createExit(exitX+1, exitY+1);
    }

    const rand = Math.floor(Math.random() * 4);
    switch (rand) {
      case 0:
        this.generateSpawner(SpawnerType.TOP_LEFT);
        break;
      case 1:
        this.generateSpawner(SpawnerType.TOP_RIGHT);
        break;
      case 2:
        this.generateSpawner(SpawnerType.BOTTOM_LEFT);
        break;
      case 3:
        this.generateSpawner(SpawnerType.BOTTOM_RIGHT);
        break;
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

  generateSpawner(type: SpawnerType): void {
    const range = this.getSpawnerRange(type);
    for (let i = range.minRow; i <= range.maxRow; i++) {
      for (let j = range.minCol; j <= range.maxCol; j++) {
        if (i === range.minRow || i === range.maxRow || j === range.minCol || j === range.maxCol) {
          this.gameBoard[i][j] = GameBoardTile.createSpawner(i, j);
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
}
