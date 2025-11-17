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

    // Organic cave rock material
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: type === BlockType.BASE ? 0x1a1528 : color,
      emissiveIntensity: type === BlockType.BASE ? 0.05 : 0.2,
      metalness: 0.1,
      roughness: type === BlockType.BASE ? 0.9 : 0.7,
      envMapIntensity: 0.3
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

    // Subtle bioluminescent veins
    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x5a4a7a,
      transparent: true,
      opacity: 0.25,
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
    const tileTop = this.tileHeight; // Towers sit on top of tile

    // Different organic tower designs
    switch (towerType) {
      case 'basic':
        // Ancient crystal obelisk - jagged and organic
        const obeliskBase = new THREE.CylinderGeometry(0.35, 0.42, 0.25, 6);
        const obeliskMid1 = new THREE.CylinderGeometry(0.32, 0.35, 0.35, 6);
        const obeliskMid2 = new THREE.CylinderGeometry(0.28, 0.32, 0.3, 6);
        const obeliskTop = new THREE.ConeGeometry(0.28, 0.4, 6);
        const crystal = new THREE.OctahedronGeometry(0.15, 0);

        color = 0xd47a3a; // Warm amber
        const basicMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x8a4a1a,
          emissiveIntensity: 0.4,
          metalness: 0.2,
          roughness: 0.6
        });

        const oBase = new THREE.Mesh(obeliskBase, basicMat);
        oBase.position.y = 0.125;
        oBase.rotation.y = Math.PI / 6;

        const oMid1 = new THREE.Mesh(obeliskMid1, basicMat);
        oMid1.position.y = 0.425;
        oMid1.rotation.y = -Math.PI / 6;

        const oMid2 = new THREE.Mesh(obeliskMid2, basicMat);
        oMid2.position.y = 0.75;

        const oTop = new THREE.Mesh(obeliskTop, basicMat);
        oTop.position.y = 1.1;
        oTop.rotation.y = Math.PI / 6;

        const oCrystal = new THREE.Mesh(crystal, basicMat);
        oCrystal.position.y = 1.35;

        towerGroup.add(oBase, oMid1, oMid2, oTop, oCrystal);
        break;

      case 'sniper':
        // Tall crystalline spike - elegant and sharp
        const spikeBase = new THREE.DodecahedronGeometry(0.3, 0);
        const spikeShaft1 = new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8);
        const spikeShaft2 = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 7);
        const spikeTip = new THREE.ConeGeometry(0.18, 0.7, 6);
        const spikePoint = new THREE.ConeGeometry(0.08, 0.3, 4);

        color = 0x7a5ac4; // Deep purple
        const sniperMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x4a2a7a,
          emissiveIntensity: 0.5,
          metalness: 0.3,
          roughness: 0.4
        });

        const snBase = new THREE.Mesh(spikeBase, sniperMat);
        snBase.position.y = 0.2;
        snBase.rotation.y = Math.PI / 5;

        const snShaft1 = new THREE.Mesh(spikeShaft1, sniperMat);
        snShaft1.position.y = 0.55;

        const snShaft2 = new THREE.Mesh(spikeShaft2, sniperMat);
        snShaft2.position.y = 1.05;
        snShaft2.rotation.y = Math.PI / 7;

        const snTip = new THREE.Mesh(spikeTip, sniperMat);
        snTip.position.y = 1.55;

        const snPoint = new THREE.Mesh(spikePoint, sniperMat);
        snPoint.position.y = 2.0;

        towerGroup.add(snBase, snShaft1, snShaft2, snTip, snPoint);
        break;

      case 'splash':
        // Mushroom-like spore launcher - organic and bulbous
        const stemBase = new THREE.CylinderGeometry(0.28, 0.35, 0.3, 8);
        const stemMid = new THREE.CylinderGeometry(0.24, 0.28, 0.35, 8);
        const capBase = new THREE.CylinderGeometry(0.4, 0.3, 0.2, 12);
        const capTop = new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const spore1 = new THREE.SphereGeometry(0.08, 6, 6);
        const spore2 = new THREE.SphereGeometry(0.06, 6, 6);
        const spore3 = new THREE.SphereGeometry(0.07, 6, 6);

        color = 0x4ac47a; // Vibrant green
        const splashMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x2a7a4a,
          emissiveIntensity: 0.4,
          metalness: 0.15,
          roughness: 0.7
        });

        const spStemBase = new THREE.Mesh(stemBase, splashMat);
        spStemBase.position.y = 0.15;

        const spStemMid = new THREE.Mesh(stemMid, splashMat);
        spStemMid.position.y = 0.475;

        const spCapBase = new THREE.Mesh(capBase, splashMat);
        spCapBase.position.y = 0.75;

        const spCapTop = new THREE.Mesh(capTop, splashMat);
        spCapTop.position.y = 0.85;

        const spSpore1 = new THREE.Mesh(spore1, splashMat);
        spSpore1.position.set(0.15, 0.95, 0.1);

        const spSpore2 = new THREE.Mesh(spore2, splashMat);
        spSpore2.position.set(-0.12, 0.9, -0.08);

        const spSpore3 = new THREE.Mesh(spore3, splashMat);
        spSpore3.position.set(0.08, 1.0, -0.15);

        towerGroup.add(spStemBase, spStemMid, spCapBase, spCapTop, spSpore1, spSpore2, spSpore3);
        break;

      default:
        const defaultGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.6, 6);
        color = 0xd47a3a;
        const defaultMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x8a4a1a,
          emissiveIntensity: 0.3,
          metalness: 0.2,
          roughness: 0.6
        });
        const defaultMesh = new THREE.Mesh(defaultGeom, defaultMat);
        defaultMesh.position.y = 0.3;
        towerGroup.add(defaultMesh);
    }

    // Position tower on the tile - sitting on top at tileHeight (0.2)
    const x = (col - this.gameBoardWidth / 2) * this.tileSize;
    const z = (row - this.gameBoardHeight / 2) * this.tileSize;

    towerGroup.position.set(x, tileTop, z);
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
