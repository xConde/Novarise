import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { SceneService } from './scene.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TileHighlightService } from './tile-highlight.service';
import { TowerPreviewService } from './tower-preview.service';
import { RangeVisualizationService } from './range-visualization.service';
import { GameStateService } from './game-state.service';
import { GameBoardService } from '../game-board.service';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { TowerType, PlacedTower } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { GamePhase } from '../models/game-state.model';

export interface PointerCallbacks {
  onTowerClick: (key: string) => void;
  onTilePlace: (row: number, col: number) => void;
  onDeselect: () => void;
  onCancelPlacement: () => void;
  onContextMenu: () => void;
  getPlacementState: () => {
    isPlaceMode: boolean;
    towerType: TowerType | null;
    gold: number;
    selectedTowerInfo: PlacedTower | null;
  };
}

@Injectable()
export class BoardPointerService implements OnDestroy {
  // Raycasting state — exposed for TowerPlacementService which needs shared refs
  readonly raycaster = new THREE.Raycaster();
  readonly mouse = new THREE.Vector2();

  // Hover / selection state.
  // Phase C sprint 22: hovered tile is identified by (row, col) rather than
  // a Mesh ref because BASE tiles now live in an InstancedMesh — there is
  // no per-tile Mesh to hold a hover handle on.
  private hoveredCoord: { row: number; col: number } | null = null;
  private selectedTile: { row: number; col: number } | null = null;
  private lastPreviewKey = '';

  // Canvas and callbacks
  private canvas: HTMLCanvasElement | null = null;
  private callbacks: PointerCallbacks | null = null;

  // Named handler refs for removal
  private mousemoveHandler: (event: MouseEvent) => void = () => {};
  private clickHandler: (event: MouseEvent) => void = () => {};
  private contextmenuHandler: (event: MouseEvent) => void = () => {};

  constructor(
    private sceneService: SceneService,
    private meshRegistry: BoardMeshRegistryService,
    private tileHighlightService: TileHighlightService,
    private towerPreviewService: TowerPreviewService,
    private rangeVisualizationService: RangeVisualizationService,
    private gameStateService: GameStateService,
    private gameBoardService: GameBoardService,
  ) {}

  init(canvas: HTMLCanvasElement, callbacks: PointerCallbacks): void {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.mousemoveHandler = (event: MouseEvent) => {
      if (!this.canvas || this.gameStateService.getState().isPaused) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
      const intersects = this.raycaster.intersectObjects(
        this.meshRegistry.getTilePickables() as THREE.Object3D[],
      );

      // Restore the previously-hovered tile (unless it's the selected one,
      // which has its own highlight).
      if (this.hoveredCoord) {
        const sel = this.selectedTile;
        const isSelected = sel && sel.row === this.hoveredCoord.row && sel.col === this.hoveredCoord.col;
        if (!isSelected) {
          this.tileHighlightService.restoreAfterHoverByCoord(
            this.hoveredCoord.row,
            this.hoveredCoord.col,
          );
        }
      }

      if (intersects.length > 0) {
        const coord = this.meshRegistry.resolveTileHit(intersects[0]);
        if (!coord) {
          this.hoveredCoord = null;
          this.canvas!.style.cursor = 'default';
          return;
        }
        const sel = this.selectedTile;
        const isSelected = sel && sel.row === coord.row && sel.col === coord.col;
        if (!isSelected) {
          this.hoveredCoord = coord;
          this.tileHighlightService.applyHoverByCoord(coord.row, coord.col);
          this.canvas!.style.cursor = 'pointer';
        }

        const row = coord.row;
        const col = coord.col;
        const phase = this.gameStateService.getState().phase;
        const isTerminal = phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT;
        const placement = this.callbacks!.getPlacementState();

        if (!isTerminal && !placement.selectedTowerInfo && placement.isPlaceMode) {
          const previewKey = `${row}-${col}-${placement.towerType}-${placement.gold}`;
          if (previewKey !== this.lastPreviewKey) {
            this.lastPreviewKey = previewKey;
            const tileCost = this.gameStateService.getEffectiveTowerCost(placement.towerType!);
            const structurallyValid = this.gameBoardService.canPlaceTower(row, col);
            const canPlace = structurallyValid && this.gameStateService.canAfford(tileCost);
            this.towerPreviewService.showPreview(placement.towerType!, row, col, canPlace, this.sceneService.getScene());
            // Show range ring whenever the tile is structurally placeable —
            // affordability is conveyed by the red/valid ghost color, not by
            // hiding the ring (which would strip range feedback exactly when
            // players need gold-context).
            if (structurallyValid) {
              this.rangeVisualizationService.showForPosition(
                placement.towerType!,
                row,
                col,
                this.gameBoardService.getBoardWidth(),
                this.gameBoardService.getBoardHeight(),
                this.gameBoardService.getTileSize(),
                this.sceneService.getScene()
              );
            } else {
              this.rangeVisualizationService.hideHoverRange(this.sceneService.getScene());
            }
          }
        } else {
          this.lastPreviewKey = '';
          this.towerPreviewService.hidePreview(this.sceneService.getScene());
          this.rangeVisualizationService.hideHoverRange(this.sceneService.getScene());
        }
      } else {
        this.hoveredCoord = null;
        this.canvas!.style.cursor = 'default';
        this.lastPreviewKey = '';
        this.towerPreviewService.hidePreview(this.sceneService.getScene());
        this.rangeVisualizationService.hideHoverRange(this.sceneService.getScene());
      }
    };

    this.clickHandler = (event: MouseEvent) => {
      if (this.gameStateService.getState().isPaused) return;
      this.handleInteraction(event.clientX, event.clientY);
    };

    this.contextmenuHandler = (event: MouseEvent) => {
      event.preventDefault();
      // Delegate full context-menu logic to the component, which knows about
      // isDragging (towerPlacementService) and isPlaceMode state.
      this.callbacks?.onContextMenu();
    };

    canvas.addEventListener('mousemove', this.mousemoveHandler);
    canvas.addEventListener('click', this.clickHandler);
    canvas.addEventListener('contextmenu', this.contextmenuHandler);
  }

  /** Unified click/tap handler — raycasts to towers then tiles at (clientX, clientY). */
  handleInteraction(clientX: number, clientY: number): void {
    if (!this.canvas || !this.callbacks) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());

    // Check for tower mesh hits first
    const towerHits = this.raycaster.intersectObjects(this.meshRegistry.getTowerChildrenArray() as THREE.Object3D[]);

    if (towerHits.length > 0) {
      let hitObj: THREE.Object3D | null = towerHits[0].object;
      let foundKey: string | null = null;
      while (hitObj) {
        for (const [key, group] of this.meshRegistry.towerMeshes) {
          if (group === hitObj) { foundKey = key; break; }
        }
        if (foundKey) break;
        hitObj = hitObj.parent;
      }
      if (foundKey) {
        this.callbacks.onTowerClick(foundKey);
        return;
      }
    }

    // Check tile hits
    const intersects = this.raycaster.intersectObjects(
      this.meshRegistry.getTilePickables() as THREE.Object3D[],
    );

    if (this.selectedTile) {
      this.tileHighlightService.restoreSelectionByCoord(
        this.selectedTile.row,
        this.selectedTile.col,
      );
    }

    if (intersects.length > 0) {
      const coord = this.meshRegistry.resolveTileHit(intersects[0]);
      if (!coord) {
        this.selectedTile = null;
        this.callbacks.onDeselect();
        return;
      }
      const { row, col } = coord;
      this.selectedTile = { row, col };
      this.tileHighlightService.applySelectionByCoord(row, col);

      this.callbacks.onDeselect();

      const placement = this.callbacks.getPlacementState();
      if (placement.isPlaceMode) {
        this.callbacks.onTilePlace(row, col);
      }
    } else {
      this.selectedTile = null;
      this.callbacks.onDeselect();
    }
  }

  /** Clear the selected tile reference (called after successful tower placement or sell). */
  clearSelectedTile(): void {
    this.selectedTile = null;
    this.lastPreviewKey = '';
  }

  /** Returns the currently selected tile (read-only). Used for tile highlight updates. */
  getSelectedTile(): { row: number; col: number } | null {
    return this.selectedTile;
  }

  cleanup(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
      this.canvas.removeEventListener('click', this.clickHandler);
      this.canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      this.canvas = null;
    }
    this.callbacks = null;
    this.hoveredCoord = null;
    this.selectedTile = null;
    this.lastPreviewKey = '';
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
