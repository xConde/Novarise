import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockType, GameBoardTile, Spawner, SpawnerType } from './models/game-board-tile';

@Injectable()
export class GameBoardService {
  // Board configuration constants
  private readonly gameBoardWidth = 25;
  private readonly gameBoardHeight = 20;
  private readonly spawnerSize = 2;
  private readonly tileSize = 1;
  private readonly tileHeight = 0.2;

  // Exit tile coordinates (center of board)
  private readonly exitTileCoordinates: number[][] = [
    [9, 11], [9, 12], [10, 11], [10, 12]
  ];

  // Colors for different tile types
  private readonly colorBase = 0x2a2a2a;
  private readonly colorSpawner = 0x00ffff;
  private readonly colorExit = 0xff00ff;
  private readonly colorGrid = 0x444444;

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

  // Create a visible tile mesh using BoxGeometry
  createTileMesh(row: number, col: number, type: BlockType): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.tileSize * 0.95, this.tileHeight, this.tileSize * 0.95);
    const color = this.getTileColor(type);
    const material = new THREE.MeshLambertMaterial({
      color: color,
      emissive: type === BlockType.BASE ? 0x000000 : color,
      emissiveIntensity: type === BlockType.BASE ? 0 : 0.3
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position tiles in a grid - centered at origin
    const x = (col - this.gameBoardWidth / 2) * this.tileSize;
    const z = (row - this.gameBoardHeight / 2) * this.tileSize;

    mesh.position.set(x, this.tileHeight / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    return mesh;
  }

  // Create grid lines for better visibility - aligned perfectly between tiles
  createGridLines(): THREE.Group {
    const gridGroup = new THREE.Group();

    // Create vertical lines (along Z axis) - between tiles
    for (let i = 0; i <= this.gameBoardWidth; i++) {
      const geometry = new THREE.BufferGeometry();
      // Offset by 0.5 to place lines BETWEEN tiles instead of through centers
      const x = (i - this.gameBoardWidth / 2 - 0.5) * this.tileSize;
      const z1 = (-this.gameBoardHeight / 2 - 0.5) * this.tileSize;
      const z2 = (this.gameBoardHeight / 2 + 0.5) * this.tileSize;

      const vertices = new Float32Array([
        x, 0.01, z1,
        x, 0.01, z2
      ]);

      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const material = new THREE.LineBasicMaterial({ color: this.colorGrid, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(geometry, material);
      gridGroup.add(line);
    }

    // Create horizontal lines (along X axis) - between tiles
    for (let i = 0; i <= this.gameBoardHeight; i++) {
      const geometry = new THREE.BufferGeometry();
      // Offset by 0.5 to place lines BETWEEN tiles instead of through centers
      const z = (i - this.gameBoardHeight / 2 - 0.5) * this.tileSize;
      const x1 = (-this.gameBoardWidth / 2 - 0.5) * this.tileSize;
      const x2 = (this.gameBoardWidth / 2 + 0.5) * this.tileSize;

      const vertices = new Float32Array([
        x1, 0.01, z,
        x2, 0.01, z
      ]);

      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const material = new THREE.LineBasicMaterial({ color: this.colorGrid, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(geometry, material);
      gridGroup.add(line);
    }

    return gridGroup;
  }

  private getTileColor(type: BlockType): number {
    switch (type) {
      case BlockType.BASE:
        return this.colorBase;
      case BlockType.SPAWNER:
        return this.colorSpawner;
      case BlockType.EXIT:
        return this.colorExit;
      default:
        return this.colorBase;
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

  getBoardWidth(): number {
    return this.gameBoardWidth;
  }

  getBoardHeight(): number {
    return this.gameBoardHeight;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  // Tower placement
  canPlaceTower(row: number, col: number): boolean {
    if (row < 0 || row >= this.gameBoardHeight || col < 0 || col >= this.gameBoardWidth) {
      return false;
    }

    const tile = this.gameBoard[row][col];

    // Can only place on BASE tiles that are purchasable
    return tile.type === BlockType.BASE && tile.isPurchasable && tile.towerType === null;
  }

  placeTower(row: number, col: number, towerType: string): boolean {
    if (!this.canPlaceTower(row, col)) {
      return false;
    }

    // For now, just mark the tile - we'll add actual tower objects later
    this.gameBoard[row][col] = {
      ...this.gameBoard[row][col],
      towerType: towerType as any // Simple string for now
    };

    return true;
  }

  // Create a simple tower mesh
  createTowerMesh(row: number, col: number): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
    const material = new THREE.MeshLambertMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Position tower on the tile
    const x = (col - this.gameBoardWidth / 2) * this.tileSize;
    const z = (row - this.gameBoardHeight / 2) * this.tileSize;

    mesh.position.set(x, 0.6, z); // Elevated above tile
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }
}
