import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { SceneService } from './scene.service';
import { GameStateService } from './game-state.service';
import { TOUCH_CONFIG } from '../constants/touch.constants';

@Injectable()
export class TouchInteractionService implements OnDestroy {
  private canvas: HTMLCanvasElement | null = null;
  private onTap: ((clientX: number, clientY: number) => void) | null = null;

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

      if (event.changedTouches.length === 1 && !this.touchIsDragging) {
        const elapsed = performance.now() - this.touchStartTime;
        if (elapsed < TOUCH_CONFIG.tapThresholdMs) {
          this.onTap?.(this.touchStartX, this.touchStartY);
        }
      }

      this.touchIsDragging = false;
      this.pinchStartDistance = 0;
    };

    canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
  }

  cleanup(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.touchStartHandler);
      this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
      this.canvas.removeEventListener('touchend', this.touchEndHandler);
      this.canvas = null;
    }
    this.onTap = null;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
