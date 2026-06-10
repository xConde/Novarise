import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { SceneService } from './scene.service';
import { GameStateService } from './game-state.service';
import { TOUCH_CONFIG } from '../constants/touch.constants';

/**
 * Callbacks the two-step touch placement flow needs from the host component.
 * All are read-only queries / imperative actions — no BehaviorSubject coupling.
 */
export interface TouchPlacementCallbacks {
  /** Returns true when a tower card is pending placement (PLACE mode active). */
  isPlaceMode: () => boolean;
  /**
   * Raycast clientX/clientY to the board and return tile coords, or null if
   * the point misses the board entirely.  Does NOT filter structurally-invalid
   * tiles — the caller checks canPlaceTower separately.
   */
  resolveTileCoord: (clientX: number, clientY: number) => { row: number; col: number } | null;
  /**
   * Returns true when the tile at (row, col) is structurally valid for tower
   * placement (not occupied, not a wall, not path-blocking).  Used to decide
   * whether to anchor a pending-preview tile on the first tap.
   */
  canPlaceAt: (row: number, col: number) => boolean;
  /** Show the ghost preview anchored to the tile WITHOUT confirming placement. */
  showPreviewAt: (row: number, col: number) => void;
  /** Hide the ghost preview without clearing placement mode. */
  hidePreview: () => void;
  /** Confirm placement at the pending tile (equivalent to a desktop click-confirm). */
  confirmPlacement: (row: number, col: number) => void;
  /**
   * Called when the pending-preview tile changes so the placement-indicator
   * hint text can update (null = no pending tile, show first-tap hint).
   */
  onPendingTileChanged: (hasPendingTile: boolean) => void;
}

@Injectable()
export class TouchInteractionService implements OnDestroy {
  private canvas: HTMLCanvasElement | null = null;
  private onTap: ((clientX: number, clientY: number) => void) | null = null;

  // Two-step placement callbacks (optional — only set when host wires them up)
  private placementCallbacks: TouchPlacementCallbacks | null = null;

  // Two-step placement state: the tile targeted by the first tap
  private pendingTile: { row: number; col: number } | null = null;

  // Touch state
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private touchIsDragging = false;
  private pinchStartDistance = 0;

  // Named handler refs for removal
  private touchStartHandler: (event: TouchEvent) => void = () => {};
  private touchMoveHandler: (event: TouchEvent) => void = () => {};
  private touchEndHandler: (event: TouchEvent) => void = () => {};

  constructor(
    private sceneService: SceneService,
    private gameStateService: GameStateService,
  ) {}

  /**
   * Wire two-step touch placement callbacks.  Must be called after init().
   * Idempotent — safe to call again if callbacks change.
   */
  initPlacementCallbacks(callbacks: TouchPlacementCallbacks): void {
    this.placementCallbacks = callbacks;
  }

  init(canvas: HTMLCanvasElement, onTap: (clientX: number, clientY: number) => void): void {
    this.canvas = canvas;
    this.onTap = onTap;

    this.touchStartHandler = (event: TouchEvent) => {
      event.preventDefault();
      if (this.gameStateService.getState().isPaused) return;

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
        this.touchIsDragging = false;
      } else if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        this.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    this.touchMoveHandler = (event: TouchEvent) => {
      event.preventDefault();
      if (this.gameStateService.getState().isPaused) return;
      if (!this.sceneService.getCamera() || !this.sceneService.getControls()) return;

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > TOUCH_CONFIG.tapThresholdPx) {
          this.touchIsDragging = true;
        }

        if (this.touchIsDragging) {
          const panX = -dx * TOUCH_CONFIG.dragSensitivity;
          const panZ = -dy * TOUCH_CONFIG.dragSensitivity;
          this.sceneService.getCamera().position.x += panX;
          this.sceneService.getCamera().position.z += panZ;
          this.sceneService.getControls().target.x += panX;
          this.sceneService.getControls().target.z += panZ;

          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
        }
      } else if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (this.pinchStartDistance > 0) {
          const delta = this.pinchStartDistance - currentDistance;
          const zoomDelta = delta * TOUCH_CONFIG.pinchZoomSpeed;
          const dir = new THREE.Vector3()
            .subVectors(this.sceneService.getCamera().position, this.sceneService.getControls().target)
            .normalize();
          const newPos = this.sceneService.getCamera().position.clone().addScaledVector(dir, zoomDelta);
          const newDist = newPos.distanceTo(this.sceneService.getControls().target);

          if (newDist >= TOUCH_CONFIG.minZoom && newDist <= TOUCH_CONFIG.maxZoom) {
            this.sceneService.getCamera().position.copy(newPos);
          }
        }

        this.pinchStartDistance = currentDistance;
      }
    };

    this.touchEndHandler = (event: TouchEvent) => {
      event.preventDefault();
      if (this.gameStateService.getState().isPaused) return;

      if (event.changedTouches.length === 1 && !this.touchIsDragging) {
        const elapsed = performance.now() - this.touchStartTime;
        if (elapsed < TOUCH_CONFIG.tapThresholdMs) {
          // Two-step placement intercept: when PLACE mode is active, handle
          // the tap here rather than forwarding it to the desktop click path.
          if (this.placementCallbacks?.isPlaceMode()) {
            this.handlePlacementTap(this.touchStartX, this.touchStartY);
          } else {
            // Not in place mode — clear any stale pending tile and forward as
            // a normal tap (tower inspect, deselect, etc.).
            this.clearPendingTile();
            this.onTap?.(this.touchStartX, this.touchStartY);
          }
        }
      }

      this.touchIsDragging = false;
      this.pinchStartDistance = 0;
    };

    canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
  }

  // ---------------------------------------------------------------------------
  // Two-step touch placement
  // ---------------------------------------------------------------------------

  /**
   * Handle a tap while in PLACE mode.
   *
   * Step 1 — no pending tile yet (or different tile tapped):
   *   Resolve the tapped coord. If valid → anchor ghost preview there and
   *   set pendingTile. If invalid or off-board → clear pending and hide ghost.
   *
   * Step 2 — same tile tapped again:
   *   Confirm placement via the existing placement call.
   */
  private handlePlacementTap(clientX: number, clientY: number): void {
    const cb = this.placementCallbacks;
    if (!cb) return;

    const coord = cb.resolveTileCoord(clientX, clientY);

    if (!coord) {
      // Tapped off-board — cancel any pending preview.
      this.clearPendingTile();
      cb.hidePreview();
      return;
    }

    const { row, col } = coord;
    const pending = this.pendingTile;
    const isSameTile = pending !== null && pending.row === row && pending.col === col;

    if (isSameTile) {
      // Second tap on the same tile → confirm.
      this.clearPendingTile();
      cb.confirmPlacement(row, col);
    } else if (!cb.canPlaceAt(row, col)) {
      // Tapped a structurally invalid tile (occupied, wall, path-blocking).
      // Cancel pending preview — can't confirm here.
      this.clearPendingTile();
      cb.hidePreview();
    } else {
      // First tap on a valid tile (or retarget to a different valid tile) →
      // anchor ghost preview, stay in step one.
      this.pendingTile = { row, col };
      cb.showPreviewAt(row, col);
      cb.onPendingTileChanged(true);
    }
  }

  /**
   * Clear the pending-preview tile.  Called on mode exit, non-place-mode taps,
   * and successful confirmation.  Safe to call when pendingTile is already null.
   */
  clearPendingTile(): void {
    if (this.pendingTile !== null) {
      this.pendingTile = null;
      this.placementCallbacks?.onPendingTileChanged(false);
    }
  }

  /** Expose pending tile for testing and for component-level mode-exit cleanup. */
  getPendingTile(): { row: number; col: number } | null {
    return this.pendingTile;
  }

  // ---------------------------------------------------------------------------

  cleanup(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.touchStartHandler);
      this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
      this.canvas.removeEventListener('touchend', this.touchEndHandler);
      this.canvas = null;
    }
    this.onTap = null;
    this.clearPendingTile();
    this.placementCallbacks = null;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
