import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { TowerType } from '@core/models/tower-type.model';
import { TowerMeshFactoryService } from '../../game/game-board/services/tower-mesh-factory.service';

/** Offscreen render size in pixels (square). */
const THUMBNAIL_SIZE = 192;

/**
 * Renders each tower type to a PNG data URL using an offscreen Three.js
 * WebGLRenderer.  Results are cached for the app lifecycle — thumbnails never
 * change at runtime so there is no encounter-bound state.
 *
 * Instantiates TowerMeshFactoryService directly (no registries needed; the
 * factory handles `undefined` registries cleanly).
 *
 * Must be providedIn:'root' because card-hand is used across the game shell
 * which lives outside any single lazy module.
 */
@Injectable({ providedIn: 'root' })
export class TowerThumbnailService implements OnDestroy {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  private readonly cache = new Map<TowerType, string>();
  private initialized = false;
  /** Set to true when WebGL init fails so we skip further attempts. */
  private initFailed = false;

  private readonly factory = new TowerMeshFactoryService();

  /** Returns a PNG data URL for the tower type, rendering on first call.
   *  Returns null if WebGL is unavailable in the current environment. */
  getThumbnail(type: TowerType): string | null {
    if (this.initFailed) return null;
    if (!this.initialized) this.init();
    if (this.initFailed) return null;

    if (!this.cache.has(type)) {
      const url = this.renderTower(type);
      if (url !== null) this.cache.set(type, url);
    }
    return this.cache.get(type) ?? null;
  }

  private init(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      this.renderer.setPixelRatio(1);
      this.renderer.setClearColor(0x000000, 0);
      // Correct output color space so materials render at intended brightness.
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = new THREE.Scene();

      // Three-point lighting tuned for the card art zone.
      // Key: warm-white from upper-right; fill: cool blue to add depth;
      // rim: faint top-back edge separation.
      const ambient = new THREE.AmbientLight(0xffffff, 0.35);

      const key = new THREE.DirectionalLight(0xfff5e0, 1.1);
      key.position.set(2.5, 4.5, 3.0);

      const fill = new THREE.DirectionalLight(0x99bbff, 0.45);
      fill.position.set(-2.5, 2.0, -1.5);

      const rim = new THREE.DirectionalLight(0xffffff, 0.25);
      rim.position.set(0, 5, -3);

      this.scene.add(ambient, key, fill, rim);

      // Camera: head-on, mid-tower height, modest elevation. The tower
      // mesh is rotated 45° around Y in renderTower() so the front-right
      // quarter faces the camera (showing barrel length + front face).
      // FOV 30° — slight telephoto, fills the canvas with the tower body.
      this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      this.camera.position.set(0, 1.4, 2.6);
      this.camera.lookAt(0, 0.7, 0);

      this.initialized = true;
    } catch {
      this.initFailed = true;
      this.disposeRenderer();
    }
  }

  private renderTower(type: TowerType): string | null {
    if (!this.renderer || !this.scene || !this.camera) return null;

    let mesh: THREE.Group | null = null;
    try {
      // Pass dummy board coords (0,0) with 1×1 board so gridToWorld returns {0,0}.
      mesh = this.factory.createTowerMesh(0, 0, type, 1, 1);
      // gridToWorld(0, 0, 1, 1) = { x: -0.5*tileSize, z: -0.5*tileSize }
      // Re-center so the tower sits at world origin for framing.
      mesh.position.set(0, 0, 0);
      // Rotate the tower so its front quarters toward the camera instead
      // of the barrel pointing straight along +Z (which foreshortens to a
      // dot on a head-on camera). 45° around Y exposes the barrel length
      // and the front-right face simultaneously — reads as "facing us."
      mesh.rotation.y = Math.PI / 4;
      this.scene.add(mesh);
      this.renderer.render(this.scene, this.camera);
      const url = this.renderer.domElement.toDataURL('image/png');
      return url;
    } catch {
      return null;
    } finally {
      if (mesh) {
        this.scene.remove(mesh);
        disposeMeshGroup(mesh);
      }
    }
  }

  ngOnDestroy(): void {
    this.disposeRenderer();
    this.cache.clear();
    this.initialized = false;
  }

  private disposeRenderer(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}

/** Traverse a Group and dispose every geometry and material found. */
function disposeMeshGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      m?.dispose();
    }
  });
}
