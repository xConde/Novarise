import { Injectable } from '@angular/core';
import * as THREE from 'three';

interface ShakeState {
  intensity: number;
  duration: number;
  remaining: number;
  originX: number;
  originY: number;
  originZ: number;
}

@Injectable()
export class ScreenShakeService {
  private shake: ShakeState | null = null;

  /**
   * Trigger a screen shake. If a stronger shake is already active, the new
   * one is ignored. If the new shake is stronger, it replaces the current one
   * (preserving the camera origin from the already-active shake so we don't
   * drift on repeated triggers).
   */
  trigger(intensity: number, duration: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (document.body.classList.contains('reduce-motion')) {
      return;
    }

    if (this.shake !== null && this.shake.intensity >= intensity) {
      return;
    }

    const originX = this.shake?.originX ?? 0;
    const originY = this.shake?.originY ?? 0;
    const originZ = this.shake?.originZ ?? 0;

    this.shake = { intensity, duration, remaining: duration, originX, originY, originZ };
  }

  /**
   * Apply per-frame shake offset to the camera. Must be called every frame
   * with the same camera instance that was in use when trigger() was called.
   */
  update(deltaTime: number, camera: THREE.Camera): void {
    if (this.shake === null) {
      return;
    }

    // Capture origin on the very first update after a fresh trigger if the
    // camera hasn't been offset yet (remaining === duration).
    if (this.shake.remaining === this.shake.duration) {
      this.shake.originX = camera.position.x;
      this.shake.originY = camera.position.y;
      this.shake.originZ = camera.position.z;
    }

    this.shake.remaining -= deltaTime;

    if (this.shake.remaining <= 0) {
      camera.position.set(this.shake.originX, this.shake.originY, this.shake.originZ);
      this.shake = null;
      return;
    }

    const decay = this.shake.remaining / this.shake.duration;
    const offsetX = (Math.random() * 2 - 1) * this.shake.intensity * decay;
    const offsetY = (Math.random() * 2 - 1) * this.shake.intensity * decay;

    camera.position.set(
      this.shake.originX + offsetX,
      this.shake.originY + offsetY,
      this.shake.originZ,
    );
  }

  /** Reset camera to its stored origin and clear shake state. */
  cleanup(camera?: THREE.Camera): void {
    if (this.shake !== null && camera !== undefined) {
      camera.position.set(this.shake.originX, this.shake.originY, this.shake.originZ);
    }
    this.shake = null;
  }

  /** Exposed for testing only. */
  get isShaking(): boolean {
    return this.shake !== null;
  }
}
