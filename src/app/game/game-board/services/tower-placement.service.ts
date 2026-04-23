import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType } from '../models/tower.model';
import { DRAG_CONFIG } from '../constants/touch.constants';
import { SceneService } from './scene.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TowerPreviewService } from './tower-preview.service';

/**
 * Manages drag-and-drop tower placement state machine.
 *
 * Responsible for:
 * - Tracking drag state (isDragging, dragTowerType, threshold)
 * - Registering / removing global drag event listeners
 * - Showing the ghost tower preview during a drag gesture
 * - Calling back to the component when a placement should occur
 *
 * The service does NOT perform the actual tower placement — it invokes the
 * `onPlaceAttempt` callback supplied by the component so all downstream side
 * effects (mesh creation, audio, tile highlights, etc.) remain in one place.
 */
@Injectable()
export class TowerPlacementService {
  isDragging = false;

  private dragTowerType: TowerType | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragThresholdMet = false;
  private globalDragMoveHandler: EventListener = () => {};
  private globalDragEndHandler: EventListener = () => {};
  private blurDragHandler: () => void = () => {};
  private dragIsTouch = false;

  /** Raycaster + mouse vector are owned by the component; injected at drag-start time. */
  private raycaster: THREE.Raycaster | null = null;
  private mouse: THREE.Vector2 | null = null;
  private tileMeshArrayRef: () => THREE.Mesh[] = () => [];

  /** Called by the component to enter PLACE mode and show tile highlights. */
  onEnterPlaceMode: ((type: TowerType) => void) | null = null;
  /** Called when the drag gesture ends over a valid tile. */
  onPlaceAttempt: ((row: number, col: number) => void) | null = null;
  /** Called when drag starts so the component can deselect any placed tower. */
  onDeselectTower: (() => void) | null = null;

  constructor(
    private sceneService: SceneService,
    private gameBoardService: GameBoardService,
    private gameStateService: GameStateService,
    private towerPreviewService: TowerPreviewService,
  ) {}

  /**
   * Wire up component references needed during drag operations.
   * Call once from `ngAfterViewInit` (after renderer is ready).
   */
  init(
    raycaster: THREE.Raycaster,
    mouse: THREE.Vector2,
    tileMeshArrayRef: () => THREE.Mesh[],
    callbacks: {
      onEnterPlaceMode: (type: TowerType) => void;
      onPlaceAttempt: (row: number, col: number) => void;
      onDeselectTower: () => void;
    }
  ): void {
    // Guard: tear down prior state before attaching new refs/callbacks.
    // Matches the double-call guard pattern used by GameInputService.init().
    this.cleanup();
    this.raycaster = raycaster;
    this.mouse = mouse;
    this.tileMeshArrayRef = tileMeshArrayRef;
    this.onEnterPlaceMode = callbacks.onEnterPlaceMode;
    this.onPlaceAttempt = callbacks.onPlaceAttempt;
    this.onDeselectTower = callbacks.onDeselectTower;
  }

  /** Called on mousedown/touchstart on a tower bar button. */
  onTowerDragStart(event: MouseEvent | TouchEvent, type: TowerType): void {
    // Only left mouse button for mouse events
    if (event instanceof MouseEvent && event.button !== 0) return;
    // Guard: a TouchEvent with no touches (e.g. touchend) has nothing to read
    if (event instanceof TouchEvent && event.touches.length === 0) return;

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    this.dragTowerType = type;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragThresholdMet = false;
    this.isDragging = false;

    // Listen on window for move/up so we catch events outside the button.
    // Track event type to register correct listeners (mouse vs touch).
    this.blurDragHandler = () => this.cancelDrag();
    window.addEventListener('blur', this.blurDragHandler);
    this.dragIsTouch = event instanceof TouchEvent;

    if (this.dragIsTouch) {
      this.globalDragMoveHandler = (e: Event) => {
        const te = e as TouchEvent;
        if (te.touches.length === 1) {
          this.onDragMove(te.touches[0].clientX, te.touches[0].clientY);
        } else if (te.touches.length > 1) {
          // Multi-finger during drag = abort (user switched to pinch/zoom)
          this.cancelDrag();
        }
      };
      this.globalDragEndHandler = (e: Event) => {
        const te = e as TouchEvent;
        // Always handle touchend — multi-finger release must cancel the drag,
        // not silently orphan listeners (changedTouches.length > 1 on multi-lift)
        if (te.changedTouches.length >= 1) {
          this.onDragEnd(te.changedTouches[0].clientX, te.changedTouches[0].clientY);
        }
      };
      window.addEventListener('touchmove', this.globalDragMoveHandler, { passive: false });
      window.addEventListener('touchend', this.globalDragEndHandler);
    } else {
      this.globalDragMoveHandler = (e: Event) => this.onDragMove((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      this.globalDragEndHandler = (e: Event) => this.onDragEnd((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      window.addEventListener('mousemove', this.globalDragMoveHandler);
      window.addEventListener('mouseup', this.globalDragEndHandler);
    }
  }

  /** Track mouse/touch during potential drag. */
  private onDragMove(clientX: number, clientY: number): void {
    if (!this.dragTowerType) return;

    if (!this.dragThresholdMet) {
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_CONFIG.minDragDistance) return;
      this.dragThresholdMet = true;
      this.isDragging = true;

      // Enter PLACE mode with this tower type and show highlights
      this.onEnterPlaceMode?.(this.dragTowerType);
      this.onDeselectTower?.();
    }

    // Update ghost preview position by raycasting to tiles
    if (!this.sceneService.getRenderer() || !this.raycaster || !this.mouse) return;
    const canvas = this.sceneService.getRenderer().domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
    const intersects = this.raycaster.intersectObjects(this.tileMeshArrayRef());

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const row = mesh.userData['row'] as number;
      const col = mesh.userData['col'] as number;
      const tileCost = this.gameStateService.getEffectiveTowerCost(this.dragTowerType!);
      const canPlace = this.gameBoardService.canPlaceTower(row, col)
        && this.gameStateService.canAfford(tileCost);
      this.towerPreviewService.showPreview(this.dragTowerType!, row, col, canPlace, this.sceneService.getScene());
    } else {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
  }

  /** End drag — place tower if over a valid tile. */
  private onDragEnd(clientX: number, clientY: number): void {
    this.removeDragListeners();

    if (!this.dragTowerType || !this.dragThresholdMet) {
      // Threshold not met — this was a click, not a drag. selectTowerType handles it.
      this.dragTowerType = null;
      this.isDragging = false;
      return;
    }

    // Raycast to find the tile under the cursor
    if (this.sceneService.getRenderer() && this.raycaster && this.mouse) {
      const canvas = this.sceneService.getRenderer().domElement;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
      const intersects = this.raycaster.intersectObjects(this.tileMeshArrayRef());

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'] as number;
        const col = mesh.userData['col'] as number;
        this.onPlaceAttempt?.(row, col);
      }
    }

    // Clean up drag state
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
    this.isDragging = false;
    this.dragTowerType = null;
    this.dragThresholdMet = false;
  }

  /** Cancel drag without placing — used when window loses focus or context is destroyed. */
  cancelDrag(): void {
    this.removeDragListeners();
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
    this.isDragging = false;
    this.dragTowerType = null;
    this.dragThresholdMet = false;
  }

  /** Remove global drag event listeners (mouse or touch depending on how drag started). */
  removeDragListeners(): void {
    if (this.dragIsTouch) {
      window.removeEventListener('touchmove', this.globalDragMoveHandler);
      window.removeEventListener('touchend', this.globalDragEndHandler);
    } else {
      window.removeEventListener('mousemove', this.globalDragMoveHandler);
      window.removeEventListener('mouseup', this.globalDragEndHandler);
    }
    window.removeEventListener('blur', this.blurDragHandler);
  }

  /**
   * Full cleanup — remove any active drag listeners and clear all callback references.
   * Call from the component's `ngOnDestroy` to prevent leaks across instance reuse.
   */
  cleanup(): void {
    this.removeDragListeners();
    this.raycaster = null;
    this.mouse = null;
    this.tileMeshArrayRef = () => [];
    this.onEnterPlaceMode = null;
    this.onPlaceAttempt = null;
    this.onDeselectTower = null;
  }
}
