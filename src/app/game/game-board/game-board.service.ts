import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockType, GameBoardTile, SpawnerType } from './models/game-board-tile';
import { TowerType } from './models/tower.model';
import { BOARD_CONFIG } from './constants/board.constants';

@Injectable()
export class GameBoardService {
  // Board configuration
  private gameBoardWidth = BOARD_CONFIG.width;
  private gameBoardHeight = BOARD_CONFIG.height;
  private readonly tileSize = BOARD_CONFIG.tileSize;
  private readonly tileHeight = BOARD_CONFIG.tileHeight;

  // Exit tile coordinates (center of board)
  private readonly exitTileCoordinates: number[][] = [
    [9, 11], [9, 12], [10, 11], [10, 12]
  ];

  // Colors for different tile types
  private readonly colorBase = 0x3a3a4a;
  private readonly colorSpawner = 0x00ffff;
  private readonly colorExit = 0xff00ff;
  private readonly colorWall = 0x2a2540;
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

  // No eager board generation — ngOnInit always calls importBoard() or resetBoard()
  // before the board is used, so constructor work would be immediately discarded.

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
  }

  private getSpawnerRange(type: SpawnerType) {
    const w = this.gameBoardWidth;
    const h = this.gameBoardHeight;
    switch (type) {
      case SpawnerType.TOP_LEFT:
        return { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1, centerX: 0, centerY: 0 };
      case SpawnerType.TOP_RIGHT:
        return { minRow: 0, maxRow: 1, minCol: w - 2, maxCol: w - 1, centerX: 0, centerY: w - 1 };
      case SpawnerType.BOTTOM_LEFT:
        return { minRow: h - 2, maxRow: h - 1, minCol: 0, maxCol: 1, centerX: h - 2, centerY: 0 };
      case SpawnerType.BOTTOM_RIGHT:
        return { minRow: h - 2, maxRow: h - 1, minCol: w - 2, maxCol: w - 1, centerX: h - 2, centerY: w - 1 };
    }
  }

  // Create a visible tile mesh using BoxGeometry
  createTileMesh(row: number, col: number, type: BlockType): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.tileSize * 0.95, this.tileHeight, this.tileSize * 0.95);
    const color = this.getTileColor(type);

    // Organic cave rock material
    const isBase = type === BlockType.BASE;
    const isWall = type === BlockType.WALL;
    const isSubdued = isBase || isWall;
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: isSubdued ? 0x2a2548 : color,
      emissiveIntensity: isBase ? 0.25 : isWall ? 0.15 : 0.45,
      metalness: isWall ? 0.4 : 0.1,
      roughness: isBase ? 0.75 : isWall ? 0.9 : 0.7,
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
      color: 0x7a6a9a,
      transparent: true,
      opacity: 0.45,
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
      const line = new THREE.Line(geometry, gridMaterial);
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
      const line = new THREE.Line(geometry, gridMaterial);
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
      case BlockType.WALL:
        return this.colorWall;
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

  /**
   * Import an external board, replacing all internal state.
   * Used by MapBridgeService to load editor-created maps.
   */
  importBoard(board: GameBoardTile[][], width: number, height: number): void {
    this.gameBoard = board;
    this.gameBoardWidth = width;
    this.gameBoardHeight = height;
    this.spawnerTiles = [];
    this.exitTiles = [];
    this.spawnerChoices = [];

    // Scan imported board for spawner/exit positions
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tile = board[row][col];
        if (tile.type === BlockType.SPAWNER) {
          this.spawnerTiles.push([row, col]);
        } else if (tile.type === BlockType.EXIT) {
          this.exitTiles.push([row, col]);
        }
      }
    }
  }

  /**
   * Reset board to default hardcoded state.
   * Fixes ghost tower singleton leak on re-navigation.
   */
  resetBoard(): void {
    this.gameBoardWidth = BOARD_CONFIG.width;
    this.gameBoardHeight = BOARD_CONFIG.height;
    this.gameBoard = [];
    this.spawnerTiles = [];
    this.exitTiles = [];
    this.spawnerChoices = [
      SpawnerType.TOP_LEFT,
      SpawnerType.TOP_RIGHT,
      SpawnerType.BOTTOM_LEFT,
      SpawnerType.BOTTOM_RIGHT
    ];
    this.generateBaseBoard();
    this.generateExitTiles();
    this.generateSpawner();
  }

  getSpawnerTiles(): number[][] {
    return this.spawnerTiles;
  }

  getExitTiles(): number[][] {
    return this.exitTiles;
  }

  // Tower placement
  canPlaceTower(row: number, col: number): boolean {
    if (row < 0 || row >= this.gameBoardHeight || col < 0 || col >= this.gameBoardWidth) {
      return false;
    }

    const tile = this.gameBoard[row][col];

    // Can only place on BASE tiles that are purchasable
    if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) {
      return false;
    }

    // Reject placement if it would block all paths from spawners to exits
    if (this.wouldBlockPath(row, col)) {
      return false;
    }

    return true;
  }

  /**
   * Check whether placing a tower at (row, col) would block every path
   * from any spawner to any exit. Uses BFS with the same traversability
   * logic as EnemyService.findPath.
   */
  wouldBlockPath(row: number, col: number): boolean {
    if (this.spawnerTiles.length === 0 || this.exitTiles.length === 0) {
      return false;
    }

    // Temporarily mark the tile as non-traversable
    const originalTile = this.gameBoard[row][col];
    this.gameBoard[row][col] = new GameBoardTile(
      originalTile.x,
      originalTile.y,
      BlockType.TOWER,
      false,
      false,
      originalTile.cost,
      TowerType.BASIC // placeholder — type doesn't matter for traversability
    );

    try {
      // Build a set of exit positions for fast lookup
      const exitSet = new Set<string>();
      for (const [eRow, eCol] of this.exitTiles) {
        exitSet.add(`${eRow},${eCol}`);
      }

      // BFS from each spawner to any exit. If ANY spawner cannot reach
      // ANY exit, the placement blocks the path.
      let blocked = false;
      for (const [sRow, sCol] of this.spawnerTiles) {
        if (!this.bfsCanReachExit(sRow, sCol, exitSet)) {
          blocked = true;
          break;
        }
      }

      return blocked;
    } finally {
      // Always restore the original tile, even if BFS throws
      this.gameBoard[row][col] = originalTile;
    }
  }

  /**
   * BFS from (startRow, startCol) to any tile in exitSet.
   * Traversability: tile.isTraversable OR tile.type === EXIT.
   * Matches EnemyService.findPath neighbor logic.
   */
  private bfsCanReachExit(startRow: number, startCol: number, exitSet: Set<string>): boolean {
    const visited = new Set<string>();
    const queue: [number, number][] = [];

    // Spawner tiles are non-traversable; seed BFS from their traversable neighbors
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      const nr = startRow + dr;
      const nc = startCol + dc;
      if (nr < 0 || nr >= this.gameBoardHeight || nc < 0 || nc >= this.gameBoardWidth) continue;
      const neighbor = this.gameBoard[nr][nc];
      if (neighbor.isTraversable || neighbor.type === BlockType.EXIT) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          if (exitSet.has(key)) return true;
          queue.push([nr, nc]);
        }
      }
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;

      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= this.gameBoardHeight || nc < 0 || nc >= this.gameBoardWidth) continue;

        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;

        const tile = this.gameBoard[nr][nc];
        if (!tile.isTraversable && tile.type !== BlockType.EXIT) continue;

        visited.add(key);
        if (exitSet.has(key)) return true;
        queue.push([nr, nc]);
      }
    }

    return false;
  }

  placeTower(row: number, col: number, towerType: TowerType): boolean {
    if (!this.canPlaceTower(row, col)) {
      return false;
    }

    // Mark the tile as occupied with a tower and non-traversable
    const oldTile = this.gameBoard[row][col];
    this.gameBoard[row][col] = new GameBoardTile(
      oldTile.x,
      oldTile.y,
      BlockType.TOWER,
      false,
      false,
      oldTile.cost,
      towerType
    );

    return true;
  }

  removeTower(row: number, col: number): boolean {
    if (row < 0 || row >= this.gameBoardHeight || col < 0 || col >= this.gameBoardWidth) {
      return false;
    }

    const tile = this.gameBoard[row][col];
    if (tile.type !== BlockType.TOWER) {
      return false;
    }

    // Restore tile to traversable BASE state
    this.gameBoard[row][col] = GameBoardTile.createBase(row, col);
    return true;
  }

  // Create tower mesh based on type
  createTowerMesh(row: number, col: number, towerType: TowerType = TowerType.BASIC): THREE.Group {
    const towerGroup = new THREE.Group();
    let color: number;
    const tileTop = this.tileHeight; // Towers sit on top of tile

    // Different organic tower designs
    switch (towerType) {
      case TowerType.BASIC:
        // Ancient crystal obelisk - jagged and organic
        const obeliskBase = new THREE.CylinderGeometry(0.35, 0.42, 0.25, 6);
        const obeliskMid1 = new THREE.CylinderGeometry(0.32, 0.35, 0.35, 6);
        const obeliskMid2 = new THREE.CylinderGeometry(0.28, 0.32, 0.3, 6);
        const obeliskTop = new THREE.ConeGeometry(0.28, 0.4, 6);
        const crystal = new THREE.OctahedronGeometry(0.15, 0);

        color = 0xd47a3a; // Warm amber
        const basicMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0xaa6a2a,
          emissiveIntensity: 0.7,
          metalness: 0.3,
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
        oCrystal.name = 'crystal';
        oCrystal.position.y = 1.35;

        towerGroup.add(oBase, oMid1, oMid2, oTop, oCrystal);
        break;

      case TowerType.SNIPER:
        // Tall crystalline spike - elegant and sharp
        const spikeBase = new THREE.DodecahedronGeometry(0.3, 0);
        const spikeShaft1 = new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8);
        const spikeShaft2 = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 7);
        const spikeTip = new THREE.ConeGeometry(0.18, 0.7, 6);
        const spikePoint = new THREE.ConeGeometry(0.08, 0.3, 4);

        color = 0x7a5ac4; // Deep purple
        const sniperMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x6a4a9a,
          emissiveIntensity: 0.8,
          metalness: 0.4,
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
        snPoint.name = 'tip';
        snPoint.position.y = 2.0;

        towerGroup.add(snBase, snShaft1, snShaft2, snTip, snPoint);
        break;

      case TowerType.SPLASH:
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
          emissive: 0x4a9a6a,
          emissiveIntensity: 0.7,
          metalness: 0.25,
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
        spSpore1.name = 'spore';
        spSpore1.position.set(0.15, 0.95, 0.1);

        const spSpore2 = new THREE.Mesh(spore2, splashMat);
        spSpore2.name = 'spore';
        spSpore2.position.set(-0.12, 0.9, -0.08);

        const spSpore3 = new THREE.Mesh(spore3, splashMat);
        spSpore3.name = 'spore';
        spSpore3.position.set(0.08, 1.0, -0.15);

        towerGroup.add(spStemBase, spStemMid, spCapBase, spCapTop, spSpore1, spSpore2, spSpore3);
        break;

      case TowerType.SLOW:
        // Ice/freeze pad — flat wide cylinder base with a raised ring on top
        const iceBase = new THREE.CylinderGeometry(0.4, 0.45, 0.15, 12);
        const icePillar = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8);
        const iceRingOuter = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24);
        const iceRingInner = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 24);
        const iceCrystal = new THREE.OctahedronGeometry(0.14, 0);

        color = 0x4488ff; // Blue/ice
        const slowMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x2255cc,
          emissiveIntensity: 0.8,
          metalness: 0.5,
          roughness: 0.3,
          transparent: true,
          opacity: 0.9
        });

        const slBase = new THREE.Mesh(iceBase, slowMat);
        slBase.position.y = 0.075;

        const slPillar = new THREE.Mesh(icePillar, slowMat);
        slPillar.position.y = 0.375;

        const slRingOuter = new THREE.Mesh(iceRingOuter, slowMat);
        slRingOuter.position.y = 0.64;

        const slRingInner = new THREE.Mesh(iceRingInner, slowMat);
        slRingInner.position.y = 0.645;

        const slCrystal = new THREE.Mesh(iceCrystal, slowMat);
        slCrystal.name = 'crystal';
        slCrystal.position.y = 0.82;

        towerGroup.add(slBase, slPillar, slRingOuter, slRingInner, slCrystal);
        break;

      case TowerType.CHAIN:
        // Electric antenna — thin tall cylinder with sphere on top
        const chainBase = new THREE.CylinderGeometry(0.3, 0.38, 0.2, 8);
        const chainShaft = new THREE.CylinderGeometry(0.1, 0.14, 0.8, 6);
        const chainOrb = new THREE.SphereGeometry(0.18, 10, 8);
        const chainSpark1 = new THREE.SphereGeometry(0.06, 6, 6);
        const chainSpark2 = new THREE.SphereGeometry(0.05, 6, 6);

        color = 0xffdd00; // Yellow/electric
        const chainMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0xddaa00,
          emissiveIntensity: 1.0,
          metalness: 0.6,
          roughness: 0.2
        });

        const chBase = new THREE.Mesh(chainBase, chainMat);
        chBase.position.y = 0.1;

        const chShaft = new THREE.Mesh(chainShaft, chainMat);
        chShaft.position.y = 0.6;

        const chOrb = new THREE.Mesh(chainOrb, chainMat);
        chOrb.name = 'orb';
        chOrb.position.y = 1.18;

        const chSpark1 = new THREE.Mesh(chainSpark1, chainMat);
        chSpark1.name = 'spark';
        chSpark1.position.set(0.22, 1.25, 0);

        const chSpark2 = new THREE.Mesh(chainSpark2, chainMat);
        chSpark2.name = 'spark';
        chSpark2.position.set(-0.18, 1.3, 0.14);

        towerGroup.add(chBase, chShaft, chOrb, chSpark1, chSpark2);
        break;

      case TowerType.MORTAR:
        // Dark cannon — wide squat cylinder base with angled barrel
        const mortarBase = new THREE.CylinderGeometry(0.42, 0.48, 0.3, 10);
        const mortarRing = new THREE.CylinderGeometry(0.36, 0.4, 0.15, 10);
        const mortarBarrel = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8);
        const mortarMuzzle = new THREE.CylinderGeometry(0.12, 0.1, 0.12, 8);

        color = 0x664422; // Dark brown cannon
        const mortarMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x442200,
          emissiveIntensity: 0.4,
          metalness: 0.7,
          roughness: 0.5
        });

        const moBase = new THREE.Mesh(mortarBase, mortarMat);
        moBase.position.y = 0.15;

        const moRing = new THREE.Mesh(mortarRing, mortarMat);
        moRing.position.y = 0.375;

        // Angled barrel tilted ~40 degrees
        const moBarrel = new THREE.Mesh(mortarBarrel, mortarMat);
        moBarrel.name = 'barrel';
        moBarrel.position.set(0.1, 0.72, 0);
        moBarrel.rotation.z = -Math.PI / 4.5;

        const moMuzzle = new THREE.Mesh(mortarMuzzle, mortarMat);
        moMuzzle.name = 'muzzle';
        moMuzzle.position.set(0.25, 0.98, 0);
        moMuzzle.rotation.z = -Math.PI / 4.5;

        towerGroup.add(moBase, moRing, moBarrel, moMuzzle);
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

    towerGroup.scale.set(1.4, 1.4, 1.4);
    towerGroup.position.set(x, tileTop, z);
    towerGroup.castShadow = true;
    towerGroup.receiveShadow = true;
    towerGroup.userData['towerType'] = towerType;

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
