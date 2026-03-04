import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { PATH_LINE_CONFIG } from '../constants/path.constants';

@Injectable()
export class PathVisualizationService {
  private pathLine: THREE.Line | null = null;
  private pathGeometry: THREE.BufferGeometry | null = null;
  private pathMaterial: THREE.LineDashedMaterial | null = null;

  /**
   * Creates a dashed line along the given path and adds it to the scene.
   * If a line already exists it is removed and disposed before creating a new one.
   */
  showPath(path: { x: number; z: number }[], scene: THREE.Scene): void {
    this.removeLine(scene);
    this.disposeResources();

    const points = path.map(
      (p) => new THREE.Vector3(p.x, PATH_LINE_CONFIG.yOffset, p.z)
    );

    this.pathGeometry = new THREE.BufferGeometry().setFromPoints(points);
    this.pathMaterial = new THREE.LineDashedMaterial({
      color: PATH_LINE_CONFIG.color,
      dashSize: PATH_LINE_CONFIG.dashSize,
      gapSize: PATH_LINE_CONFIG.gapSize,
      linewidth: PATH_LINE_CONFIG.lineWidth,
      transparent: true,
      opacity: PATH_LINE_CONFIG.opacity,
    });

    this.pathLine = new THREE.Line(this.pathGeometry, this.pathMaterial);
    // computeLineDistances is required for LineDashedMaterial to render dashes
    this.pathLine.computeLineDistances();

    scene.add(this.pathLine);
  }

  /**
   * Removes the path line from the scene and disposes the underlying resources.
   * Safe to call even if showPath has never been called.
   */
  hidePath(scene: THREE.Scene): void {
    this.removeLine(scene);
    this.disposeResources();
  }

  /**
   * Disposes geometry and material, nulls all references.
   * Must be called in ngOnDestroy to prevent GPU memory leaks.
   */
  cleanup(): void {
    this.disposeResources();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private removeLine(scene: THREE.Scene): void {
    if (this.pathLine) {
      scene.remove(this.pathLine);
    }
  }

  private disposeResources(): void {
    if (this.pathGeometry) {
      this.pathGeometry.dispose();
      this.pathGeometry = null;
    }
    if (this.pathMaterial) {
      this.pathMaterial.dispose();
      this.pathMaterial = null;
    }
    this.pathLine = null;
  }
}
