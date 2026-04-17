import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { BlockType } from '../models/game-board-tile';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';

/** Pre-computed RGB components of TILE_EMISSIVE.validPlacementColor (0x00ccaa). */
const HIGHLIGHT_R = 0x00 / 255;
const HIGHLIGHT_G = 0xcc / 255;
const HIGHLIGHT_B = 0xaa / 255;

/** Pre-computed RGB components of TILE_EMISSIVE.blockedPlacementColor (0xcc3322). */
const BLOCKED_R = 0xcc / 255;
const BLOCKED_G = 0x33 / 255;
const BLOCKED_B = 0x22 / 255;

@Injectable()
export class TileHighlightService {
  private highlightedTiles = new Set<string>();

  constructor(
    private gameBoardService: GameBoardService,
    private gameStateService: GameStateService,
  ) {}

  /**
   * Highlight all valid placement tiles for the given tower type.
   * Affordable tiles get a bright highlight; unaffordable tiles get a dimmed one.
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
    const baseCost = Math.round(TOWER_CONFIGS[towerType].cost * costMultiplier);
    const canAfford = this.gameStateService.canAfford(baseCost);

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;

        const key = `${row}-${col}`;
        const mesh = tileMeshes.get(key);
        if (!mesh) continue;

        // Skip selected tile — it has its own highlight
        if (selectedTile?.row === row && selectedTile?.col === col) continue;

        const material = mesh.material as THREE.MeshStandardMaterial;
        mesh.userData['origEmissive'] = TILE_EMISSIVE.defaultColor;
        mesh.userData['origEmissiveIntensity'] = TILE_EMISSIVE.base;

        // Path-blocking check: structurally-valid tiles that would cut off
        // all spawner→exit paths get a distinct "blocked" tint instead of
        // the valid-placement cyan. Without this, players click a tile that
        // *looks* valid and only learn it's blocked via the header
        // notification after the fact.
        const wouldBlock = this.gameBoardService.wouldBlockPath(row, col);

        if (wouldBlock) {
          material.emissive.setHex(TILE_EMISSIVE.blockedPlacementColor);
          material.emissiveIntensity = TILE_EMISSIVE.blockedPlacement;
          mesh.userData['heatmapR'] = BLOCKED_R;
          mesh.userData['heatmapG'] = BLOCKED_G;
          mesh.userData['heatmapB'] = BLOCKED_B;
          mesh.userData['heatmapIntensity'] = TILE_EMISSIVE.blockedPlacement;
        } else {
          const intensity = canAfford
            ? TILE_EMISSIVE.validPlacement
            : TILE_EMISSIVE.validPlacement * TILE_EMISSIVE.unaffordableDimming;
          material.emissive.setHex(TILE_EMISSIVE.validPlacementColor);
          material.emissiveIntensity = intensity;
          mesh.userData['heatmapR'] = HIGHLIGHT_R;
          mesh.userData['heatmapG'] = HIGHLIGHT_G;
          mesh.userData['heatmapB'] = HIGHLIGHT_B;
          mesh.userData['heatmapIntensity'] = intensity;
        }
        this.highlightedTiles.add(key);
      }
    }
  }

  /** Remove all placement highlights, restoring original emissive values. */
  clearHighlights(tileMeshes: Map<string, THREE.Mesh>, _scene: THREE.Scene): void {
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
   * If the tile is highlighted: restores stored emissive color.
   * If not highlighted: restores emissive based on tile type.
   */
  restoreAfterHover(mesh: THREE.Mesh): void {
    const material = mesh.material as THREE.MeshStandardMaterial;
    const tileKey = `${mesh.userData['row']}-${mesh.userData['col']}`;
    if (this.highlightedTiles.has(tileKey)) {
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
}
