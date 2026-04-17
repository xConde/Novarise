import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG, GROUND_EFFECT_Y } from '../constants/combat.constants';
import { disposeMesh } from '../utils/three-utils';

/** A chain arc line that persists for a short visual duration before removal. */
export interface ChainArcEntry {
  line: THREE.Line;
  /** Real-time millisecond timestamp (performance.now()) after which the arc is removed. */
  expiresAt: number;
}

/** A mortar blast zone mesh entry owned by VFX (separate from the data record in TCS). */
export interface MortarZoneMeshEntry {
  mesh: THREE.Mesh;
  /** Turn number AFTER which the visual zone is removed. */
  expiresOnTurn: number;
}

/**
 * Owns all visual-only Three.js objects for tower combat:
 * - Chain lightning arc lines (ChainArcEntry[])
 * - Mortar blast zone circle meshes (MortarZoneMeshEntry[])
 *
 * Call updateVisuals() each frame to expire objects, and cleanup() on destroy/restart.
 */
@Injectable()
export class CombatVFXService {
  private chainArcs: ChainArcEntry[] = [];
  private mortarZoneMeshes: MortarZoneMeshEntry[] = [];

  /**
   * Creates a zigzag chain lightning arc line from (fromX,fromZ) to (toX,toZ) and adds it to the scene.
   * The arc expires after CHAIN_LIGHTNING_CONFIG.arcLifetime seconds of real wall-clock time,
   * captured internally via performance.now() — callers do NOT pass a time argument.
   */
  createChainArc(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    arcColor: number,
    scene: THREE.Scene,
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
    const now = performance.now();
    this.chainArcs.push({ line: arc, expiresAt: now + CHAIN_LIGHTNING_CONFIG.arcLifetime * 1000 });
  }

  /**
   * Creates a mortar blast zone circle mesh at (impactX, impactZ) and adds it to the scene.
   * Returns the mesh so TowerCombatService can correlate with its data record if needed.
   * The visual persists until `tickMortarZoneVisualsForTurn` expires it at turn >= currentTurn + dotDuration,
   * matching the turn-based DoT zone lifetime exactly.
   *
   * @param currentTurn The turn on which the zone is created (from CombatLoopService.getTurnNumber()).
   */
  createMortarZoneMesh(
    impactX: number,
    impactZ: number,
    blastRadius: number,
    dotDuration: number,
    scene: THREE.Scene,
    currentTurn: number,
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
    this.mortarZoneMeshes.push({ mesh, expiresOnTurn: currentTurn + dotDuration });
    return mesh;
  }

  /**
   * Expires and disposes chain arcs whose real-time wall-clock has elapsed.
   * Call once per RAF frame from game-board.component.ts.animate().
   */
  updateVisuals(scene: THREE.Scene): void {
    const now = performance.now();
    const survivingArcs: ChainArcEntry[] = [];
    for (const arc of this.chainArcs) {
      if (now >= arc.expiresAt) {
        scene.remove(arc.line);
        arc.line.geometry.dispose();
        (arc.line.material as THREE.Material).dispose();
      } else {
        survivingArcs.push(arc);
      }
    }
    this.chainArcs = survivingArcs;
  }

  /**
   * Expires and disposes mortar zone meshes whose turn count has elapsed.
   * Call once per turn after CombatLoopService.resolveTurn() completes.
   *
   * @param turnNumber The current turn number (from CombatLoopService.getTurnNumber()).
   */
  tickMortarZoneVisualsForTurn(turnNumber: number, scene: THREE.Scene): void {
    const survivingZones: MortarZoneMeshEntry[] = [];
    for (const zone of this.mortarZoneMeshes) {
      if (turnNumber >= zone.expiresOnTurn) {
        scene.remove(zone.mesh);
        disposeMesh(zone.mesh);
      } else {
        survivingZones.push(zone);
      }
    }
    this.mortarZoneMeshes = survivingZones;
  }

  /**
   * Disposes all mortar zone meshes without touching chain arcs.
   * Call from TowerCombatService.clearMortarZonesForWaveEnd() so zones from
   * wave N do not bleed into wave N+1.
   */
  clearMortarZoneMeshes(scene: THREE.Scene): void {
    for (const zone of this.mortarZoneMeshes) {
      scene.remove(zone.mesh);
      disposeMesh(zone.mesh);
    }
    this.mortarZoneMeshes = [];
  }

  /**
   * Disposes all tracked visual objects.
   * Call from TowerCombatService.cleanup() on restart and ngOnDestroy.
   */
  cleanup(scene: THREE.Scene): void {
    for (const arc of this.chainArcs) {
      scene.remove(arc.line);
      arc.line.geometry.dispose();
      (arc.line.material as THREE.Material).dispose();
    }
    this.chainArcs = [];

    for (const zone of this.mortarZoneMeshes) {
      scene.remove(zone.mesh);
      disposeMesh(zone.mesh);
    }
    this.mortarZoneMeshes = [];
  }

  // ---- Test accessors ----

  getChainArcCount(): number { return this.chainArcs.length; }
  getChainArcs(): ReadonlyArray<ChainArcEntry> { return this.chainArcs; }
  getMortarZoneMeshCount(): number { return this.mortarZoneMeshes.length; }
}
