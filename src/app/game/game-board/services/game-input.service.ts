import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CAMERA_CONFIG } from '../constants/camera.constants';

@Injectable()
export class GameInputService implements OnDestroy {
  readonly hotkey$ = new Subject<KeyboardEvent>();

  private readonly panKeys = new Set<string>();
  private readonly _panForward = new THREE.Vector3();
  private readonly _panRight = new THREE.Vector3();
  private readonly _panUp = new THREE.Vector3(0, 1, 0);

  private keydownHandler!: (e: KeyboardEvent) => void;
  private keyupHandler!: (e: KeyboardEvent) => void;

  private static readonly PAN_KEYS = [
    'w', 'a', 's', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ];

  init(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (GameInputService.PAN_KEYS.includes(key)) {
        this.panKeys.add(key);
      }
      this.hotkey$.next(e);
    };
    this.keyupHandler = (e: KeyboardEvent) => {
      this.panKeys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  updateCameraPan(camera: THREE.PerspectiveCamera, controls: OrbitControls): void {
    if (this.panKeys.size === 0) return;

    // Forward = camera look direction projected onto XZ plane
    camera.getWorldDirection(this._panForward);
    this._panForward.y = 0;
    this._panForward.normalize();

    // Right = forward × up (perpendicular on XZ plane)
    this._panRight.crossVectors(this._panForward, this._panUp).normalize();

    let moveX = 0;
    let moveZ = 0;

    if (this.panKeys.has('w') || this.panKeys.has('arrowup')) {
      moveX += this._panForward.x * CAMERA_CONFIG.panSpeed;
      moveZ += this._panForward.z * CAMERA_CONFIG.panSpeed;
    }
    if (this.panKeys.has('s') || this.panKeys.has('arrowdown')) {
      moveX -= this._panForward.x * CAMERA_CONFIG.panSpeed;
      moveZ -= this._panForward.z * CAMERA_CONFIG.panSpeed;
    }
    if (this.panKeys.has('a') || this.panKeys.has('arrowleft')) {
      moveX -= this._panRight.x * CAMERA_CONFIG.panSpeed;
      moveZ -= this._panRight.z * CAMERA_CONFIG.panSpeed;
    }
    if (this.panKeys.has('d') || this.panKeys.has('arrowright')) {
      moveX += this._panRight.x * CAMERA_CONFIG.panSpeed;
      moveZ += this._panRight.z * CAMERA_CONFIG.panSpeed;
    }

    camera.position.x += moveX;
    camera.position.z += moveZ;
    controls.target.x += moveX;
    controls.target.z += moveZ;
  }

  cleanup(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler);
    }
    this.panKeys.clear();
    this.hotkey$.complete();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
