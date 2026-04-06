import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG, GROUND_EFFECT_Y, IMPACT_FLASH_CONFIG } from '../constants/combat.constants';
import { disposeMesh } from '../utils/three-utils';

/** A chain arc line that persists for a short visual duration before removal. */
export interface ChainArcEntry {
  line: THREE.Line;
  expiresAt: number;
}

/** A brief impact flash sphere that fades and disappears. */
export interface ImpactFlashEntry {
  mesh: THREE.Mesh;
  expiresAt: number;
}

/** A mortar blast zone mesh entry owned by VFX (separate from the data record in TCS). */
export interface MortarZoneMeshEntry {
  mesh: THREE.Mesh;
  expiresAt: number;
}

/**
 * Owns all visual-only Three.js objects for tower combat:
 * - Chain lightning arc lines (ChainArcEntry[])
 * - Impact flash spheres (ImpactFlashEntry[])
 * - Mortar blast zone circle meshes (MortarZoneMeshEntry[])
 *
 * Call updateVisuals() each frame to expire objects, and cleanup() on destroy/restart.
 */
@Injectable()
export class CombatVFXService {
  private chainArcs: ChainArcEntry[] = [];
  private impactFlashes: ImpactFlashEntry[] = [];
  private mortarZoneMeshes: MortarZoneMeshEntry[] = [];
  private sharedImpactFlashGeometry: THREE.SphereGeometry | null = null;

  private getImpactFlashGeometry(): THREE.SphereGeometry {
    if (!this.sharedImpactFlashGeometry) {
      this.sharedImpactFlashGeometry = new THREE.SphereGeometry(
        IMPACT_FLASH_CONFIG.radius,
        IMPACT_FLASH_CONFIG.segments,
        IMPACT_FLASH_CONFIG.segments
      );
    }
    return this.sharedImpactFlashGeometry;
  }

  /**
   * Creates a zigzag chain lightning arc line from (fromX,fromZ) to (toX,toZ) and adds it to the scene.
   * The arc expires at `gameTime + CHAIN_LIGHTNING_CONFIG.arcLifetime`.
   */
  createChainArc(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    arcColor: number,
    scene: THREE.Scene,
    gameTime: number
  ): void {
    const segs = CHAIN_LIGHTNING_CONFIG.zigzagSegments;
    const jitter = CHAIN_LIGHTNING_CONFIG.zigzagJitter;
    const arcY = GROUND_EFFECT_Y + CHAIN_LIGHTNING_CONFIG.arcHeightOffset;
    const vertices = new Float32Array((segs + 1) * 3);

    const dirX = toX - fromX;
    const dirZ = toZ - fromZ;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const perpX = -dirZ / len;
    const perpZ = dirX / len;

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const offset = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 2 * jitter;
      vertices[i * 3]     = fromX + dirX * t + perpX * offset;
      vertices[i * 3 + 1] = arcY;
      vertices[i * 3 + 2] = fromZ + dirZ * t + perpZ * offset;
    }

    const arcGeom = new THREE.BufferGeometry();
    arcGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const arcMat = new THREE.LineBasicMaterial({
      color: arcColor,
      transparent: true,
      opacity: CHAIN_LIGHTNING_CONFIG.arcOpacity
    });
    const arc = new THREE.Line(arcGeom, arcMat);
    scene.add(arc);
    this.chainArcs.push({ line: arc, expiresAt: gameTime + CHAIN_LIGHTNING_CONFIG.arcLifetime });
  }

  /**
   * Creates an impact flash sphere at (x, z) and adds it to the scene.
   * Uses a shared SphereGeometry — only the material is per-flash.
   */
  createImpactFlash(x: number, z: number, scene: THREE.Scene, gameTime: number): void {
    const geometry = this.getImpactFlashGeometry();
    const material = new THREE.MeshBasicMaterial({
      color: IMPACT_FLASH_CONFIG.color,
      transparent: true,
      opacity: IMPACT_FLASH_CONFIG.opacity
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, IMPACT_FLASH_CONFIG.spawnHeight, z);
    scene.add(mesh);
    this.impactFlashes.push({ mesh, expiresAt: gameTime + IMPACT_FLASH_CONFIG.lifetime });
  }

  /**
   * Creates a mortar blast zone circle mesh at (impactX, impactZ) and adds it to the scene.
   * Returns the mesh so TowerCombatService can correlate with its data record if needed.
   * The mesh expires at `gameTime + dotDuration`.
   */
  createMortarZoneMesh(
    impactX: number,
    impactZ: number,
    blastRadius: number,
    dotDuration: number,
    scene: THREE.Scene,
    gameTime: number
  ): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(blastRadius, MORTAR_VISUAL_CONFIG.zoneSegments);
    const material = new THREE.MeshBasicMaterial({
      color: MORTAR_VISUAL_CONFIG.zoneColor,
      transparent: true,
      opacity: MORTAR_VISUAL_CONFIG.zoneOpacity,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(impactX, GROUND_EFFECT_Y, impactZ);
    scene.add(mesh);
    this.mortarZoneMeshes.push({ mesh, expiresAt: gameTime + dotDuration });
    return mesh;
  }

  /**
   * Expires and disposes chain arcs, impact flashes, and mortar zone meshes whose
   * expiresAt has passed. Also fades impact flashes proportionally over their lifetime.
   * Call once per frame (not per physics step).
   */
  updateVisuals(gameTime: number, scene: THREE.Scene): void {
    // Expire chain arcs
    const survivingArcs: ChainArcEntry[] = [];
    for (const arc of this.chainArcs) {
      if (gameTime >= arc.expiresAt) {
        scene.remove(arc.line);
        arc.line.geometry.dispose();
        (arc.line.material as THREE.Material).dispose();
      } else {
        survivingArcs.push(arc);
      }
    }
    this.chainArcs = survivingArcs;

    // Expire and fade impact flashes (geometry is shared — only dispose material)
    const survivingFlashes: ImpactFlashEntry[] = [];
    for (const flash of this.impactFlashes) {
      if (gameTime >= flash.expiresAt) {
        scene.remove(flash.mesh);
        (flash.mesh.material as THREE.Material).dispose();
      } else {
        const remaining = flash.expiresAt - gameTime;
        const pct = remaining / IMPACT_FLASH_CONFIG.lifetime;
        (flash.mesh.material as THREE.MeshBasicMaterial).opacity = IMPACT_FLASH_CONFIG.opacity * pct;
        survivingFlashes.push(flash);
      }
    }
    this.impactFlashes = survivingFlashes;

    // Expire mortar zone meshes
    const survivingZones: MortarZoneMeshEntry[] = [];
    for (const zone of this.mortarZoneMeshes) {
      if (gameTime >= zone.expiresAt) {
        scene.remove(zone.mesh);
        disposeMesh(zone.mesh);
      } else {
        survivingZones.push(zone);
      }
    }
    this.mortarZoneMeshes = survivingZones;
  }

  /**
   * Disposes all tracked visual objects and clears the shared geometry.
   * Call from TowerCombatService.cleanup() on restart and ngOnDestroy.
   */
  cleanup(scene: THREE.Scene): void {
    for (const arc of this.chainArcs) {
      scene.remove(arc.line);
      arc.line.geometry.dispose();
      (arc.line.material as THREE.Material).dispose();
    }
    this.chainArcs = [];

    for (const flash of this.impactFlashes) {
      scene.remove(flash.mesh);
      (flash.mesh.material as THREE.Material).dispose();
    }
    this.impactFlashes = [];

    if (this.sharedImpactFlashGeometry) {
      this.sharedImpactFlashGeometry.dispose();
      this.sharedImpactFlashGeometry = null;
    }

    for (const zone of this.mortarZoneMeshes) {
      scene.remove(zone.mesh);
      disposeMesh(zone.mesh);
    }
    this.mortarZoneMeshes = [];
  }

  // ---- Test accessors ----

  getChainArcCount(): number { return this.chainArcs.length; }
  getChainArcs(): ReadonlyArray<ChainArcEntry> { return this.chainArcs; }
  getImpactFlashCount(): number { return this.impactFlashes.length; }
  getImpactFlashes(): ReadonlyArray<ImpactFlashEntry> { return this.impactFlashes; }
  getMortarZoneMeshCount(): number { return this.mortarZoneMeshes.length; }
  getSharedFlashGeometry(): THREE.SphereGeometry | null { return this.sharedImpactFlashGeometry; }
}
