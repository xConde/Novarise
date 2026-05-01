import * as THREE from 'three';
import { BlockType } from '../models/game-board-tile';

/**
 * Wraps a single `THREE.InstancedMesh` representing every tile of one
 * `BlockType` on the board. Handles matrix population, per-instance
 * color (for highlights), coordinate lookups, and disposal.
 *
 * Sprint 21 ships this as a standalone class with full unit-test
 * coverage. Sprints 22+ wire it into BoardMeshRegistryService,
 * BoardPointerService, and TileHighlightService.
 *
 * Design rationale lives in
 * `docs/threejs-polish/phase-c-instanced-tiles-spike.md`.
 *
 * Disposal contract:
 *   - Caller owns the geometry + material lifecycle. They typically come
 *     from GeometryRegistry / MaterialRegistry and are NOT disposed by
 *     this layer.
 *   - The InstancedMesh itself IS disposed on `.dispose()`.
 */
export class TileInstanceLayer {
  readonly blockType: BlockType;
  readonly mesh: THREE.InstancedMesh;

  /** instanceId -> { row, col }. Same length as instance count. */
  private readonly indexToCoord: Array<{ row: number; col: number }>;

  /** "row-col" -> instanceId. */
  private readonly coordToIndex: Map<string, number>;

  /** Reusable scratch matrix to avoid allocation in setMatrixAt. */
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchPosition = new THREE.Vector3();
  private readonly scratchScale = new THREE.Vector3(1, 1, 1);
  private readonly scratchQuaternion = new THREE.Quaternion();

  /** X/Y/Z position originally assigned at construction, per instance. */
  private readonly basePos: Array<{ x: number; y: number; z: number }>;

  /** Indices that have been hidden via hideAt — excluded from raycast resolution. */
  private readonly hiddenIndices = new Set<number>();

  constructor(
    blockType: BlockType,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    instances: ReadonlyArray<{
      row: number;
      col: number;
      worldX: number;
      worldZ: number;
      worldY: number;
    }>,
  ) {
    this.blockType = blockType;
    const count = instances.length;
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Phase C sprint 27: tiles are flat ground — they don't meaningfully
    // self-shadow each other and shadow-casting them roughly halves the
    // shadow-map draw count on a 14×14+ board. Cliffs (separate per-mesh)
    // keep castShadow=true; towers and enemies likewise. Tiles only
    // RECEIVE shadows from those casters.
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.userData['blockType'] = blockType;

    this.indexToCoord = [];
    this.coordToIndex = new Map();
    this.basePos = [];

    for (let i = 0; i < count; i++) {
      const inst = instances[i];
      this.scratchPosition.set(inst.worldX, inst.worldY, inst.worldZ);
      this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
      this.mesh.setMatrixAt(i, this.scratchMatrix);
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
      this.indexToCoord.push({ row: inst.row, col: inst.col });
      this.coordToIndex.set(this.coordKey(inst.row, inst.col), i);
      this.basePos.push({ x: inst.worldX, y: inst.worldY, z: inst.worldZ });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Number of instances. */
  get count(): number {
    return this.indexToCoord.length;
  }

  /**
   * Resolve a raycaster `intersection.instanceId` to its (row, col).
   * Hidden instances (via hideAt) return null — sprint 24 mutation
   * overlay tiles must not raycast onto the hidden BASE slot underneath.
   */
  lookupCoord(instanceId: number): { row: number; col: number } | null {
    if (this.hiddenIndices.has(instanceId)) return null;
    return this.indexToCoord[instanceId] ?? null;
  }

  /** Find the instance index for a (row, col), or -1 if not present in this layer. */
  findIndex(row: number, col: number): number {
    const idx = this.coordToIndex.get(this.coordKey(row, col));
    return idx ?? -1;
  }

  /**
   * Set the per-instance color for the tile at (row, col).
   * The color multiplies with the material's base color in the shader.
   * Returns false if the tile is not in this layer.
   */
  setColorAt(row: number, col: number, color: THREE.Color): boolean {
    const idx = this.findIndex(row, col);
    if (idx < 0) return false;
    this.mesh.setColorAt(idx, color);
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
    return true;
  }

  /** Reset the per-instance color to identity (1, 1, 1). */
  resetColorAt(row: number, col: number): boolean {
    return this.setColorAt(row, col, new THREE.Color(1, 1, 1));
  }

  /** Read the current per-instance color. Returns null if not present. */
  getColorAt(row: number, col: number): THREE.Color | null {
    const idx = this.findIndex(row, col);
    if (idx < 0) return null;
    const out = new THREE.Color();
    this.mesh.getColorAt(idx, out);
    return out;
  }

  /**
   * Translate the Y position of the tile at (row, col) without touching X/Z.
   * Used by ElevationService when a tile is raised/lowered (sprint 25).
   *
   * Also updates `basePos[idx].y` so a subsequent showAt (e.g. mutation
   * expiry on a previously-elevated tile) restores to the elevated Y, not
   * the construction-time ground Y. Without this, "elevate → mutate →
   * mutation expires" snaps the tile back to ground level even though
   * the elevation is still active in board state.
   */
  setElevationAt(row: number, col: number, newY: number): boolean {
    const idx = this.findIndex(row, col);
    if (idx < 0) return false;
    this.mesh.getMatrixAt(idx, this.scratchMatrix);
    this.scratchMatrix.decompose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    this.scratchPosition.y = newY;
    this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    this.mesh.setMatrixAt(idx, this.scratchMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.basePos[idx].y = newY;
    return true;
  }

  /**
   * Move an instance to an "off-screen" position (very far Y). Used by
   * sprint 24 when a tile mutates to a TerraformPool-managed type and
   * the slot needs to be visually removed without resizing the
   * InstancedMesh count.
   */
  hideAt(row: number, col: number): boolean {
    const idx = this.findIndex(row, col);
    if (idx < 0) return false;
    this.mesh.getMatrixAt(idx, this.scratchMatrix);
    this.scratchMatrix.decompose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    // Scale to zero — collapses the bounding box of this instance to a
    // point at its position so it cannot be raycast hit. Translating to
    // Y=-1e6 worked visually but expanded the InstancedMesh bounding
    // sphere enormously, forcing per-instance ray tests on every mouse
    // move (red-team finding HIGH).
    this.scratchScale.set(0, 0, 0);
    this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    this.mesh.setMatrixAt(idx, this.scratchMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.hiddenIndices.add(idx);
    // Reset scratchScale for downstream mutations.
    this.scratchScale.set(1, 1, 1);
    return true;
  }

  /**
   * Restore an instance's full base transform (position + unit scale + identity
   * rotation). Inverse of hideAt or a revert from setElevationAt.
   *
   * NOTE: cannot decompose the current matrix when scale is (0,0,0) because
   * decompose divides by scale and produces NaN positions. We reconstruct
   * the base transform from `basePos` directly.
   */
  showAt(row: number, col: number): boolean {
    const idx = this.findIndex(row, col);
    if (idx < 0) return false;
    const base = this.basePos[idx];
    this.scratchPosition.set(base.x, base.y, base.z);
    this.scratchQuaternion.set(0, 0, 0, 1);
    this.scratchScale.set(1, 1, 1);
    this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.scratchScale);
    this.mesh.setMatrixAt(idx, this.scratchMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.hiddenIndices.delete(idx);
    return true;
  }

  /**
   * Dispose the InstancedMesh and detach from its parent if attached.
   * Geometry + material are NOT disposed (registry-owned).
   */
  dispose(scene?: THREE.Scene): void {
    if (scene) {
      scene.remove(this.mesh);
    } else if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.mesh.dispose();
  }

  private coordKey(row: number, col: number): string {
    return `${row}-${col}`;
  }
}
