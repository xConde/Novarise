import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { BlockType, GameBoardTile, SpawnerType } from './models/game-board-tile';
import { TowerType } from './models/tower.model';
import { BOARD_CONFIG, TILE_VISUAL_CONFIG } from './constants/board.constants';
import { assertNever } from './utils/assert-never';
import { isInBounds } from './utils/coordinate-utils';
import { MutationOp } from './services/path-mutation.types';
import { TerraformMaterialPoolService } from './services/terraform-material-pool.service';
import { GeometryRegistryService } from './services/geometry-registry.service';
import { MaterialRegistryService } from './services/material-registry.service';
import { TileInstanceLayer } from './services/tile-instance-layer';

@Injectable()
export class GameBoardService {
  constructor(
    @Optional() private readonly terraformPool?: TerraformMaterialPoolService,
    @Optional() private readonly geometryRegistry?: GeometryRegistryService,
    @Optional() private readonly materialRegistry?: MaterialRegistryService,
  ) {}

  // Board configuration
  private gameBoardWidth = BOARD_CONFIG.width;
  private gameBoardHeight = BOARD_CONFIG.height;
  private readonly tileSize = BOARD_CONFIG.tileSize;
  private readonly tileHeight = BOARD_CONFIG.tileHeight;

  // Exit tile coordinates — derived from board dimensions so a future
  // BOARD_CONFIG resize keeps exits centred without manual tweaking.
  // Forms a 2×2 cluster anchored at the floor(height/2) × floor(width/2) tile.
  private readonly exitTileCoordinates: number[][] = (() => {
    const r = Math.floor(BOARD_CONFIG.height / 2);
    const c = Math.floor(BOARD_CONFIG.width / 2);
    return [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]];
  })();

  // Colors for different tile types — base must be visually distinct from wall.
  //
  // Iteration history:
  //  - Pre-branch (main, broken pipeline):     base=0x404858, wall=0x1a1520
  //  - First fix attempt (+50% bump, Phase A): base=0x6a7488, wall=0x2c2434  ← too bright
  //  - This iteration (~15% bump):             base=0x4a5366, wall=0x231c2c
  //
  // Phase A sprint 2/3 added outputColorSpace + OutputPass to the composer
  // chain. Tiny perceptual shift; not enough to need the +50% bump that
  // overshot the dark moody look.
  private readonly colorBase = 0x4a5366;    // small bump from 0x404858
  // UX-11: spawner / exit toned from pure cyan / magenta to muted versions
  // that read as "spawn portal" / "exit goal" without breaking the deep
  // moody atmosphere. Pure 0x00ffff and 0xff00ff popped as UI-bright
  // beacons against the dark board.
  private readonly colorSpawner = 0x2db8c4;  // muted teal-cyan
  private readonly colorExit = 0xc234a8;     // deep rose-magenta
  private readonly colorWall = 0x231c2c;    // small bump from 0x1a1520
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
      default:
        assertNever(type);
    }
  }

  /**
   * Set the elevation on a tile, returning the new tile or null on rejection.
   *
   * Rejected when:
   *  - (row, col) is out of bounds
   *  - existing tile is SPAWNER or EXIT (immutable for elevation per spike §7)
   *
   * TOWER tiles ARE allowed — that is the point of RAISE_PLATFORM (tower rides
   * up with its tile). Does NOT invalidate pathfinding cache — elevation does not
   * change isTraversable. Does NOT call mesh translate — ElevationService owns that.
   *
   * Returns the new tile for the caller to act on (e.g. mesh translate).
   */
  setTileElevation(row: number, col: number, newElevation: number): GameBoardTile | null {
    if (!isInBounds(row, col, this.gameBoardHeight, this.gameBoardWidth)) {
      return null;
    }

    const existing = this.gameBoard[row][col];

    if (existing.type === BlockType.SPAWNER || existing.type === BlockType.EXIT) {
      return null;
    }

    const newTile = existing.withElevation(newElevation);
    this.gameBoard[row][col] = newTile;
    return newTile;
  }

  // Create a visible tile mesh using BoxGeometry.
  // When mutationOp is provided, the mesh shares the pooled material from
  // TerraformMaterialPoolService (NOT a freshly-allocated material).
  // When mutationOp is undefined, behavior is unchanged — a new per-tile
  // material is created as before.
  // When elevation is provided and non-zero, the mesh is positioned at
  // Y = elevation + tileHeight / 2 instead of the default tileHeight / 2.
  // Default elevation = 0 preserves all existing call sites unchanged.
  createTileMesh(row: number, col: number, type: BlockType, mutationOp?: MutationOp, elevation = 0): THREE.Mesh {
    const tileFootprint = this.tileSize * TILE_VISUAL_CONFIG.geometryGapFactor;
    // GeometryRegistry is optional so flat TestBeds without it still work;
    // shipping path always has it (registered alongside TerraformMaterialPool
    // in GameBoardComponent.providers).
    const geometry = this.geometryRegistry
      ? this.geometryRegistry.getBox(tileFootprint, this.tileHeight, tileFootprint)
      : new THREE.BoxGeometry(tileFootprint, this.tileHeight, tileFootprint);

    let material: THREE.MeshStandardMaterial;

    if (mutationOp !== undefined && this.terraformPool) {
      // Shared pool material — do NOT dispose this on individual mesh swap.
      material = this.terraformPool.getMaterial(mutationOp);
    } else {
      // Per-instance tile material.
      //
      // Phase B sprint 14 originally cached this via MaterialRegistry per
      // BlockType, but TileHighlightService and BoardPointerService both
      // mutate `mesh.material.emissive` and `emissiveIntensity` directly to
      // drive hover, selection, valid-placement, and blocked-placement
      // tints. A shared cached material aliased every BASE tile to the
      // last writer's color — visible during placement preview. Reverted to
      // per-instance allocation pre-sprint-21.
      //
      // Sprint 21+ migrates BASE tiles to InstancedMesh + per-instance
      // color via instanceColor attribute, at which point only one shared
      // base material is needed and per-instance state lives in the
      // attribute. Until then, per-tile materials are correct.
      material = this.makeTileMaterial(type);
    }

    const mesh = new THREE.Mesh(geometry, material);

    // Position tiles in a grid - centered at origin
    const x = (col - this.gameBoardWidth / 2) * this.tileSize;
    const z = (row - this.gameBoardHeight / 2) * this.tileSize;

    mesh.position.set(x, elevation + this.tileHeight / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    return mesh;
  }

  /**
   * Build a TileInstanceLayer for every tile of `targetType` on the current
   * board that has NO active mutationOp. Returns null if no such tiles exist.
   *
   * Used by GameBoardComponent.renderGameBoard (sprint 22+) for BASE tiles
   * (and sprint 23 for WALL/SPAWNER/EXIT). Mutated tiles render as
   * individual meshes via createTileMesh — those slots are NOT included
   * in the instance layer.
   *
   * Material is shared across all instances (one MeshStandardMaterial per
   * BlockType). Geometry comes from GeometryRegistry. Per-instance colour
   * starts at identity (1, 1, 1); TileHighlightService writes per-instance
   * tints via `layer.setColorAt`.
   */
  buildTileInstanceLayer(targetType: BlockType): TileInstanceLayer | null {
    // WALL layer uses an overlap factor so connected impassable tiles
    // merge into a continuous structure; every other type uses the
    // standard gap so adjacent tiles read as discrete cells.
    const gapFactor = targetType === BlockType.WALL
      ? TILE_VISUAL_CONFIG.wallGapFactor
      : TILE_VISUAL_CONFIG.geometryGapFactor;
    const tileFootprint = this.tileSize * gapFactor;
    const geometry = this.geometryRegistry
      ? this.geometryRegistry.getBox(tileFootprint, this.tileHeight, tileFootprint)
      : new THREE.BoxGeometry(tileFootprint, this.tileHeight, tileFootprint);

    // Phase C sprint 30 red-team fix: route the per-type instanced material
    // through MaterialRegistry so its disposal is owned by the registry's
    // batch-dispose at encounter teardown. Pre-fix, the layer held a raw
    // material that was never disposed (TileInstanceLayer.dispose only
    // disposes the InstancedMesh, not the material; layer comments
    // incorrectly said the material was registry-owned).
    //
    // Per-instance highlights mutate `instanceColor`, NOT the shared
    // material — the sprint 22 instanceColor strategy is exactly what
    // makes this caching safe. Per-instance state lives in the buffer
    // attribute.
    const materialKey = `tile:instanced:${targetType}`;
    const material = this.materialRegistry
      ? this.materialRegistry.getOrCreate(materialKey, () => this.makeTileMaterial(targetType))
      : this.makeTileMaterial(targetType);

    const instances: Array<{ row: number; col: number; worldX: number; worldZ: number; worldY: number }> = [];
    for (let row = 0; row < this.gameBoard.length; row++) {
      const rowTiles = this.gameBoard[row];
      for (let col = 0; col < rowTiles.length; col++) {
        const tile = rowTiles[col];
        if (tile.type !== targetType) continue;
        // Mutated tiles use per-mesh rendering via createTileMesh + TerraformPool.
        if (tile.mutationOp !== undefined) continue;
        const elevation = tile.elevation ?? 0;
        const x = (col - this.gameBoardWidth / 2) * this.tileSize;
        const z = (row - this.gameBoardHeight / 2) * this.tileSize;
        const y = elevation + this.tileHeight / 2;
        instances.push({ row, col, worldX: x, worldZ: z, worldY: y });
      }
    }

    if (instances.length === 0) {
      // Material is registry-owned (or per-call when no registry); the
      // registry's batch dispose handles either case. Don't dispose here.
      if (!this.materialRegistry) {
        material.dispose();
      }
      return null;
    }

    return new TileInstanceLayer(targetType, geometry, material, instances);
  }

  private makeTileMaterial(type: BlockType): THREE.MeshStandardMaterial {
    const color = this.getTileColor(type);
    const isBase = type === BlockType.BASE;
    const isWall = type === BlockType.WALL;
    const v = TILE_VISUAL_CONFIG;
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: isWall ? v.wall.emissive : isBase ? v.baseEmissive : color,
      emissiveIntensity: isBase ? v.base.emissiveIntensity : isWall ? v.wall.emissiveIntensity : v.other.emissiveIntensity,
      metalness: isWall ? v.wall.metalness : v.base.metalness,
      roughness: isBase ? v.base.roughness : isWall ? v.wall.roughness : v.other.roughness,
      envMapIntensity: v.envMapIntensity,
    });
  }

  /**
   * Two trim planes sitting just above the floor: a bright cool plane
   * scoped to the bounding box of non-wall tiles (designed trim
   * between buildable cells) and a dimmer purple-grey plane scoped to
   * the wall bounding box (accent-tinted structure between wall
   * cells). Each plane is hidden by its respective tile geometry from
   * above; the cell gap exposes a strip of plane color at every
   * boundary.
   *
   * Two planes (rather than one full-board plane) prevent the bright
   * trim from leaking through wall column seams and into tile-less
   * cells beyond the playable area, while still giving walls visible
   * cell structure with their own accent-tinted color.
   *
   * Returns a Group for API compatibility — disposal traverses the
   * group and disposes each mesh's geometry/material.
   */
  createGridLines(): THREE.Group {
    const gridGroup = new THREE.Group();

    if (this.gameBoardWidth <= 0 || this.gameBoardHeight <= 0) return gridGroup;

    const nonWallBB = this.computeTileBoundingBox(t => t.type !== BlockType.WALL);
    if (nonWallBB) {
      gridGroup.add(this.buildTrimPlane(nonWallBB, 0xd6e2ff, 0.38, 0.005));
    }

    const wallBB = this.computeTileBoundingBox(t => t.type === BlockType.WALL);
    if (wallBB) {
      // Dim purple-grey accent — high enough opacity to show through
      // tight wall gaps, dark enough that the wall structure reads as
      // tinted rather than as the same trim brightness as the
      // buildable interior. Y is offset slightly below the bright
      // plane so any bounding-box overlap renders deterministically.
      gridGroup.add(this.buildTrimPlane(wallBB, 0x6a5878, 0.6, 0.004));
    }

    return gridGroup;
  }

  private computeTileBoundingBox(
    filter: (tile: GameBoardTile) => boolean,
  ): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let minCol = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;
    let any = false;
    for (let row = 0; row < this.gameBoard.length; row++) {
      const rowTiles = this.gameBoard[row];
      for (let col = 0; col < rowTiles.length; col++) {
        const tile = rowTiles[col];
        if (!tile || !filter(tile)) continue;
        any = true;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
    return any ? { minRow, maxRow, minCol, maxCol } : null;
  }

  private buildTrimPlane(
    bb: { minRow: number; maxRow: number; minCol: number; maxCol: number },
    color: number,
    opacity: number,
    y: number,
  ): THREE.Mesh {
    const planeWidth = (bb.maxCol - bb.minCol + 1) * this.tileSize;
    const planeHeight = (bb.maxRow - bb.minRow + 1) * this.tileSize;
    const centerX = ((bb.minCol + bb.maxCol) / 2 - this.gameBoardWidth / 2) * this.tileSize;
    const centerZ = ((bb.minRow + bb.maxRow) / 2 - this.gameBoardHeight / 2) * this.tileSize;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(centerX, y, centerZ);
    mesh.renderOrder = -1;

    return mesh;
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
    if (!isInBounds(row, col, this.gameBoardHeight, this.gameBoardWidth)) {
      return false;
    }

    const tile = this.gameBoard[row][col];

    // Standard case: BASE tile that is purchasable and unoccupied.
    const isStandardBase =
      tile.type === BlockType.BASE &&
      tile.isPurchasable &&
      tile.towerType === null;

    // Phase 2 Sprint 15 — BRIDGEHEAD exception. A WALL tile carrying
    // mutationOp === 'bridgehead' is intentionally tower-placeable: the
    // Cartographer card creates a "tower-only platform" that does NOT admit
    // enemies (tile stays non-traversable) but DOES admit a tower.
    // No wouldBlockPath check is needed because the tile is already a WALL —
    // placing a tower on top does not change traversability.
    const isBridgehead =
      tile.type === BlockType.WALL &&
      tile.mutationOp === 'bridgehead' &&
      tile.towerType === null;

    if (!isStandardBase && !isBridgehead) {
      return false;
    }

    // Bridgehead tiles are already non-traversable, so a tower on them can
    // never turn a currently-open path into a blocked one. Skip the BFS.
    if (isBridgehead) {
      return true;
    }

    // Standard BASE path: reject placement if it would block all paths from
    // spawners to exits.
    if (this.wouldBlockPath(row, col)) {
      return false;
    }

    return true;
  }

  /**
   * Check whether placing a tower at (row, col) would block every path
   * from any spawner to any exit. Uses BFS with the same traversability
   * logic as EnemyService.findPath.
   *
   * Delegates to `wouldBlockPathIfSet(row, col, BlockType.TOWER)` for
   * backward compatibility. All existing callers remain unchanged.
   */
  wouldBlockPath(row: number, col: number): boolean {
    return this.wouldBlockPathIfSet(row, col, BlockType.TOWER);
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

    // Mark the tile as occupied with a tower and non-traversable.
    // Preserve elevation — same fix class as Phase 3 red-team Finding 1.
    const oldTile = this.gameBoard[row][col];
    this.gameBoard[row][col] = new GameBoardTile(
      oldTile.x,
      oldTile.y,
      BlockType.TOWER,
      false,
      false,
      oldTile.cost,
      towerType,
      undefined,
      undefined,
      oldTile.elevation,
    );

    return true;
  }

  /**
   * Directly mark a tile as occupied by a tower without running BFS path validation.
   * Use during checkpoint restore to avoid false-positive path-blocked rejections when
   * towers are placed one-by-one before the full saved layout is reconstructed.
   */
  forceSetTower(row: number, col: number, towerType: TowerType): void {
    if (!isInBounds(row, col, this.gameBoardHeight, this.gameBoardWidth)) {
      return;
    }
    // Preserve elevation — same fix class as Phase 3 red-team Finding 1.
    const oldTile = this.gameBoard[row][col];
    this.gameBoard[row][col] = new GameBoardTile(
      oldTile.x,
      oldTile.y,
      BlockType.TOWER,
      false,
      false,
      oldTile.cost,
      towerType,
      undefined,
      undefined,
      oldTile.elevation,
    );
  }

  removeTower(row: number, col: number): boolean {
    if (!isInBounds(row, col, this.gameBoardHeight, this.gameBoardWidth)) {
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

  /**
   * Mutate a tile's type in-place, returning the new GameBoardTile or null on rejection.
   *
   * Rejected when:
   *  - (row, col) is out of bounds
   *  - existing tile is SPAWNER or EXIT (immutable)
   *  - existing tile is TOWER (sell the tower first)
   *
   * Does NOT call pathfinding invalidate or enemy repath — that is
   * PathMutationService's responsibility.
   *
   * Note: the tile's x/y fields use (col, row) to match the existing placeTower/
   * forceSetTower convention (see line 405-414 of the original file).
   */
  setTileType(
    row: number,
    col: number,
    type: BlockType,
    mutationOp: MutationOp,
    priorType?: BlockType,
  ): GameBoardTile | null {
    if (!isInBounds(row, col, this.gameBoardHeight, this.gameBoardWidth)) {
      return null;
    }

    const existing = this.gameBoard[row][col];

    if (
      existing.type === BlockType.SPAWNER ||
      existing.type === BlockType.EXIT ||
      existing.type === BlockType.TOWER
    ) {
      return null;
    }

    const newTile = GameBoardTile.createMutated(
      col,
      row,
      type,
      priorType ?? existing.type,
      mutationOp,
    );
    // Red-team Finding 1 (Phase 3 close): `createMutated` does not take an
    // elevation parameter; path mutations on an elevated tile would silently
    // wipe the elevation field. Preserve it by cloning the newly-created tile
    // with the existing tile's elevation when non-zero.
    const preserved = existing.elevation !== undefined && existing.elevation !== 0
      ? newTile.withElevation(existing.elevation)
      : newTile;
    this.gameBoard[row][col] = preserved;
    return preserved;
  }

  /**
   * Generalized version of wouldBlockPath.
   *
   * Temporarily sets (row, col) to the proposed `type` and runs the same
   * spawner→exit BFS. The tile is traversable during BFS iff
   * `type === BASE` (or `type === EXIT`).
   *
   * `wouldBlockPath` is preserved as a one-liner wrapper for backward compat.
   */
  wouldBlockPathIfSet(row: number, col: number, type: BlockType): boolean {
    if (this.spawnerTiles.length === 0 || this.exitTiles.length === 0) {
      return false;
    }

    const originalTile = this.gameBoard[row][col];

    // Temporarily substitute the proposed tile type.
    // Elevation is intentionally omitted — this is a throwaway BFS probe tile;
    // only isTraversable matters for pathfinding, and elevation does not affect it.
    const traversable = type === BlockType.BASE || type === BlockType.EXIT;
    this.gameBoard[row][col] = new GameBoardTile(
      originalTile.x,
      originalTile.y,
      type,
      traversable,
      false,
      originalTile.cost,
      originalTile.towerType,
    );

    try {
      const exitSet = new Set<string>();
      for (const [eRow, eCol] of this.exitTiles) {
        exitSet.add(`${eRow},${eCol}`);
      }

      let blocked = false;
      for (const [sRow, sCol] of this.spawnerTiles) {
        if (!this.bfsCanReachExit(sRow, sCol, exitSet)) {
          blocked = true;
          break;
        }
      }
      return blocked;
    } finally {
      this.gameBoard[row][col] = originalTile;
    }
  }

}
