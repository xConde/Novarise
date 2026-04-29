import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { BlockType } from '../models/game-board-tile';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';

/**
 * Tile highlight strategy.
 *
 * Phase C sprint 22: tiles render via either an InstancedMesh (BASE)
 * or an individual Mesh (everything else). Highlight strategy must
 * dispatch on which surface owns each tile:
 *
 *  - **Instanced surface** — multiplicative tint via the per-instance
 *    `instanceColor` attribute. Identity = (1, 1, 1). Highlight =
 *    a chosen RGB. Reset on clear/restore.
 *
 *  - **Individual surface** — emissive mutation as before. Per-mesh
 *    materials (post-revert in pre-sprint-21 fix) so no aliasing.
 *
 * State (highlights, selection, hover) is keyed by `"row-col"` strings
 * so the service is agnostic to which surface the tile lives in. The
 * BoardMeshRegistry's `findTileSurface(row, col)` resolves at write time.
 */
@Injectable()
export class TileHighlightService {
  /** Tiles currently in the placement-highlight set (cyan / red). */
  private highlightedTiles = new Set<string>();

  /** Per-tile saved state — only populated for tiles being highlighted. */
  private savedHighlightState = new Map<string, SavedTileState>();

  /** Per-tile saved state for the currently-selected tile. */
  private selectedSaved: SavedTileState | null = null;

  /** Per-tile saved state for the currently-hovered tile. */
  private hoverSaved: SavedTileState | null = null;
  private hoverKey: string | null = null;

  constructor(
    private gameBoardService: GameBoardService,
    private gameStateService: GameStateService,
    private meshRegistry: BoardMeshRegistryService,
  ) {}

  /**
   * Highlight all valid placement tiles for the given tower type.
   * Affordable tiles get a bright highlight; unaffordable tiles dimmer.
   * Tiles that would block all paths get a red tint instead.
   */
  updateHighlights(
    towerType: TowerType,
    selectedTile: { row: number; col: number } | null,
    costMultiplier: number,
  ): void {
    this.clearHighlights();

    // Drain any active hover BEFORE we capture per-tile snapshots — otherwise
    // the hovered tile's snapshot includes the hover tint, and restoring on
    // clearHighlights leaves a permanent ghost tint after the cursor moves.
    const drainedHoverKey = this.hoverKey;
    if (drainedHoverKey) {
      const [hr, hc] = drainedHoverKey.split('-').map(Number);
      this.restoreAfterHoverByCoord(hr, hc);
    }

    const board = this.gameBoardService.getGameBoard();
    const baseCost = Math.round(TOWER_CONFIGS[towerType].cost * costMultiplier);
    const canAfford = this.gameStateService.canAfford(baseCost);

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;
        if (selectedTile?.row === row && selectedTile?.col === col) continue;

        const wouldBlock = this.gameBoardService.wouldBlockPath(row, col);
        const intensity = canAfford
          ? TILE_EMISSIVE.validPlacement
          : TILE_EMISSIVE.validPlacement * TILE_EMISSIVE.unaffordableDimming;

        const key = `${row}-${col}`;
        this.savedHighlightState.set(key, this.captureTileState(row, col));
        this.highlightedTiles.add(key);

        if (wouldBlock) {
          this.applyTileTint(row, col, TILE_EMISSIVE.blockedPlacementColor, TILE_EMISSIVE.blockedPlacement);
        } else {
          this.applyTileTint(row, col, TILE_EMISSIVE.validPlacementColor, intensity);
        }
      }
    }

    // Re-apply hover on top of highlights if the cursor is still over a tile —
    // BoardPointerService will re-hover on the next mouse move, but if no
    // mouse event fires we'd lose the hover bump. Cheap to re-apply now.
    if (drainedHoverKey) {
      const [hr, hc] = drainedHoverKey.split('-').map(Number);
      this.applyHoverByCoord(hr, hc);
    }
  }

  clearHighlights(): void {
    for (const key of this.highlightedTiles) {
      const saved = this.savedHighlightState.get(key);
      if (saved) {
        this.restoreTileState(saved);
      }
    }
    this.highlightedTiles.clear();
    this.savedHighlightState.clear();
  }

  /**
   * Clear ALL highlight + hover + selection state. Called by
   * GameSessionService.cleanupScene at encounter teardown — the underlying
   * tile layers are about to be disposed, so any saved state pointing at
   * them must be dropped to avoid restoring stale colors onto the next
   * encounter's fresh layers.
   */
  resetAllState(): void {
    this.clearHighlights();
    this.hoverKey = null;
    this.hoverSaved = null;
    this.selectedSaved = null;
  }

  // ── Hover ───────────────────────────────────────────────────────────────

  /** Apply a hover bump to (row, col). Stores prior state for restore. */
  applyHoverByCoord(row: number, col: number): void {
    const key = `${row}-${col}`;
    if (this.hoverKey === key) return;
    if (this.hoverKey && this.hoverSaved) {
      this.restoreTileState(this.hoverSaved);
    }
    this.hoverSaved = this.captureTileState(row, col);
    this.hoverKey = key;
    this.applyTileTint(row, col, TILE_EMISSIVE.defaultColor, TILE_EMISSIVE.hover);
  }

  /** Restore a tile after hover ends, respecting active highlight/selection state. */
  restoreAfterHoverByCoord(row: number, col: number): void {
    const key = `${row}-${col}`;
    if (this.hoverKey !== key) return;
    if (this.hoverSaved) {
      // If the tile is currently in the placement-highlight set, the saved
      // hover state captured the highlight tint — restoring it is correct.
      // If not, it captured the natural state.
      this.restoreTileState(this.hoverSaved);
    }
    this.hoverKey = null;
    this.hoverSaved = null;
  }

  // ── Selection ───────────────────────────────────────────────────────────

  applySelectionByCoord(row: number, col: number): void {
    // If the tile is currently hovered, drain hover state first so the
    // selection snapshot captures the natural (un-hovered) state. Without
    // this, restoreSelectionByCoord later would restore TO the hover tint.
    const key = `${row}-${col}`;
    if (this.hoverKey === key) {
      this.restoreAfterHoverByCoord(row, col);
    }
    if (this.selectedSaved) {
      this.restoreTileState(this.selectedSaved);
    }
    this.selectedSaved = this.captureTileState(row, col);
    this.applyTileTint(row, col, TILE_EMISSIVE.defaultColor, TILE_EMISSIVE.selected);
  }

  restoreSelectionByCoord(_row: number, _col: number): void {
    if (this.selectedSaved) {
      this.restoreTileState(this.selectedSaved);
      this.selectedSaved = null;
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  isHighlighted(key: string): boolean {
    return this.highlightedTiles.has(key);
  }

  getHighlightedTiles(): ReadonlySet<string> {
    return this.highlightedTiles;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private captureTileState(row: number, col: number): SavedTileState {
    const surface = this.meshRegistry.findTileSurface(row, col);
    if (surface.kind === 'instanced') {
      const c = surface.layer.getColorAt(row, col) ?? new THREE.Color(1, 1, 1);
      return { kind: 'instanced', row, col, color: c };
    }
    if (surface.kind === 'individual') {
      const mat = surface.mesh.material as THREE.MeshStandardMaterial;
      return {
        kind: 'individual',
        row,
        col,
        emissive: mat.emissive.getHex(),
        emissiveIntensity: mat.emissiveIntensity,
      };
    }
    return { kind: 'none', row, col };
  }

  private restoreTileState(saved: SavedTileState): void {
    if (saved.kind === 'instanced') {
      const surface = this.meshRegistry.findTileSurface(saved.row, saved.col);
      if (surface.kind === 'instanced') {
        surface.layer.setColorAt(saved.row, saved.col, saved.color);
      }
    } else if (saved.kind === 'individual') {
      const surface = this.meshRegistry.findTileSurface(saved.row, saved.col);
      if (surface.kind === 'individual') {
        const mat = surface.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(saved.emissive);
        mat.emissiveIntensity = saved.emissiveIntensity;
      }
    }
  }

  private applyTileTint(row: number, col: number, emissiveHex: number, intensity: number): void {
    const surface = this.meshRegistry.findTileSurface(row, col);
    if (surface.kind === 'instanced') {
      // Translate emissive (color + intensity) into a multiplicative tint
      // that preserves base-tile brightness while pushing toward the
      // highlight color.
      //
      // The instanced material multiplies its base color by the per-instance
      // color. Identity = (1, 1, 1) → no change. To "brighten toward color X
      // by intensity I" we mix (1, 1, 1) toward (1 + X * I) with a weight
      // proportional to I. That keeps RGB ≥ 1 for the channels that should
      // glow and avoids the darkening that pure multiplication causes.
      const tint = new THREE.Color(emissiveHex);
      const intensityClamped = Math.max(0, Math.min(intensity, 2));
      const r = 1 + tint.r * intensityClamped;
      const g = 1 + tint.g * intensityClamped;
      const b = 1 + tint.b * intensityClamped;
      surface.layer.setColorAt(row, col, new THREE.Color(r, g, b));
    } else if (surface.kind === 'individual') {
      const mat = surface.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(emissiveHex);
      mat.emissiveIntensity = intensity;
    }
  }
}

type SavedTileState =
  | { kind: 'instanced'; row: number; col: number; color: THREE.Color }
  | { kind: 'individual'; row: number; col: number; emissive: number; emissiveIntensity: number }
  | { kind: 'none'; row: number; col: number };
