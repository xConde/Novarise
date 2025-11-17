import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockType, GameBoardTile, Spawner, SpawnerType } from './models/game-board-tile';

@Injectable()
export class GameBoardService {
  // Board configuration constants
  private readonly gameBoardWidth = 25;
  private readonly gameBoardHeight = 20;
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

  // Create a visible tile mesh using BoxGeometry
  createTileMesh(row: number, col: number, type: BlockType): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.tileSize * 0.95, this.tileHeight, this.tileSize * 0.95);
    const color = this.getTileColor(type);

    // Enhanced material with metallic and reflective properties
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: type === BlockType.BASE ? 0x1a1a2e : color,
      emissiveIntensity: type === BlockType.BASE ? 0.1 : 0.3,
      metalness: type === BlockType.BASE ? 0.6 : 0.3,
      roughness: type === BlockType.BASE ? 0.4 : 0.6,
      envMapIntensity: 1.0
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

  // Create grid lines - interior lines positioned BETWEEN tiles (24x19)
  createGridLines(): THREE.Group {
    const gridGroup = new THREE.Group();

    // Enhanced glowing grid line material
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.4,
      linewidth: 1
    });

    // Create vertical lines between columns - positioned at tile boundaries
    for (let i = 1; i < this.gameBoardWidth; i++) {
      const geometry = new THREE.BufferGeometry();
      // Shift by -0.5 to position lines BETWEEN tiles instead of at centers
      const x = (i - this.gameBoardWidth / 2 - 0.5) * this.tileSize;
      // Lines should only extend across actual tile range
      const z1 = (-this.gameBoardHeight / 2) * this.tileSize;
      const z2 = (this.gameBoardHeight / 2 - 1) * this.tileSize;

      const vertices = new Float32Array([
        x, 0.01, z1,
        x, 0.01, z2
      ]);

      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const line = new THREE.Line(geometry, gridMaterial.clone());
      gridGroup.add(line);
    }

    // Create horizontal lines between rows - positioned at tile boundaries
    for (let i = 1; i < this.gameBoardHeight; i++) {
      const geometry = new THREE.BufferGeometry();
      // Shift by -0.5 to position lines BETWEEN tiles instead of at centers
      const z = (i - this.gameBoardHeight / 2 - 0.5) * this.tileSize;
      // Lines should only extend across actual tile range
      const x1 = (-this.gameBoardWidth / 2) * this.tileSize;
      const x2 = (this.gameBoardWidth / 2 - 1) * this.tileSize;

      const vertices = new Float32Array([
        x1, 0.01, z,
        x2, 0.01, z
      ]);

      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const line = new THREE.Line(geometry, gridMaterial.clone());
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

    // Mark the tile as occupied with a tower
    this.gameBoard[row][col] = {
      ...this.gameBoard[row][col],
      towerType: null // Tower mesh is tracked separately in component
    };

    return true;
  }

  // Create tower mesh based on type
  createTowerMesh(row: number, col: number, towerType: string = 'basic'): THREE.Group {
    const towerGroup = new THREE.Group();
    let color: number;
    let height: number;

    // Different shapes and colors for different tower types
    switch (towerType) {
      case 'basic':
        // Multi-tiered cylinder tower
        const baseGeom = new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8);
        const midGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8);
        const topGeom = new THREE.CylinderGeometry(0.2, 0.3, 0.3, 8);

        color = 0xff6600; // Orange
        const material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          metalness: 0.7,
          roughness: 0.3
        });

        const base = new THREE.Mesh(baseGeom, material);
        base.position.y = 0.15;
        const mid = new THREE.Mesh(midGeom, material);
        mid.position.y = 0.5;
        const top = new THREE.Mesh(topGeom, material);
        top.position.y = 0.85;

        towerGroup.add(base, mid, top);
        height = 0.6;
        break;

      case 'sniper':
        // Tall spire with crystalline appearance
        const spireBase = new THREE.CylinderGeometry(0.3, 0.35, 0.3, 6);
        const spireMain = new THREE.ConeGeometry(0.25, 1.0, 6);
        const spireTip = new THREE.ConeGeometry(0.15, 0.4, 6);

        color = 0x9900ff; // Purple
        const snipeMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.4,
          metalness: 0.5,
          roughness: 0.2
        });

        const sBase = new THREE.Mesh(spireBase, snipeMat);
        sBase.position.y = 0.15;
        const sMain = new THREE.Mesh(spireMain, snipeMat);
        sMain.position.y = 0.65;
        const sTip = new THREE.Mesh(spireTip, snipeMat);
        sTip.position.y = 1.3;

        towerGroup.add(sBase, sMain, sTip);
        height = 0.8;
        break;

      case 'splash':
        // Cube-based tower with rotating elements
        const splashBase = new THREE.BoxGeometry(0.5, 0.3, 0.5);
        const splashMid = new THREE.BoxGeometry(0.4, 0.35, 0.4);
        const splashTop = new THREE.OctahedronGeometry(0.2);

        color = 0x00ff00; // Green
        const splashMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          metalness: 0.6,
          roughness: 0.4
        });

        const spBase = new THREE.Mesh(splashBase, splashMat);
        spBase.position.y = 0.15;
        const spMid = new THREE.Mesh(splashMid, splashMat);
        spMid.position.y = 0.475;
        spMid.rotation.y = Math.PI / 4;
        const spTop = new THREE.Mesh(splashTop, splashMat);
        spTop.position.y = 0.8;

        towerGroup.add(spBase, spMid, spTop);
        height = 0.55;
        break;

      default:
        const defaultGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
        color = 0xff6600;
        const defaultMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          metalness: 0.7,
          roughness: 0.3
        });
        const defaultMesh = new THREE.Mesh(defaultGeom, defaultMat);
        defaultMesh.position.y = 0.4;
        towerGroup.add(defaultMesh);
        height = 0.6;
    }

    // Position tower on the tile
    const x = (col - this.gameBoardWidth / 2) * this.tileSize;
    const z = (row - this.gameBoardHeight / 2) * this.tileSize;

    towerGroup.position.set(x, height, z);
    towerGroup.castShadow = true;
    towerGroup.receiveShadow = true;

    // Add shadow casting to all children
    towerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return towerGroup;
  }
}
