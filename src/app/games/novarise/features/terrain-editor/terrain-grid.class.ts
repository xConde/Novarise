import * as THREE from 'three';
import { TerrainType, TERRAIN_CONFIGS } from '../../models/terrain-types.enum';
import { disposeMaterial } from '../../../../game/game-board/utils/three-utils';
import { TerrainGridState, TerrainGridStateLegacy } from './terrain-grid-state.interface';
import { EDITOR_GRID_LINES, EDITOR_HEIGHT } from '../../constants/editor-ui.constants';
import { MAX_SPAWN_POINTS, MAX_EXIT_POINTS } from '../../constants/editor-ui.constants';

export interface TerrainTile {
  type: TerrainType;
  height: number;
  mesh: THREE.Mesh;
}

export class TerrainGrid {
  private tiles: TerrainTile[][] = [];
  private heightMap: number[][] = [];
  private scene: THREE.Scene;
  private readonly gridSize: number;
  private readonly tileSize = 1;

  // Performance: Cache mesh array instead of recreating every frame
  private meshCache: THREE.Mesh[] = [];
  private gridLines!: THREE.LineSegments;

  // Tower defense foundation — multi-spawn/exit
  private spawnPoints: { x: number, z: number }[] = [];
  private exitPoints: { x: number, z: number }[] = [];
  private buildableGrid: boolean[][] = []; // Track which tiles can have towers

  constructor(scene: THREE.Scene, gridSize: number = 25) {
    this.scene = scene;
    this.gridSize = gridSize;
    this.initializeGrid();
  }

  private initializeGrid(): void {
    const halfSize = this.gridSize / 2;

    for (let x = 0; x < this.gridSize; x++) {
      this.tiles[x] = [];
      this.heightMap[x] = [];
      this.buildableGrid[x] = [];

      for (let z = 0; z < this.gridSize; z++) {
        // Initialize height to 0
        this.heightMap[x][z] = 0;

        // All tiles start as buildable
        this.buildableGrid[x][z] = true;

        // Create tile mesh
        const mesh = this.createTileMesh(x, z, TerrainType.BEDROCK, 0);
        this.tiles[x][z] = {
          type: TerrainType.BEDROCK,
          height: 0,
          mesh: mesh
        };

        this.scene.add(mesh);
        this.meshCache.push(mesh); // Build cache once during initialization
      }
    }

    // Add grid lines
    this.addGridLines();

    // Set default spawn and exit points for tower defense
    this.addSpawnPoint(0, Math.floor(this.gridSize / 2));
    this.addExitPoint(this.gridSize - 1, Math.floor(this.gridSize / 2));
  }

  private createTileMesh(x: number, z: number, type: TerrainType, height: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.tileSize * 0.95, 0.2 + height, this.tileSize * 0.95);
    const config = TERRAIN_CONFIGS[type];

    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.emissiveColor,
      emissiveIntensity: config.emissiveIntensity,
      roughness: config.roughness,
      metalness: config.metalness
    });

    const mesh = new THREE.Mesh(geometry, material);

    const halfSize = this.gridSize / 2;
    mesh.position.set(
      (x - halfSize) * this.tileSize,
      (0.1 + height / 2),
      (z - halfSize) * this.tileSize
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { gridX: x, gridZ: z };

    return mesh;
  }

  private addGridLines(): void {
    const halfSize = this.gridSize / 2;
    const material = new THREE.LineBasicMaterial({
      color: EDITOR_GRID_LINES.color,
      opacity: EDITOR_GRID_LINES.opacity,
      transparent: true
    });

    const points: THREE.Vector3[] = [];

    // Vertical lines
    for (let x = 0; x <= this.gridSize; x++) {
      points.push(
        new THREE.Vector3((x - halfSize) * this.tileSize, 0, -halfSize * this.tileSize),
        new THREE.Vector3((x - halfSize) * this.tileSize, 0, halfSize * this.tileSize)
      );
    }

    // Horizontal lines
    for (let z = 0; z <= this.gridSize; z++) {
      points.push(
        new THREE.Vector3(-halfSize * this.tileSize, 0, (z - halfSize) * this.tileSize),
        new THREE.Vector3(halfSize * this.tileSize, 0, (z - halfSize) * this.tileSize)
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.gridLines = new THREE.LineSegments(geometry, material);
    this.gridLines.position.y = EDITOR_GRID_LINES.yOffset;
    this.scene.add(this.gridLines);
  }

  public paintTile(x: number, z: number, type: TerrainType): void {
    if (!this.isValidPosition(x, z)) return;

    const tile = this.tiles[x][z];

    // Performance: Skip if already painted this type
    if (tile.type === type) return;

    tile.type = type;

    // Update material
    const config = TERRAIN_CONFIGS[type];
    const material = tile.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(config.color);
    material.emissive.setHex(config.emissiveColor);
    material.emissiveIntensity = config.emissiveIntensity;
    material.roughness = config.roughness;
    material.metalness = config.metalness;

    // Update buildability based on terrain type
    // Crystal and Abyss are not buildable for tower defense
    this.buildableGrid[x][z] = (type !== TerrainType.CRYSTAL && type !== TerrainType.ABYSS);
  }

  public adjustHeight(x: number, z: number, delta: number): void {
    if (!this.isValidPosition(x, z)) return;

    const oldHeight = this.heightMap[x][z];
    const newHeight = Math.max(EDITOR_HEIGHT.min, Math.min(EDITOR_HEIGHT.max, oldHeight + delta));

    // Performance: Skip if height didn't actually change (already at limit)
    if (oldHeight === newHeight) return;

    // Update height
    this.heightMap[x][z] = newHeight;

    // Smooth with neighbors
    this.smoothNeighbors(x, z);

    // Update meshes
    this.updateTileMesh(x, z);

    // Update neighbor meshes
    const neighbors = this.getNeighbors(x, z);
    neighbors.forEach(([nx, nz]) => {
      this.updateTileMesh(nx, nz);
    });
  }

  /**
   * Set tile height to an absolute value (used for undo/redo)
   */
  public setHeight(x: number, z: number, height: number): void {
    if (!this.isValidPosition(x, z)) return;

    const clampedHeight = Math.max(EDITOR_HEIGHT.min, Math.min(EDITOR_HEIGHT.max, height));

    // Skip if height is already at target
    if (this.heightMap[x][z] === clampedHeight) return;

    // Update height directly
    this.heightMap[x][z] = clampedHeight;

    // Update mesh
    this.updateTileMesh(x, z);
  }

  private smoothNeighbors(x: number, z: number): void {
    const centerHeight = this.heightMap[x][z];
    const neighbors = this.getNeighbors(x, z);

    neighbors.forEach(([nx, nz]) => {
      const neighborHeight = this.heightMap[nx][nz];
      const diff = centerHeight - neighborHeight;

      // Smooth if difference is too large
      if (Math.abs(diff) > EDITOR_HEIGHT.smoothingThreshold) {
        this.heightMap[nx][nz] += diff * EDITOR_HEIGHT.smoothingBlendFactor;
      }
    });
  }

  private getNeighbors(x: number, z: number): [number, number][] {
    const neighbors: [number, number][] = [];
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];

    directions.forEach(([dx, dz]) => {
      const nx = x + dx;
      const nz = z + dz;
      if (this.isValidPosition(nx, nz)) {
        neighbors.push([nx, nz]);
      }
    });

    return neighbors;
  }

  private updateTileMesh(x: number, z: number): void {
    if (!this.isValidPosition(x, z)) return;

    const tile = this.tiles[x][z];
    const height = this.heightMap[x][z];

    // Find index in cache for the old mesh
    const oldMeshIndex = this.meshCache.indexOf(tile.mesh);

    // Remove old mesh and dispose its resources
    this.scene.remove(tile.mesh);
    tile.mesh.geometry.dispose();
    disposeMaterial(tile.mesh.material);

    // Create new mesh with updated height
    const newMesh = this.createTileMesh(x, z, tile.type, height);
    tile.mesh = newMesh;
    tile.height = height;

    // Update cache to maintain performance
    if (oldMeshIndex !== -1) {
      this.meshCache[oldMeshIndex] = newMesh;
    }

    this.scene.add(newMesh);
  }

  private isValidPosition(x: number, z: number): boolean {
    return x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize;
  }

  public getTileMeshes(): THREE.Mesh[] {
    // Performance: Return cached array instead of rebuilding every call
    return this.meshCache;
  }

  public getTileAt(x: number, z: number): TerrainTile | null {
    if (!this.isValidPosition(x, z)) return null;
    return this.tiles[x][z];
  }

  // Tower Defense Foundation Methods — Multi-Spawn/Exit

  /**
   * Toggle a spawn point: adds if not present, removes if already present.
   * Respects MAX_SPAWN_POINTS limit. Returns true if point was added, false if removed.
   */
  public addSpawnPoint(x: number, z: number): boolean {
    if (!this.isValidPosition(x, z)) return false;

    const existingIndex = this.spawnPoints.findIndex(p => p.x === x && p.z === z);
    if (existingIndex !== -1) {
      // Toggle off — remove
      this.spawnPoints.splice(existingIndex, 1);
      // Restore buildability based on terrain type
      const tile = this.tiles[x]?.[z];
      if (tile) {
        this.buildableGrid[x][z] = (tile.type !== TerrainType.CRYSTAL && tile.type !== TerrainType.ABYSS);
      }
      return false;
    }

    // Check limit
    if (this.spawnPoints.length >= MAX_SPAWN_POINTS) return false;

    this.spawnPoints.push({ x, z });
    // Spawn tiles are not buildable
    this.buildableGrid[x][z] = false;
    return true;
  }

  /**
   * Toggle an exit point: adds if not present, removes if already present.
   * Respects MAX_EXIT_POINTS limit. Returns true if point was added, false if removed.
   */
  public addExitPoint(x: number, z: number): boolean {
    if (!this.isValidPosition(x, z)) return false;

    const existingIndex = this.exitPoints.findIndex(p => p.x === x && p.z === z);
    if (existingIndex !== -1) {
      // Toggle off — remove
      this.exitPoints.splice(existingIndex, 1);
      // Restore buildability based on terrain type
      const tile = this.tiles[x]?.[z];
      if (tile) {
        this.buildableGrid[x][z] = (tile.type !== TerrainType.CRYSTAL && tile.type !== TerrainType.ABYSS);
      }
      return false;
    }

    // Check limit
    if (this.exitPoints.length >= MAX_EXIT_POINTS) return false;

    this.exitPoints.push({ x, z });
    // Exit tiles are not buildable
    this.buildableGrid[x][z] = false;
    return true;
  }

  /**
   * Backward-compatible: set a single spawn point (replaces all existing).
   * Used by undo/redo commands that restore a specific spawn point.
   */
  public setSpawnPoint(x: number, z: number): void {
    if (!this.isValidPosition(x, z)) return;
    // Clear buildability on old spawn points
    for (const p of this.spawnPoints) {
      const tile = this.tiles[p.x]?.[p.z];
      if (tile) {
        this.buildableGrid[p.x][p.z] = (tile.type !== TerrainType.CRYSTAL && tile.type !== TerrainType.ABYSS);
      }
    }
    this.spawnPoints = [{ x, z }];
    this.buildableGrid[x][z] = false;
  }

  /**
   * Backward-compatible: set a single exit point (replaces all existing).
   * Used by undo/redo commands that restore a specific exit point.
   */
  public setExitPoint(x: number, z: number): void {
    if (!this.isValidPosition(x, z)) return;
    // Clear buildability on old exit points
    for (const p of this.exitPoints) {
      const tile = this.tiles[p.x]?.[p.z];
      if (tile) {
        this.buildableGrid[p.x][p.z] = (tile.type !== TerrainType.CRYSTAL && tile.type !== TerrainType.ABYSS);
      }
    }
    this.exitPoints = [{ x, z }];
    this.buildableGrid[x][z] = false;
  }

  /** Get the first spawn point, or null. Backward-compatible accessor. */
  public getSpawnPoint(): { x: number, z: number } | null {
    return this.spawnPoints[0] ?? null;
  }

  /** Get the first exit point, or null. Backward-compatible accessor. */
  public getExitPoint(): { x: number, z: number } | null {
    return this.exitPoints[0] ?? null;
  }

  /** Get all spawn points. */
  public getSpawnPoints(): { x: number, z: number }[] {
    return this.spawnPoints;
  }

  /** Get all exit points. */
  public getExitPoints(): { x: number, z: number }[] {
    return this.exitPoints;
  }

  public isBuildable(x: number, z: number): boolean {
    if (!this.isValidPosition(x, z)) return false;
    return this.buildableGrid[x][z];
  }

  // State Management - Export/Import for saving maps

  public exportState(): TerrainGridState {
    // Deep-copy tiles and heightMap so the snapshot is fully detached from live state
    const tiles: TerrainGridState['tiles'] = [];
    const heightMap: number[][] = [];
    for (let x = 0; x < this.gridSize; x++) {
      tiles[x] = [];
      heightMap[x] = [];
      for (let z = 0; z < this.gridSize; z++) {
        tiles[x][z] = this.tiles[x][z].type;
        heightMap[x][z] = this.heightMap[x][z];
      }
    }

    return {
      gridSize: this.gridSize,
      tiles,
      heightMap,
      spawnPoints: this.spawnPoints.map(p => ({ ...p })),
      exitPoints: this.exitPoints.map(p => ({ ...p })),
      version: '2.0.0'
    };
  }

  public importState(state: TerrainGridState | null | undefined): void {
    if (!state || state.gridSize !== this.gridSize) {
      console.error('Invalid state or grid size mismatch');
      return;
    }

    // Import tiles and heights
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        if (state.tiles[x] && state.tiles[x][z] !== undefined) {
          this.paintTile(x, z, state.tiles[x][z]);
        }
        if (state.heightMap[x] && state.heightMap[x][z] !== undefined) {
          this.heightMap[x][z] = state.heightMap[x][z];
          this.updateTileMesh(x, z);
        }
      }
    }

    // Import spawn/exit points — handle both v2 (arrays) and v1 (single point) formats
    const legacy = state as unknown as TerrainGridStateLegacy;

    // Clear existing points first
    this.spawnPoints = [];
    this.exitPoints = [];

    if (state.spawnPoints && Array.isArray(state.spawnPoints)) {
      // v2 format
      for (const p of state.spawnPoints) {
        if (this.isValidPosition(p.x, p.z)) {
          this.spawnPoints.push({ x: p.x, z: p.z });
          this.buildableGrid[p.x][p.z] = false;
        }
      }
    } else if (legacy.spawnPoint) {
      // v1 format — single point
      if (this.isValidPosition(legacy.spawnPoint.x, legacy.spawnPoint.z)) {
        this.spawnPoints.push({ x: legacy.spawnPoint.x, z: legacy.spawnPoint.z });
        this.buildableGrid[legacy.spawnPoint.x][legacy.spawnPoint.z] = false;
      }
    }

    if (state.exitPoints && Array.isArray(state.exitPoints)) {
      // v2 format
      for (const p of state.exitPoints) {
        if (this.isValidPosition(p.x, p.z)) {
          this.exitPoints.push({ x: p.x, z: p.z });
          this.buildableGrid[p.x][p.z] = false;
        }
      }
    } else if (legacy.exitPoint) {
      // v1 format — single point
      if (this.isValidPosition(legacy.exitPoint.x, legacy.exitPoint.z)) {
        this.exitPoints.push({ x: legacy.exitPoint.x, z: legacy.exitPoint.z });
        this.buildableGrid[legacy.exitPoint.x][legacy.exitPoint.z] = false;
      }
    }
  }

  public dispose(): void {
    // Clean up all meshes
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const tile = this.tiles[x][z];
        this.scene.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        disposeMaterial(tile.mesh.material);
      }
    }

    // Clean up grid lines
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      disposeMaterial(this.gridLines.material);
    }

    // Clear caches
    this.meshCache = [];
  }
}
