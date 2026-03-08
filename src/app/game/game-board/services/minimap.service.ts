import { Injectable } from '@angular/core';
import { MINIMAP_CONFIG } from '../constants/minimap.constants';

export interface MinimapEntityData {
  x: number;
  z: number;
  type: 'tower' | 'enemy';
}

export interface MinimapTerrainData {
  gridWidth: number;
  gridHeight: number;
  /** @deprecated Use gridWidth/gridHeight */
  gridSize?: number;
  isPath: (row: number, col: number) => boolean;
  spawnPoints?: { x: number; z: number }[];
  exitPoints?: { x: number; z: number }[];
  /** @deprecated Use spawnPoints. Kept for backward compat. */
  spawnPoint?: { x: number; z: number };
  /** @deprecated Use exitPoints. Kept for backward compat. */
  exitPoint?: { x: number; z: number };
}

/** CSS class applied to the minimap canvas for responsive positioning via stylesheet. */
const MINIMAP_CSS_CLASS = 'minimap-canvas';

@Injectable()
export class MinimapService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private visible = false;
  private lastUpdateTime = 0;

  /**
   * Creates the minimap canvas and appends it to the given container.
   * Positioning and responsive sizing are handled by CSS (.minimap-canvas class
   * in styles.css) so that media queries reliably control mobile layout.
   */
  init(container: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_CONFIG.canvasSize;
    this.canvas.height = MINIMAP_CONFIG.canvasSize;
    this.canvas.className = MINIMAP_CSS_CLASS;
    if (!this.visible) {
      this.canvas.style.display = 'none';
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

    const size = MINIMAP_CONFIG.canvasSize;
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
    if (this.canvas) this.canvas.style.display = '';
  }

  hide(): void {
    this.visible = false;
    if (this.canvas) this.canvas.style.display = 'none';
  }

  toggleVisibility(): void {
    this.visible = !this.visible;
    if (this.canvas) {
      this.canvas.style.display = this.visible ? 'block' : 'none';
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  cleanup(): void {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.lastUpdateTime = 0;
  }
}
