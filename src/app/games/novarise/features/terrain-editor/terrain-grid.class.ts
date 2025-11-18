import * as THREE from 'three';
import { TerrainType, TERRAIN_CONFIGS } from '../../models/terrain-types.enum';

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

      for (let z = 0; z < this.gridSize; z++) {
        // Initialize height to 0
        this.heightMap[x][z] = 0;

        // Create tile mesh
        const mesh = this.createTileMesh(x, z, TerrainType.BEDROCK, 0);
        this.tiles[x][z] = {
          type: TerrainType.BEDROCK,
          height: 0,
          mesh: mesh
        };

        this.scene.add(mesh);
      }
    }

    // Add grid lines
    this.addGridLines();
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
      color: 0x3a2a4a,
      opacity: 0.3,
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
    const gridLines = new THREE.LineSegments(geometry, material);
    gridLines.position.y = 0.01;
    this.scene.add(gridLines);
  }

  public paintTile(x: number, z: number, type: TerrainType): void {
    if (!this.isValidPosition(x, z)) return;

    const tile = this.tiles[x][z];
    tile.type = type;

    // Update material
    const config = TERRAIN_CONFIGS[type];
    const material = tile.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(config.color);
    material.emissive.setHex(config.emissiveColor);
    material.emissiveIntensity = config.emissiveIntensity;
    material.roughness = config.roughness;
    material.metalness = config.metalness;
  }

  public adjustHeight(x: number, z: number, delta: number): void {
    if (!this.isValidPosition(x, z)) return;

    // Update height
    this.heightMap[x][z] = Math.max(0, Math.min(5, this.heightMap[x][z] + delta));

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

  private smoothNeighbors(x: number, z: number): void {
    const centerHeight = this.heightMap[x][z];
    const neighbors = this.getNeighbors(x, z);

    neighbors.forEach(([nx, nz]) => {
      const neighborHeight = this.heightMap[nx][nz];
      const diff = centerHeight - neighborHeight;

      // Smooth if difference is too large
      if (Math.abs(diff) > 0.5) {
        this.heightMap[nx][nz] += diff * 0.3;
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

    // Remove old mesh
    this.scene.remove(tile.mesh);
    tile.mesh.geometry.dispose();

    // Create new mesh with updated height
    const newMesh = this.createTileMesh(x, z, tile.type, height);
    tile.mesh = newMesh;
    tile.height = height;

    this.scene.add(newMesh);
  }

  private isValidPosition(x: number, z: number): boolean {
    return x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize;
  }

  public getTileMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        meshes.push(this.tiles[x][z].mesh);
      }
    }
    return meshes;
  }

  public getTileAt(x: number, z: number): TerrainTile | null {
    if (!this.isValidPosition(x, z)) return null;
    return this.tiles[x][z];
  }

  public dispose(): void {
    // Clean up all meshes
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const tile = this.tiles[x][z];
        this.scene.remove(tile.mesh);
        tile.mesh.geometry.dispose();
        (tile.mesh.material as THREE.Material).dispose();
      }
    }
  }
}
