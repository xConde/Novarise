import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TilePricingService } from './tile-pricing.service';
import { PriceLabelService } from './price-label.service';
import { TILE_EMISSIVE, HEATMAP_GRADIENT } from '../constants/ui.constants';
import { BlockType } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';

@Injectable()
export class TileHighlightService {
  private highlightedTiles = new Set<string>();

  constructor(
    private gameBoardService: GameBoardService,
    private gameStateService: GameStateService,
    private tilePricingService: TilePricingService,
    private priceLabelService: PriceLabelService
  ) {}

  /**
   * Highlight all valid placement tiles for the given tower type.
   * Two-pass: affordable tiles get full heatmap, unaffordable get dimmed version.
   * Does nothing if towerType is null.
   */
  updateHighlights(
    towerType: TowerType,
    tileMeshes: Map<string, THREE.Mesh>,
    selectedTile: { row: number; col: number } | null,
    scene: THREE.Scene,
    costMultiplier: number
  ): void {
    this.clearHighlights(tileMeshes, scene);

    const board = this.gameBoardService.getGameBoard();

    // First pass: affordable tiles get full heatmap
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;

        const key = `${row}-${col}`;
        const mesh = tileMeshes.get(key);
        if (!mesh) continue;

        // Skip selected tile — it has its own highlight
        if (selectedTile?.row === row && selectedTile?.col === col) continue;

        const priceInfo = this.tilePricingService.getTilePrice(towerType, row, col, costMultiplier);
        if (this.gameStateService.canAfford(priceInfo.cost)) {
          const material = mesh.material as THREE.MeshStandardMaterial;
          // Snapshot from tile-type defaults, not live material
          mesh.userData['origEmissive'] = TILE_EMISSIVE.defaultColor;
          mesh.userData['origEmissiveIntensity'] = TILE_EMISSIVE.base;

          // Apply smoothly interpolated heatmap color based on strategic value
          const { color, intensity } = this.interpolateHeatmap(priceInfo.strategicMultiplier);
          material.emissive.setRGB(color.r, color.g, color.b);
          material.emissiveIntensity = intensity;
          // Store exact interpolated values for smooth hover restore
          mesh.userData['heatmapR'] = color.r;
          mesh.userData['heatmapG'] = color.g;
          mesh.userData['heatmapB'] = color.b;
          mesh.userData['heatmapIntensity'] = intensity;
          this.highlightedTiles.add(key);
        }
      }
    }

    // Second pass: dim heatmap for unaffordable-but-valid tiles
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;

        const key = `${row}-${col}`;
        if (this.highlightedTiles.has(key)) continue; // already highlighted as affordable
        const mesh = tileMeshes.get(key);
        if (!mesh) continue;
        if (selectedTile?.row === row && selectedTile?.col === col) continue;

        const priceInfo = this.tilePricingService.getTilePrice(towerType, row, col, costMultiplier);
        const material = mesh.material as THREE.MeshStandardMaterial;
        mesh.userData['origEmissive'] = TILE_EMISSIVE.defaultColor;
        mesh.userData['origEmissiveIntensity'] = TILE_EMISSIVE.base;

        // Apply dimmed heatmap — same color but at reduced intensity
        const { color, intensity } = this.interpolateHeatmap(priceInfo.strategicMultiplier);
        const dim = TILE_EMISSIVE.unaffordableDimming;
        material.emissive.setRGB(color.r * dim, color.g * dim, color.b * dim);
        material.emissiveIntensity = intensity * dim;
        mesh.userData['heatmapR'] = color.r * dim;
        mesh.userData['heatmapG'] = color.g * dim;
        mesh.userData['heatmapB'] = color.b * dim;
        mesh.userData['heatmapIntensity'] = intensity * dim;
        this.highlightedTiles.add(key);
      }
    }

    // Show floating % labels above highlighted tiles
    if (this.highlightedTiles.size > 0) {
      const priceMap = this.tilePricingService.getTilePriceMap(towerType, costMultiplier);
      this.priceLabelService.showLabels(
        priceMap,
        this.gameBoardService.getBoardWidth(),
        this.gameBoardService.getBoardHeight(),
        this.gameBoardService.getTileSize(),
        scene
      );
    }
  }

  /** Remove all placement highlights, restoring original emissive values. */
  clearHighlights(tileMeshes: Map<string, THREE.Mesh>, scene: THREE.Scene): void {
    // Remove floating price labels
    this.priceLabelService.hideLabels(scene);

    for (const key of this.highlightedTiles) {
      const mesh = tileMeshes.get(key);
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const origColor = mesh.userData['origEmissive'] ?? TILE_EMISSIVE.defaultColor;
      const origIntensity = mesh.userData['origEmissiveIntensity'] ?? TILE_EMISSIVE.base;
      material.emissive.setHex(origColor);
      material.emissiveIntensity = origIntensity;
      delete mesh.userData['origEmissive'];
      delete mesh.userData['origEmissiveIntensity'];
      delete mesh.userData['heatmapR'];
      delete mesh.userData['heatmapG'];
      delete mesh.userData['heatmapB'];
      delete mesh.userData['heatmapIntensity'];
    }
    this.highlightedTiles.clear();
  }

  /**
   * Restore a single tile's emissive after hover, respecting current highlight state.
   * If the tile is highlighted: restores heatmap color stored in userData.
   * If not highlighted: restores emissive based on tile type.
   */
  restoreAfterHover(mesh: THREE.Mesh): void {
    const material = mesh.material as THREE.MeshStandardMaterial;
    const tileKey = `${mesh.userData['row']}-${mesh.userData['col']}`;
    if (this.highlightedTiles.has(tileKey)) {
      // Restore exact interpolated heatmap color (smooth, no tier quantization)
      const r = mesh.userData['heatmapR'] ?? 0;
      const g = mesh.userData['heatmapG'] ?? 0;
      const b = mesh.userData['heatmapB'] ?? 0;
      const hmIntensity = mesh.userData['heatmapIntensity'] ?? TILE_EMISSIVE.base;
      material.emissive.setRGB(r, g, b);
      material.emissiveIntensity = hmIntensity;
    } else {
      const tileType = mesh.userData['tile'].type;
      material.emissiveIntensity =
        tileType === BlockType.BASE
          ? TILE_EMISSIVE.base
          : tileType === BlockType.WALL
          ? TILE_EMISSIVE.wall
          : TILE_EMISSIVE.special;
    }
  }

  /** Check if a tile key is currently highlighted. */
  isHighlighted(key: string): boolean {
    return this.highlightedTiles.has(key);
  }

  /** Get the set of highlighted tile keys (read-only view). */
  getHighlightedTiles(): ReadonlySet<string> {
    return this.highlightedTiles;
  }

  /** Interpolate heatmap color from gradient stops based on strategic value. Clamped to gradient range. */
  interpolateHeatmap(value: number): { color: { r: number; g: number; b: number }; intensity: number } {
    const stops = HEATMAP_GRADIENT;
    // Clamp to gradient range — values beyond the last stop render as the hottest color
    const clamped = Math.max(0, Math.min(stops[stops.length - 1][0], value));

    // Find the two surrounding stops
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    // Lerp between the two stops
    const range = upper[0] - lower[0];
    const t = range > 0 ? (clamped - lower[0]) / range : 0;
    return {
      color: {
        r: lower[1] + (upper[1] - lower[1]) * t,
        g: lower[2] + (upper[2] - lower[2]) * t,
        b: lower[3] + (upper[3] - lower[3]) * t,
      },
      intensity: lower[4] + (upper[4] - lower[4]) * t,
    };
  }
}
