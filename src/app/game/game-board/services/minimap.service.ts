import { Injectable } from '@angular/core';
import { MINIMAP_CONFIG } from '../constants/minimap.constants';

export interface MinimapEntityData {
  x: number;
  z: number;
  type: 'tower' | 'enemy';
}

export interface MinimapTerrainData {
  gridSize: number;
  isPath: (row: number, col: number) => boolean;
  spawnPoint?: { x: number; z: number };
  exitPoint?: { x: number; z: number };
}

@Injectable()
export class MinimapService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private visible = false;
  private lastUpdateTime = 0;

  /**
   * Creates the minimap canvas and appends it to the given container.
   * Starts hidden — call setVisible(true) when gameplay begins.
   */
  init(container: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_CONFIG.canvasSize;
    this.canvas.height = MINIMAP_CONFIG.canvasSize;
    this.canvas.style.position = 'absolute';
    this.canvas.style.bottom = `${MINIMAP_CONFIG.padding}px`;
    this.canvas.style.left = `${MINIMAP_CONFIG.padding}px`;
    this.canvas.style.border = `${MINIMAP_CONFIG.borderWidth}px solid ${MINIMAP_CONFIG.borderColor}`;
    this.canvas.style.borderRadius = '4px';
    this.canvas.style.zIndex = '100';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.display = 'none';
    this.canvas.classList.add('minimap-canvas');

    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
  }

  setVisible(show: boolean): void {
    this.visible = show;
    if (this.canvas) {
      this.canvas.style.display = show ? 'block' : 'none';
    }
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
    if (!this.ctx || !this.canvas || !this.visible || terrain.gridSize <= 0) {
      return;
    }

    if (timeMs - this.lastUpdateTime < MINIMAP_CONFIG.updateIntervalMs) {
      return;
    }
    this.lastUpdateTime = timeMs;

    const size = MINIMAP_CONFIG.canvasSize;
    const cellSize = size / terrain.gridSize;

    // Background
    this.ctx.fillStyle = MINIMAP_CONFIG.backgroundColor;
    this.ctx.fillRect(0, 0, size, size);

    // Terrain grid
    for (let row = 0; row < terrain.gridSize; row++) {
      for (let col = 0; col < terrain.gridSize; col++) {
        this.ctx.fillStyle = terrain.isPath(row, col)
          ? MINIMAP_CONFIG.terrainColors.path
          : MINIMAP_CONFIG.terrainColors.buildable;
        this.ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    // Spawn and exit points
    if (terrain.spawnPoint) {
      this.ctx.fillStyle = MINIMAP_CONFIG.terrainColors.spawn;
      this.ctx.fillRect(
        terrain.spawnPoint.x * cellSize,
        terrain.spawnPoint.z * cellSize,
        cellSize,
        cellSize
      );
    }
    if (terrain.exitPoint) {
      this.ctx.fillStyle = MINIMAP_CONFIG.terrainColors.exit;
      this.ctx.fillRect(
        terrain.exitPoint.x * cellSize,
        terrain.exitPoint.z * cellSize,
        cellSize,
        cellSize
      );
    }

    // Entities (towers and enemies)
    for (const entity of entities) {
      const dotSize = entity.type === 'tower'
        ? MINIMAP_CONFIG.towerDotSize
        : MINIMAP_CONFIG.entityDotSize;
      const color = entity.type === 'tower'
        ? MINIMAP_CONFIG.terrainColors.tower
        : MINIMAP_CONFIG.terrainColors.enemy;

      this.ctx.fillStyle = color;
      const px = entity.x * cellSize + cellSize / 2;
      const pz = entity.z * cellSize + cellSize / 2;
      this.ctx.beginPath();
      this.ctx.arc(px, pz, dotSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
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
