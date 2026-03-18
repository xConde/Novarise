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
   *
   * Phase 1: Walk through the connected spawner group to find ALL traversable
   * neighbors of the entire group — not just the single start tile. This fixes
   * corner spawners whose individual neighbors are all OOB or other spawner tiles.
   *
   * Phase 2: Standard BFS from the seeded traversable neighbors.
   */
  private bfsCanReachExit(startRow: number, startCol: number, exitSet: Set<string>): boolean {
    const visited = new Set<string>();
    const queue: [number, number][] = [];
    const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // Phase 1: Walk through connected spawner tiles to find ALL traversable neighbors
    // of the spawner group (not just the single start tile).
    const spawnerVisited = new Set<string>();
    const spawnerQueue: [number, number][] = [[startRow, startCol]];
    spawnerVisited.add(`${startRow},${startCol}`);

    while (spawnerQueue.length > 0) {
      const [sr, sc] = spawnerQueue.shift()!;
      for (const [dr, dc] of directions) {
        const nr = sr + dr;
        const nc = sc + dc;
        if (nr < 0 || nr >= this.gameBoardHeight || nc < 0 || nc >= this.gameBoardWidth) continue;
        const key = `${nr},${nc}`;
        const neighbor = this.gameBoard[nr][nc];

        if (neighbor.type === BlockType.SPAWNER && !spawnerVisited.has(key)) {
          // Connected spawner tile — expand the group
          spawnerVisited.add(key);
          spawnerQueue.push([nr, nc]);
        } else if ((neighbor.isTraversable || neighbor.type === BlockType.EXIT) && !visited.has(key)) {
          // Traversable neighbor of the spawner group — seed BFS
          visited.add(key);
          if (exitSet.has(key)) return true;
          queue.push([nr, nc]);
        }
      }
    }

    // Phase 2: Standard BFS from all seeded traversable neighbors
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

}
