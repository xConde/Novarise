import { Injectable } from '@angular/core';
import { MINIMAP_CONFIG } from '../constants/minimap.constants';
import { MinimapEntityData, MinimapTerrainData } from '../models/minimap.model';
import { BlockType } from '../models/game-board-tile';

export { MinimapEntityData, MinimapTerrainData } from '../models/minimap.model';

/** Minimal board data needed to build the static minimap terrain cache. */
export interface MinimapBoardSnapshot {
  boardWidth: number;
  boardHeight: number;
  /** `[row, col]` pairs for all spawner tiles. */
  spawnerTiles: number[][];
  /** `[row, col]` pairs for all exit tiles. */
  exitTiles: number[][];
  /** Returns the tile type for the given (row, col), or undefined if out-of-bounds. */
  getTileType: (row: number, col: number) => BlockType | undefined;
}

/** Row/col grid position of an entity — subset of PlacedTower and Enemy. */
export interface MinimapGridPosition {
  row: number;
  col: number;
}

@Injectable()
export class MinimapService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private visible = false;
  private lastUpdateTime = 0;
  /** Cached static terrain data — built once after board setup, cleared on cleanup. */
  private cachedTerrain: MinimapTerrainData | null = null;
  /** Reusable entity list — avoids per-frame array allocation in updateWithEntities(). */
  private readonly entityBuffer: MinimapEntityData[] = [];

  /**
   * Creates the minimap canvas and appends it to the given container.
   */
  init(container: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_CONFIG.canvasSize;
    this.canvas.height = MINIMAP_CONFIG.canvasSize;
    this.canvas.className = 'game-minimap';
    this.canvas.style.opacity = this.visible ? '1' : '0';
    if (!this.visible) {
      this.canvas.style.display = 'none';
    }

    // Mobile: smaller canvas
    if (window.innerWidth <= 480) {
      this.canvas.width = 60;
      this.canvas.height = 60;
    }

    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
  }

  /**
   * Renders the minimap with current game state.
   * Throttled to MINIMAP_CONFIG.updateIntervalMs to avoid excessive redraws.
   */
  update(
    timeMs: number,
    terrain: MinimapTerrainData,
    entities: MinimapEntityData[]
  ): void {
    const gridWidth = terrain.gridWidth ?? terrain.gridSize ?? 0;
    const gridHeight = terrain.gridHeight ?? terrain.gridSize ?? 0;
    if (!this.ctx || !this.canvas || !this.visible || gridWidth <= 0 || gridHeight <= 0) {
      return;
    }

    if (timeMs - this.lastUpdateTime < MINIMAP_CONFIG.updateIntervalMs) {
      return;
    }
    this.lastUpdateTime = timeMs;

    const size = this.canvas.width; // Use actual canvas size (60 on mobile, 150 on desktop)
    const cellW = size / gridWidth;
    const cellH = size / gridHeight;

    // Background
    this.ctx.fillStyle = MINIMAP_CONFIG.backgroundColor;
    this.ctx.fillRect(0, 0, size, size);

    // Terrain grid — use gridHeight for rows, gridWidth for cols
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        this.ctx.fillStyle = terrain.isPath(row, col)
          ? MINIMAP_CONFIG.terrainColors.path
          : MINIMAP_CONFIG.terrainColors.buildable;
        this.ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      }
    }

    // Spawn points
    const spawnPts = terrain.spawnPoints ?? (terrain.spawnPoint ? [terrain.spawnPoint] : []);
    for (const sp of spawnPts) {
      this.ctx.fillStyle = MINIMAP_CONFIG.terrainColors.spawn;
      this.ctx.fillRect(sp.x * cellW, sp.z * cellH, cellW, cellH);
    }

    // Exit points
    const exitPts = terrain.exitPoints ?? (terrain.exitPoint ? [terrain.exitPoint] : []);
    for (const ep of exitPts) {
      this.ctx.fillStyle = MINIMAP_CONFIG.terrainColors.exit;
      this.ctx.fillRect(ep.x * cellW, ep.z * cellH, cellW, cellH);
    }

    // Entities — use cellW for x, cellH for z
    for (const entity of entities) {
      const dotSize = entity.type === 'tower'
        ? MINIMAP_CONFIG.towerDotSize
        : MINIMAP_CONFIG.entityDotSize;
      const color = entity.type === 'tower'
        ? MINIMAP_CONFIG.terrainColors.tower
        : MINIMAP_CONFIG.terrainColors.enemy;

      this.ctx.fillStyle = color;
      const px = entity.x * cellW + cellW / 2;
      const pz = entity.z * cellH + cellH / 2;
      this.ctx.beginPath();
      this.ctx.arc(px, pz, dotSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  show(): void {
    this.visible = true;
    if (this.canvas) {
      // Make element present first so transition plays
      this.canvas.style.display = '';
      // Defer to next tick so the display change is painted before opacity transitions
      requestAnimationFrame(() => {
        if (this.canvas) this.canvas.style.opacity = '1';
      });
    }
  }

  hide(): void {
    this.visible = false;
    if (this.canvas) {
      // Instant hide — no transition needed
      this.canvas.style.display = 'none';
      this.canvas.style.opacity = '0';
    }
  }

  toggleVisibility(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Dims the minimap to indicate a non-live (paused) state.
   * Uses `MINIMAP_CONFIG.pausedOpacity` when dimmed.
   */
  setDimmed(dimmed: boolean): void {
    if (this.canvas && this.visible) {
      this.canvas.style.opacity = dimmed ? String(MINIMAP_CONFIG.pausedOpacity) : '1';
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Build and cache static minimap terrain data from the current board state.
   * Returns the built terrain so the caller can also store a reference if needed.
   * Call after board import; the cache is invalidated by cleanup().
   */
  buildTerrainCache(snapshot: MinimapBoardSnapshot): MinimapTerrainData {
    this.cachedTerrain = {
      gridWidth: snapshot.boardWidth,
      gridHeight: snapshot.boardHeight,
      isPath: (row: number, col: number) => {
        const type = snapshot.getTileType(row, col);
        return type !== undefined && type !== BlockType.WALL;
      },
      spawnPoints: snapshot.spawnerTiles.map(([row, col]) => ({ x: col, z: row })),
      exitPoints: snapshot.exitTiles.map(([row, col]) => ({ x: col, z: row })),
    };
    return this.cachedTerrain;
  }

  /** Returns the cached terrain, or null if buildTerrainCache() has not been called. */
  getCachedTerrain(): MinimapTerrainData | null {
    return this.cachedTerrain;
  }

  /**
   * Update the minimap using pre-built tower and enemy position arrays.
   * Renders immediately using the cached terrain built by buildTerrainCache().
   * No-op if the terrain cache has not been built yet.
   *
   * @param timeMs       Current animation timestamp (milliseconds).
   * @param towerPositions  Row/col grid positions of all placed towers.
   * @param enemyPositions  Row/col grid positions of all live enemies.
   */
  updateWithEntities(
    timeMs: number,
    towerPositions: readonly MinimapGridPosition[],
    enemyPositions: readonly MinimapGridPosition[],
  ): void {
    if (!this.cachedTerrain) return;

    this.entityBuffer.length = 0;
    for (const pos of towerPositions) {
      this.entityBuffer.push({ x: pos.col, z: pos.row, type: 'tower' });
    }
    for (const pos of enemyPositions) {
      this.entityBuffer.push({ x: pos.col, z: pos.row, type: 'enemy' });
    }

    this.update(timeMs, this.cachedTerrain, this.entityBuffer);
  }

  cleanup(): void {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.visible = false;
    this.lastUpdateTime = 0;
    this.cachedTerrain = null;
    this.entityBuffer.length = 0;
  }
}
