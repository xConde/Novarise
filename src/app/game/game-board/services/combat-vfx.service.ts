import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG, GROUND_EFFECT_Y } from '../constants/combat.constants';
import { VfxPoolService } from './vfx-pool.service';

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
 * Phase B sprint 18: visual primitives are acquired from VfxPoolService
 * (which itself routes shared resources through MaterialRegistry +
 * GeometryRegistry) instead of allocating fresh per call.
 *
 * Call updateVisuals() each frame to expire arcs.
 * Call tickMortarZoneVisualsForTurn() each turn to expire zones.
 * Call cleanup() on destroy/restart.
 */
@Injectable()
export class CombatVFXService {
  private chainArcs: ChainArcEntry[] = [];
  private mortarZoneMeshes: MortarZoneMeshEntry[] = [];

  constructor(@Optional() private readonly vfxPool?: VfxPoolService) {}

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
    const vertexCount = segs + 1;

    const dirX = toX - fromX;
    const dirZ = toZ - fromZ;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const perpX = -dirZ / len;
    const perpZ = dirX / len;

    const writeArcVertices = (positions: Float32Array): void => {
      for (let i = 0; i < vertexCount; i++) {
        const t = i / segs;
        const offset = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 2 * jitter;
        positions[i * 3]     = fromX + dirX * t + perpX * offset;
        positions[i * 3 + 1] = arcY;
        positions[i * 3 + 2] = fromZ + dirZ * t + perpZ * offset;
      }
    };

    let line: THREE.Line;
    if (this.vfxPool) {
      const acquired = this.vfxPool.acquireArc(vertexCount, arcColor, CHAIN_LIGHTNING_CONFIG.arcOpacity);
      writeArcVertices(acquired.positions);
      acquired.markPositionsDirty();
      line = acquired.line;
    } else {
      // Fallback for flat test beds without VfxPool.
      const positions = new Float32Array(vertexCount * 3);
      writeArcVertices(positions);
      const arcGeom = new THREE.BufferGeometry();
      arcGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const arcMat = new THREE.LineBasicMaterial({
        color: arcColor,
        transparent: true,
        opacity: CHAIN_LIGHTNING_CONFIG.arcOpacity,
      });
      line = new THREE.Line(arcGeom, arcMat);
    }

    scene.add(line);
    const now = performance.now();
    this.chainArcs.push({ line, expiresAt: now + CHAIN_LIGHTNING_CONFIG.arcLifetime * 1000 });
  }

  /**
   * Creates a mortar blast zone circle mesh at (impactX, impactZ) and adds it to the scene.
   */
  createMortarZoneMesh(
    impactX: number,
    impactZ: number,
    blastRadius: number,
    dotDuration: number,
    scene: THREE.Scene,
    currentTurn: number,
  ): THREE.Mesh {
    let mesh: THREE.Mesh;
    if (this.vfxPool) {
      mesh = this.vfxPool.acquireZone(
        blastRadius,
        MORTAR_VISUAL_CONFIG.zoneSegments,
        MORTAR_VISUAL_CONFIG.zoneColor,
        MORTAR_VISUAL_CONFIG.zoneOpacity,
      );
    } else {
      const geometry = new THREE.CircleGeometry(blastRadius, MORTAR_VISUAL_CONFIG.zoneSegments);
      const material = new THREE.MeshBasicMaterial({
        color: MORTAR_VISUAL_CONFIG.zoneColor,
        transparent: true,
        opacity: MORTAR_VISUAL_CONFIG.zoneOpacity,
        side: THREE.DoubleSide,
      });
      mesh = new THREE.Mesh(geometry, material);
    }
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(impactX, GROUND_EFFECT_Y, impactZ);
    scene.add(mesh);
    this.mortarZoneMeshes.push({ mesh, expiresOnTurn: currentTurn + dotDuration });
    return mesh;
  }

  /**
   * Expires chain arcs whose real-time wall-clock has elapsed.
   * Pool-owned arcs release back to the pool; fallback-allocated arcs
   * dispose their geometry + material individually.
   */
  updateVisuals(scene: THREE.Scene): void {
    const now = performance.now();
    const survivingArcs: ChainArcEntry[] = [];
    for (const arc of this.chainArcs) {
      if (now >= arc.expiresAt) {
        scene.remove(arc.line);
        this.releaseArc(arc.line);
      } else {
        survivingArcs.push(arc);
      }
    }
    this.chainArcs = survivingArcs;
  }

  /**
   * Expires mortar zone meshes whose turn count has elapsed.
   */
  tickMortarZoneVisualsForTurn(turnNumber: number, scene: THREE.Scene): void {
    const survivingZones: MortarZoneMeshEntry[] = [];
    for (const zone of this.mortarZoneMeshes) {
      if (turnNumber >= zone.expiresOnTurn) {
        scene.remove(zone.mesh);
        this.releaseZone(zone.mesh);
      } else {
        survivingZones.push(zone);
      }
    }
    this.mortarZoneMeshes = survivingZones;
  }

  /**
   * Disposes all mortar zone meshes without touching chain arcs.
   * Call from TowerCombatService.clearMortarZonesForWaveEnd().
   */
  clearMortarZoneMeshes(scene: THREE.Scene): void {
    for (const zone of this.mortarZoneMeshes) {
      scene.remove(zone.mesh);
      this.releaseZone(zone.mesh);
    }
    this.mortarZoneMeshes = [];
  }

  /**
   * Disposes all tracked visual objects. Call from TowerCombatService.cleanup().
   * Pool itself is disposed separately by GameSessionService.cleanupScene().
   */
  cleanup(scene: THREE.Scene): void {
    for (const arc of this.chainArcs) {
      scene.remove(arc.line);
      this.releaseArc(arc.line);
    }
    this.chainArcs = [];

    for (const zone of this.mortarZoneMeshes) {
      scene.remove(zone.mesh);
      this.releaseZone(zone.mesh);
    }
    this.mortarZoneMeshes = [];
  }

  // ---- Internals ----

  private releaseArc(line: THREE.Line): void {
    if (this.vfxPool) {
      this.vfxPool.releaseArc(line);
      return;
    }
    line.geometry.dispose();
    const m = line.material as THREE.Material | THREE.Material[];
    if (Array.isArray(m)) m.forEach(x => x.dispose()); else m.dispose();
  }

  private releaseZone(mesh: THREE.Mesh): void {
    if (this.vfxPool) {
      this.vfxPool.releaseZone(mesh);
      return;
    }
    mesh.geometry.dispose();
    const m = mesh.material as THREE.Material | THREE.Material[];
    if (Array.isArray(m)) m.forEach(x => x.dispose()); else m.dispose();
  }

  // ---- Test accessors ----

  getChainArcCount(): number { return this.chainArcs.length; }
  getChainArcs(): ReadonlyArray<ChainArcEntry> { return this.chainArcs; }
  getMortarZoneMeshCount(): number { return this.mortarZoneMeshes.length; }
}
