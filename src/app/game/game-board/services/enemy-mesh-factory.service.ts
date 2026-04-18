import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, ENEMY_MESH_SEGMENTS, MINI_SWARM_STATS } from '../models/enemy.model';
import { HEALTH_BAR_CONFIG, SHIELD_BAR_CONFIG, SHIELD_VISUAL_CONFIG, ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { BOSS_CROWN_CONFIG, SHIELD_BREAK_CONFIG } from '../constants/effects.constants';

@Injectable()
export class EnemyMeshFactoryService {
  /**
   * Create a 3D mesh for an enemy.
   * FLYING enemies use a flat diamond (kite) shape made of 2 triangles,
   * rotated to lie flat in the XZ plane.
   * All other enemies get a type-specific geometry for gameplay readability.
   */
  createEnemyMesh(enemy: Enemy): THREE.Mesh {
    const stats = ENEMY_STATS[enemy.type];

    let geometry: THREE.BufferGeometry;
    let materialSide: THREE.Side = THREE.FrontSide;

    if (enemy.isFlying) {
      // Diamond: 4 vertices forming a rhombus in the XZ plane, 2 triangles
      const s = stats.size;
      const diamondGeom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
         0,  0, -s * 2,  // front tip
         s,  0,  0,      // right
         0,  0,  s * 2,  // back tip
        -s,  0,  0       // left
      ]);
      const indices = new Uint16Array([0, 1, 3, 1, 2, 3]);
      diamondGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      diamondGeom.setIndex(new THREE.BufferAttribute(indices, 1));
      diamondGeom.computeVertexNormals();
      geometry = diamondGeom;
      materialSide = THREE.DoubleSide;
    } else {
      geometry = this.createEnemyGeometry(enemy.type, stats.size);
    }

    const material = new THREE.MeshStandardMaterial({
      color: stats.color,
      emissive: stats.color,
      emissiveIntensity: ENEMY_VISUAL_CONFIG.baseEmissive,
      roughness: ENEMY_VISUAL_CONFIG.roughness,
      metalness: ENEMY_VISUAL_CONFIG.metalness,
      side: materialSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add health bar above enemy
    const barWidth = HEALTH_BAR_CONFIG.width;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = stats.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);

    const fgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    // Add shield visual for SHIELDED enemies (dome mesh + shield HP bar)
    if (enemy.type === EnemyType.SHIELDED && enemy.shield !== undefined && enemy.shield > 0) {
      const shieldMesh = this.createShieldMesh(stats.size);
      mesh.add(shieldMesh);
      mesh.userData['shieldMesh'] = shieldMesh;

      // Shield HP bar stacked above the health bar so absorbed damage is visible.
      const shieldBarY = barY + SHIELD_BAR_CONFIG.yOffsetAboveHealth;
      const shieldBgGeom = new THREE.PlaneGeometry(SHIELD_BAR_CONFIG.width, SHIELD_BAR_CONFIG.height);
      const shieldBgMat = new THREE.MeshBasicMaterial({ color: SHIELD_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
      const shieldBarBg = new THREE.Mesh(shieldBgGeom, shieldBgMat);
      shieldBarBg.position.set(0, shieldBarY, 0);

      const shieldFgGeom = new THREE.PlaneGeometry(SHIELD_BAR_CONFIG.width, SHIELD_BAR_CONFIG.height);
      const shieldFgMat = new THREE.MeshBasicMaterial({ color: SHIELD_BAR_CONFIG.color, side: THREE.DoubleSide });
      const shieldBarFg = new THREE.Mesh(shieldFgGeom, shieldFgMat);
      shieldBarFg.position.set(0, shieldBarY + 0.001, 0);

      mesh.add(shieldBarBg);
      mesh.add(shieldBarFg);
      mesh.userData['shieldBarBg'] = shieldBarBg;
      mesh.userData['shieldBarFg'] = shieldBarFg;
    }

    // Add crown ring for BOSS enemies
    if (enemy.type === EnemyType.BOSS) {
      this.createBossCrown(mesh, stats.size, stats.color);
    }

    return mesh;
  }

  /**
   * Create type-specific geometry for each enemy.
   * Each type gets a distinct silhouette for gameplay readability.
   */
  createEnemyGeometry(type: EnemyType, size: number): THREE.BufferGeometry {
    switch (type) {
      case EnemyType.FAST:
        // Elongated capsule — streamlined for speed
        return new THREE.CapsuleGeometry(size * 0.6, size * 1.2, 4, ENEMY_MESH_SEGMENTS);

      case EnemyType.HEAVY:
        // Chunky cube — blocky and tanky
        return new THREE.BoxGeometry(size * 1.6, size * 1.6, size * 1.6);

      case EnemyType.SWIFT:
        // Tetrahedron — angular, darting
        return new THREE.TetrahedronGeometry(size * 1.2, 0);

      case EnemyType.BOSS: {
        // Large sphere merged with torus crown for imposing look
        // Use sphere as base — the crown ring is added as a child mesh in createBossCrown()
        return new THREE.SphereGeometry(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
      }

      case EnemyType.SHIELDED:
        // Icosahedron — faceted, armored look
        return new THREE.IcosahedronGeometry(size, 0);

      case EnemyType.SWARM:
        // Octahedron — compact, gem-like
        return new THREE.OctahedronGeometry(size, 0);

      case EnemyType.MINER:
        // Chunky squat box — wider and taller than HEAVY, earthy and bulldozing
        return new THREE.BoxGeometry(size * 1.2, size * 1.4, size * 1.2);

      case EnemyType.UNSHAKEABLE:
        // Faceted octahedron — rock-like silhouette, distinct from the cubic HEAVY
        return new THREE.OctahedronGeometry(size, 0);

      case EnemyType.VEINSEEKER:
        // Icosahedron (detail=0) — spiky crystalline-vein silhouette, distinct from
        // SHIELDED (also icosahedron but with shield dome overlay). At detail=0 the
        // 20 triangular faces read as angular and threatening, fitting a boss-variant.
        return new THREE.IcosahedronGeometry(size, 0);

      case EnemyType.FLYING:
        // Diamond geometry is built inline in createEnemyMesh for flying enemies;
        // this branch is a safety fallback and should never be reached at runtime.
        return new THREE.SphereGeometry(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);

      case EnemyType.GLIDER:
        // Sprint 37 — flat wing-like silhouette: thin wide box that reads as aerodynamic
        // and low-profile, visually distinct from ground threats and flying diamond.
        return new THREE.BoxGeometry(size * 2.4, size * 0.3, size * 1.0);

      case EnemyType.TITAN:
        // Sprint 38 — wide heavy cylinder: imposing bulk reads as elite / armored.
        // Distinct from BOSS sphere and UNSHAKEABLE octahedron.
        return new THREE.CylinderGeometry(size * 0.9, size * 1.1, size * 1.4, 8);

      case EnemyType.BASIC:
      default:
        // Standard sphere
        return new THREE.SphereGeometry(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
    }
  }

  /**
   * Create and attach a torus crown ring to the Boss enemy mesh.
   * Called after the mesh is created to add the distinctive crown.
   */
  createBossCrown(mesh: THREE.Mesh, size: number, color: number): void {
    const crownGeometry = new THREE.TorusGeometry(
      size * BOSS_CROWN_CONFIG.radiusMultiplier,
      size * BOSS_CROWN_CONFIG.tubeMultiplier,
      BOSS_CROWN_CONFIG.radialSegments,
      BOSS_CROWN_CONFIG.tubularSegments
    );
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: BOSS_CROWN_CONFIG.emissiveIntensity,
      roughness: BOSS_CROWN_CONFIG.roughness,
      metalness: BOSS_CROWN_CONFIG.metalness
    });
    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = size * BOSS_CROWN_CONFIG.yOffsetMultiplier;
    crown.castShadow = true;
    mesh.add(crown);
    mesh.userData['bossCrown'] = crown;
  }

  /**
   * Create a semi-transparent sphere to represent the active shield.
   */
  createShieldMesh(enemySize: number): THREE.Mesh {
    const shieldRadius = enemySize * SHIELD_VISUAL_CONFIG.radiusMultiplier;
    const shieldGeometry = new THREE.SphereGeometry(
      shieldRadius,
      SHIELD_VISUAL_CONFIG.segments,
      SHIELD_VISUAL_CONFIG.segments
    );
    const shieldMaterial = new THREE.MeshStandardMaterial({
      color: SHIELD_VISUAL_CONFIG.color,
      emissive: SHIELD_VISUAL_CONFIG.color,
      emissiveIntensity: SHIELD_VISUAL_CONFIG.emissiveIntensity,
      transparent: true,
      opacity: SHIELD_VISUAL_CONFIG.opacity,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(shieldGeometry, shieldMaterial);
  }

  /**
   * Start the shield break animation when shield HP reaches 0.
   * The dome scales up and fades out over SHIELD_BREAK_CONFIG.duration seconds.
   * Actual disposal happens in EnemyService.updateShieldBreakAnimations() when the
   * timer expires.
   */
  removeShieldMesh(enemy: Enemy): void {
    if (!enemy.mesh) return;
    const shieldMesh = enemy.mesh.userData['shieldMesh'] as THREE.Mesh | undefined;
    if (!shieldMesh) return;

    enemy.shieldBreaking = true;
    enemy.shieldBreakTimer = SHIELD_BREAK_CONFIG.duration;
  }

  /**
   * Create a scaled-down mesh for a mini-swarm enemy.
   * Uses MINI_SWARM_STATS directly rather than ENEMY_STATS to produce the smaller visual.
   */
  createMiniSwarmMesh(mini: Enemy): THREE.Mesh {
    const geometry = new THREE.OctahedronGeometry(MINI_SWARM_STATS.size, 0);
    const material = new THREE.MeshStandardMaterial({
      color: MINI_SWARM_STATS.color,
      emissive: MINI_SWARM_STATS.color,
      emissiveIntensity: ENEMY_VISUAL_CONFIG.miniSwarmEmissive,
      roughness: ENEMY_VISUAL_CONFIG.roughness,
      metalness: ENEMY_VISUAL_CONFIG.metalness,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(mini.position.x, mini.position.y, mini.position.z);
    mesh.castShadow = true;

    // Small health bar
    const barWidth = HEALTH_BAR_CONFIG.width * 0.5;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = MINI_SWARM_STATS.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);

    const fgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    return mesh;
  }
}
