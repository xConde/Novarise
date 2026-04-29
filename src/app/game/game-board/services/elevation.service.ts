import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';

import { GameBoardService } from '../game-board.service';
import { isInBounds } from '../utils/coordinate-utils';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { BlockType } from '../models/game-board-tile';
import { BOARD_CONFIG } from '../constants/board.constants';
import { ELEVATION_CONFIG } from '../constants/elevation.constants';
import {
  ElevationChange,
  ElevationOp,
  ElevationRejectionReason,
  ElevationResult,
  SerializableTileElevationState,
} from './elevation.types';
import { SceneService } from './scene.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { gridToWorld } from '../utils/coordinate-utils';

/**
 * Runtime tile elevation service for the Highground archetype.
 *
 * Owns a per-tile journal of active elevation changes, handles expiry on turn-end,
 * and provides serialize/restore for the encounter checkpoint lifecycle (v9).
 *
 * ## Key design decisions (elevation-model.md §4)
 * - Peer to PathMutationService — NOT a fourth MutationOp.
 * - Elevation NEVER invalidates the pathfinding cache (§11).
 * - Mesh Y is translated in-place (no disposal, no rebuild).
 * - One elevation change per (row, col) per turn (anti-spam, mirrors PathMutationService).
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered in GameModule providers alongside GameBoardService and PathMutationService.
 */
@Injectable()
export class ElevationService {
  /** Ordered journal of all currently active elevation changes. */
  private journal: ElevationChange[] = [];

  /** Monotonically-increasing ID counter (reset on restore). */
  private nextId = 0;

  constructor(
    private readonly gameBoardService: GameBoardService,
    private readonly registry: BoardMeshRegistryService,
    /**
     * @Optional() — SceneService is not registered in ElevationService test beds.
     * When absent, cliff mesh creation/removal is skipped gracefully (test contexts
     * have no WebGL scene to attach meshes to).
     */
    @Optional() private readonly sceneService?: SceneService,
    /**
     * @Optional() — TerraformMaterialPoolService is not registered in all test beds.
     * When absent, cliff mesh creation is skipped (no material → no mesh).
     */
    @Optional() private readonly terraformPool?: TerraformMaterialPoolService,
    /**
     * @Optional() — GeometryRegistryService is not registered in all test beds.
     * Production wires it via GameBoardComponent.providers (sprint 12).
     */
    @Optional() private readonly geometryRegistry?: GeometryRegistryService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Apply — public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Raise a tile's elevation by `amount`.
   * Duration null = permanent; positive integer = expires on turn (appliedOnTurn + duration).
   */
  raise(
    row: number,
    col: number,
    amount: number,
    duration: number | null,
    sourceId: string,
    currentTurn: number,
    source: 'card' | 'relic' = 'card',
  ): ElevationResult {
    const priorElevation = this.getElevation(row, col);
    const newElevation = priorElevation + amount;
    return this.applyElevation('raise', row, col, newElevation, priorElevation, amount, duration, sourceId, currentTurn, source);
  }

  /**
   * Depress a tile's elevation by `amount` (downward).
   * Duration null = permanent; positive integer = expires on turn (appliedOnTurn + duration).
   */
  depress(
    row: number,
    col: number,
    amount: number,
    duration: number | null,
    sourceId: string,
    currentTurn: number,
    source: 'card' | 'relic' = 'card',
  ): ElevationResult {
    const priorElevation = this.getElevation(row, col);
    const newElevation = priorElevation - amount;
    return this.applyElevation('depress', row, col, newElevation, priorElevation, amount, duration, sourceId, currentTurn, source);
  }

  /**
   * Set absolute elevation (permanent only — relics and preset board configurations).
   * No duration parameter — use raise/depress with duration for timed ops.
   */
  setAbsolute(
    row: number,
    col: number,
    value: number,
    sourceId: string,
    currentTurn: number,
    source: 'card' | 'relic' = 'relic',
  ): ElevationResult {
    const priorElevation = this.getElevation(row, col);
    return this.applyElevation('set', row, col, value, priorElevation, value, null, sourceId, currentTurn, source);
  }

  /**
   * Collapse a tile's elevation to 0 in a single one-shot op.
   * Returns the prior elevation in `change.priorElevation` for damage math
   * (AVALANCHE_ORDER deals damage proportional to the elevation lost).
   */
  collapse(
    row: number,
    col: number,
    sourceId: string,
    currentTurn: number,
    source: 'card' | 'relic' = 'card',
  ): ElevationResult {
    const priorElevation = this.getElevation(row, col);
    return this.applyElevation('collapse', row, col, 0, priorElevation, 0, null, sourceId, currentTurn, source);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Current elevation for (row, col). Returns 0 if undefined (never elevated).
   */
  getElevation(row: number, col: number): number {
    const board = this.gameBoardService.getGameBoard();
    return board[row]?.[col]?.elevation ?? 0;
  }

  /**
   * Maximum elevation across all tiles on the board.
   * Returns 0 if no tiles are elevated (safe default for KING_OF_THE_HILL reads).
   */
  getMaxElevation(): number {
    const board = this.gameBoardService.getGameBoard();
    let max = 0;
    for (const row of board) {
      for (const tile of row) {
        const e = tile.elevation ?? 0;
        if (e > max) max = e;
      }
    }
    return max;
  }

  /**
   * Sparse elevation map — only non-zero cells. Key format: `"row-col"`.
   * Authoritative: reads directly from the board, not the journal.
   */
  getElevationMap(): ReadonlyMap<string, number> {
    const board = this.gameBoardService.getGameBoard();
    const result = new Map<string, number>();
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const e = board[r][c]?.elevation ?? 0;
        if (e !== 0) {
          result.set(`${r}-${c}`, e);
        }
      }
    }
    return result;
  }

  /** Read-only snapshot of the active journal (for inspection / debug). */
  getActiveChanges(): readonly ElevationChange[] {
    return [...this.journal];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Expire any elevation changes whose expiresOnTurn equals `currentTurn`.
   *
   * ORDERING: called in CombatLoopService.resolveTurn() immediately after
   * pathMutationService.tickTurn(), before step 1 (spawn). Elevation expiry
   * does NOT invalidate the pathfinding cache (spike §11).
   */
  tickTurn(currentTurn: number): void {
    const expiring = this.journal.filter(c => c.expiresOnTurn === currentTurn);

    for (const change of expiring) {
      this.revertChange(change);
    }

    this.journal = this.journal.filter(c => c.expiresOnTurn !== currentTurn);
  }

  /**
   * Full clear — called on encounter teardown / abandon / victory / defeat.
   * Disposes all cliff meshes (geometry only — material is pool-owned and
   * will be disposed by TerraformMaterialPoolService.dispose() separately).
   */
  reset(): void {
    const scene = this.sceneService?.getScene();
    // Guard: cliffMeshes may be undefined in lightweight test beds that inject a
    // spy-only BoardMeshRegistryService without the cliff map property.
    this.registry.cliffMeshes?.forEach(cliffMesh => {
      scene?.remove(cliffMesh);
      cliffMesh.geometry.dispose();
      // Material is pool-owned — DO NOT dispose here.
    });
    this.registry.cliffMeshes?.clear();
    this.journal = [];
    this.nextId = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────────────────────────────────

  serialize(): SerializableTileElevationState {
    // Sparse: only non-zero tiles
    const elevations: { row: number; col: number; value: number }[] = [];
    const board = this.gameBoardService.getGameBoard();
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        const e = board[r][c]?.elevation ?? 0;
        if (e !== 0) {
          elevations.push({ row: r, col: c, value: e });
        }
      }
    }
    return {
      elevations,
      changes: [...this.journal],
      nextId: this.nextId,
    };
  }

  /**
   * Restore journal + nextId from a checkpoint snapshot.
   *
   * Does NOT replay tile-data or mesh translations — GameBoardComponent.restoreFromCheckpoint()
   * handles those in Step 3.6 after calling this method (same pattern as PathMutationService).
   */
  restore(snapshot: SerializableTileElevationState): void {
    this.journal = [...snapshot.changes];
    this.nextId = snapshot.nextId;
  }

  /**
   * Recreate cliff meshes for all tiles with non-zero elevation in the given sparse list.
   *
   * Called by GameBoardComponent.restoreFromCheckpoint() (Step 3.6) AFTER both
   * `elevationService.restore()` and the tile-data / mesh-translation loop. This is
   * necessary because cliff meshes are NOT serialized — they are purely visual and are
   * derived from the per-tile elevation values. Restoring journal + tile data alone
   * leaves no cliffs visible; this method recreates them from the elevation list.
   *
   * @param elevations Sparse list of {row, col, value} entries from the checkpoint.
   *   Only positive-elevation tiles are processed (depression = no cliff).
   */
  restoreCliffMeshes(elevations: readonly { row: number; col: number; value: number }[]): void {
    for (const entry of elevations) {
      if (entry.value > 0) {
        // Treat priorElevation=0 so updateCliffMesh creates a new cliff
        this.updateCliffMesh(entry.row, entry.col, 0, entry.value);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────────────

  private applyElevation(
    op: ElevationOp,
    row: number,
    col: number,
    newElevation: number,
    priorElevation: number,
    deltaOrAbsolute: number,
    duration: number | null,
    sourceId: string,
    currentTurn: number,
    source: 'card' | 'relic',
  ): ElevationResult {
    // ── Validation ──────────────────────────────────────────────────────────

    const rejection = this.validate(op, row, col, newElevation, currentTurn);
    if (rejection) {
      return { ok: false, reason: rejection };
    }

    // ── Tile mutation ────────────────────────────────────────────────────────

    const newTile = this.gameBoardService.setTileElevation(row, col, newElevation);
    if (!newTile) {
      // setTileElevation returned null — defensive: spawner or exit (validate already checked)
      return { ok: false, reason: 'spawner-or-exit' };
    }

    // ── Mesh translation (Y-only, no disposal) ───────────────────────────────

    const newTileY = newElevation + BOARD_CONFIG.tileHeight / 2;
    this.registry.translateTileMesh(row, col, newTileY);

    // Translate tower if one sits on this tile
    if (newTile.towerType !== null) {
      const newTowerY = newElevation + BOARD_CONFIG.tileHeight;
      this.registry.translateTowerMesh(row, col, newTowerY);
    }

    // ── Cliff column mesh management (sprint 39 Highground polish) ────────────
    // DEPRESSED tiles (elevation < 0) never get a cliff — depression is a hole.
    // Spawner/exit tiles are already rejected above — no cliff is possible.
    this.updateCliffMesh(row, col, priorElevation, newElevation);

    // ── CRITICAL: do NOT invalidate pathfinding cache (spike §11) ───────────

    // ── Journal entry ────────────────────────────────────────────────────────

    const change: ElevationChange = {
      id: String(this.nextId++),
      op,
      row,
      col,
      appliedOnTurn: currentTurn,
      expiresOnTurn: duration !== null ? currentTurn + duration : null,
      priorElevation,
      deltaOrAbsolute,
      source,
      sourceId,
    };
    this.journal.push(change);

    return { ok: true, change, newElevation };
  }

  private validate(
    op: ElevationOp,
    row: number,
    col: number,
    newElevation: number,
    currentTurn: number,
  ): ElevationRejectionReason | null {
    const boardHeight = this.gameBoardService.getBoardHeight();
    const boardWidth = this.gameBoardService.getBoardWidth();

    // Bounds
    if (!isInBounds(row, col, boardHeight, boardWidth)) {
      return 'out-of-bounds';
    }

    const board = this.gameBoardService.getGameBoard();
    const tile = board[row][col];

    // Spawner / exit immutability
    if (tile.type === BlockType.SPAWNER || tile.type === BlockType.EXIT) {
      return 'spawner-or-exit';
    }

    // Range: [-MAX_DEPRESS, +MAX_ELEVATION]
    if (newElevation < -ELEVATION_CONFIG.MAX_DEPRESS || newElevation > ELEVATION_CONFIG.MAX_ELEVATION) {
      return 'out-of-range';
    }

    // Anti-spam: one change per (row, col) per turn
    const alreadyChangedThisTurn = this.journal.some(
      c => c.row === row && c.col === col && c.appliedOnTurn === currentTurn,
    );
    if (alreadyChangedThisTurn) {
      return 'already-changed-this-turn';
    }

    // No-op: newElevation equals current elevation
    const priorElevation = tile.elevation ?? 0;
    if (newElevation === priorElevation) {
      return 'no-op';
    }

    return null;
  }

  private revertChange(change: ElevationChange): void {
    // Safety: never revert spawner/exit (should never appear in journal, but defend)
    const board = this.gameBoardService.getGameBoard();
    const tile = board[change.row]?.[change.col];
    if (!tile) return;
    if (tile.type === BlockType.SPAWNER || tile.type === BlockType.EXIT) {
      console.warn(
        `ElevationService: attempted to revert change ${change.id} on ` +
        `${tile.type} tile at (${change.row}, ${change.col}) — skipping.`,
      );
      return;
    }

    // Read current elevation BEFORE revert to know the transition direction
    const currentElevation = this.getElevation(change.row, change.col);

    // Revert tile data
    this.gameBoardService.setTileElevation(change.row, change.col, change.priorElevation);

    // Translate meshes back
    const revertTileY = change.priorElevation + BOARD_CONFIG.tileHeight / 2;
    this.registry.translateTileMesh(change.row, change.col, revertTileY);

    const revertedTile = this.gameBoardService.getGameBoard()[change.row]?.[change.col];
    if (revertedTile?.towerType !== null && revertedTile?.towerType !== undefined) {
      const revertTowerY = change.priorElevation + BOARD_CONFIG.tileHeight;
      this.registry.translateTowerMesh(change.row, change.col, revertTowerY);
    }

    // Cliff column mesh management on revert (sprint 39)
    this.updateCliffMesh(change.row, change.col, currentElevation, change.priorElevation);

    // CRITICAL: do NOT invalidate pathfinding cache (spike §11)
  }

  /**
   * Manage the cliff column mesh for a tile transitioning from `priorElevation` to
   * `newElevation` (sprint 39 Highground polish — elevation-model.md §8 "Option B").
   *
   * Rules:
   *  - newElevation > 0, priorElevation === 0 → CREATE cliff mesh.
   *  - newElevation > 0, priorElevation > 0   → RESIZE cliff (dispose old geometry,
   *                                             create new geometry; material stays pooled).
   *  - newElevation === 0, priorElevation > 0  → REMOVE and geometry-dispose cliff mesh.
   *  - newElevation < 0 (DEPRESSED)            → no cliff; depression is a hole.
   *
   * The tile mesh is centered at newY = newElevation + tileHeight/2, so the cliff
   * must extend from Y=0 up to the BOTTOM of the tile top surface at Y=newElevation.
   * We position the cliff box at Y=newElevation/2 with height=newElevation.
   *
   * @param row         Tile row index.
   * @param col         Tile column index.
   * @param priorElevation Elevation before this change.
   * @param newElevation   Elevation after this change.
   */
  private updateCliffMesh(
    row: number,
    col: number,
    priorElevation: number,
    newElevation: number,
  ): void {
    // Only support cliff meshes when the full scene/pool DI stack is available.
    if (!this.sceneService || !this.terraformPool) return;
    const scene = this.sceneService.getScene();
    if (!scene) return;

    // DEPRESSED tiles (elevation < 0) never get a cliff.
    if (newElevation < 0) return;

    const key = `${row}-${col}`;
    const existingCliff = this.registry.cliffMeshes.get(key);
    const tileSize = BOARD_CONFIG.tileSize;

    if (newElevation === 0) {
      // ── Remove cliff (elevation returned to ground level) ──────────────────
      if (existingCliff) {
        scene.remove(existingCliff);
        existingCliff.geometry.dispose();
        // Material is pool-owned — DO NOT dispose.
        this.registry.cliffMeshes.delete(key);
      }
      return;
    }

    // newElevation > 0 — need a cliff.
    const cliffHeight = newElevation; // extends from Y=0 to Y=newElevation
    const cliffMaterial = this.terraformPool.getCliffMaterial();

    if (existingCliff) {
      // ── Resize existing cliff (elevation changed while remaining > 0) ───────
      // Skip dispose if old geometry is registry-owned (sprint 12) — tiles
      // at the same elevation tier share it.
      if (!this.geometryRegistry?.isRegisteredGeometry(existingCliff.geometry)) {
        existingCliff.geometry.dispose();
      }
      existingCliff.geometry = this.geometryRegistry
        ? this.geometryRegistry.getBox(tileSize, cliffHeight, tileSize)
        : new THREE.BoxGeometry(tileSize, cliffHeight, tileSize);
      existingCliff.position.y = cliffHeight / 2;
    } else {
      // ── Create new cliff ─────────────────────────────────────────────────────
      const cliffGeometry = this.geometryRegistry
        ? this.geometryRegistry.getBox(tileSize, cliffHeight, tileSize)
        : new THREE.BoxGeometry(tileSize, cliffHeight, tileSize);
      const cliffMesh = new THREE.Mesh(cliffGeometry, cliffMaterial);

      // Position at tile world XZ center; Y centered at half the cliff height.
      const boardWidth = this.gameBoardService.getBoardWidth();
      const boardHeight = this.gameBoardService.getBoardHeight();
      const { x: cliffWorldX, z: cliffWorldZ } = gridToWorld(row, col, boardWidth, boardHeight, tileSize);
      cliffMesh.position.set(
        cliffWorldX,
        cliffHeight / 2,
        cliffWorldZ,
      );
      cliffMesh.receiveShadow = true;

      scene.add(cliffMesh);
      this.registry.cliffMeshes.set(key, cliffMesh);
    }
  }
}
