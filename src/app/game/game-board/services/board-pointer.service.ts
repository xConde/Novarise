import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { SceneService } from './scene.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TileHighlightService } from './tile-highlight.service';
import { TowerPreviewService } from './tower-preview.service';
import { GameStateService } from './game-state.service';
import { GameBoardService } from '../game-board.service';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { TOWER_CONFIGS, TowerType, PlacedTower } from '../models/tower.model';
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

  // Hover / selection state
  private hoveredTile: THREE.Mesh | null = null;
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
    private gameStateService: GameStateService,
    private gameBoardService: GameBoardService,
  ) {}

  init(canvas: HTMLCanvasElement, callbacks: PointerCallbacks): void {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.mousemoveHandler = (event: MouseEvent) => {
      if (this.gameStateService.getState().isPaused) return;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
      const intersects = this.raycaster.intersectObjects(this.meshRegistry.getTileMeshArray() as THREE.Mesh[]);

      if (this.hoveredTile && this.hoveredTile !== this.getSelectedTileMesh()) {
        this.tileHighlightService.restoreAfterHover(this.hoveredTile);
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        if (mesh !== this.getSelectedTileMesh()) {
          this.hoveredTile = mesh;
          const material = mesh.material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = TILE_EMISSIVE.hover;
          canvas.style.cursor = 'pointer';
        }

        const row = mesh.userData['row'];
        const col = mesh.userData['col'];
        const phase = this.gameStateService.getState().phase;
        const isTerminal = phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT;
        const placement = this.callbacks!.getPlacementState();

        if (!isTerminal && !placement.selectedTowerInfo && placement.isPlaceMode) {
          const previewKey = `${row}-${col}-${placement.towerType}-${placement.gold}`;
          if (previewKey !== this.lastPreviewKey) {
            this.lastPreviewKey = previewKey;
            const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
            const tileCost = Math.round(TOWER_CONFIGS[placement.towerType!].cost * costMult);
            const canPlace = this.gameBoardService.canPlaceTower(row, col)
              && this.gameStateService.canAfford(tileCost);
            this.towerPreviewService.showPreview(placement.towerType!, row, col, canPlace, this.sceneService.getScene());
          }
        } else {
          this.lastPreviewKey = '';
          this.towerPreviewService.hidePreview(this.sceneService.getScene());
        }
      } else {
        this.hoveredTile = null;
        canvas.style.cursor = 'default';
        this.lastPreviewKey = '';
        this.towerPreviewService.hidePreview(this.sceneService.getScene());
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
      this.callbacks!.onContextMenu();
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
    const intersects = this.raycaster.intersectObjects(this.meshRegistry.getTileMeshArray() as THREE.Mesh[]);

    const prevSelected = this.getSelectedTileMesh();
    if (prevSelected) {
      const material = prevSelected.material as THREE.MeshStandardMaterial;
      const tileType = prevSelected.userData['tile'].type;
      material.emissiveIntensity =
        tileType === BlockType.BASE ? TILE_EMISSIVE.base
        : tileType === BlockType.WALL ? TILE_EMISSIVE.wall
        : TILE_EMISSIVE.special;
    }

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const row = mesh.userData['row'];
      const col = mesh.userData['col'];

      this.selectedTile = { row, col };

      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = TILE_EMISSIVE.selected;

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

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.meshRegistry.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) ?? null;
  }

  cleanup(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
      this.canvas.removeEventListener('click', this.clickHandler);
      this.canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      this.canvas = null;
    }
    this.callbacks = null;
    this.hoveredTile = null;
    this.selectedTile = null;
    this.lastPreviewKey = '';
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
