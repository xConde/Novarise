import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, ENEMY_MESH_SEGMENTS, MINI_SWARM_STATS } from '../models/enemy.model';
import { HEALTH_BAR_CONFIG, SHIELD_BAR_CONFIG, SHIELD_VISUAL_CONFIG, ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { BOSS_CROWN_CONFIG, SHIELD_BREAK_CONFIG, WYRM_ASCENDANT_VISUAL_CONFIG } from '../constants/effects.constants';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';

@Injectable()
export class EnemyMeshFactoryService {
  constructor(
    @Optional() private readonly geometryRegistry?: GeometryRegistryService,
    @Optional() private readonly materialRegistry?: MaterialRegistryService,
  ) {}

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
      // Diamond geometry depends only on stats.size — cache per-type via registry.
      geometry = this.materialRegistry
        ? this.cachedFlyingGeometry(enemy.type, stats.size)
        : this.makeFlyingGeometry(stats.size);
      materialSide = THREE.DoubleSide;
    } else {
      geometry = this.createEnemyGeometry(enemy.type, stats.size);
    }

    const material = this.getOrCreateEnemyMaterial(enemy.type, stats.color, materialSide);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add health bar above enemy
    const barWidth = HEALTH_BAR_CONFIG.width;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = stats.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = this.plane(barWidth, barHeight);
    const bgMaterial = this.getOrCreateEffectMaterial(
      `enemy:hpBg`,
      () => new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide }),
    );
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);

    const fgGeometry = this.plane(barWidth, barHeight);
    const fgMaterial = this.getOrCreateEffectMaterial(
      `enemy:hpFg`,
      () => new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide }),
    );
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
      const shieldBgGeom = this.plane(SHIELD_BAR_CONFIG.width, SHIELD_BAR_CONFIG.height);
      const shieldBgMat = this.getOrCreateEffectMaterial(
        `enemy:shieldBg`,
        () => new THREE.MeshBasicMaterial({ color: SHIELD_BAR_CONFIG.bgColor, side: THREE.DoubleSide }),
      );
      const shieldBarBg = new THREE.Mesh(shieldBgGeom, shieldBgMat);
      shieldBarBg.position.set(0, shieldBarY, 0);

      const shieldFgGeom = this.plane(SHIELD_BAR_CONFIG.width, SHIELD_BAR_CONFIG.height);
      const shieldFgMat = this.getOrCreateEffectMaterial(
        `enemy:shieldFg`,
        () => new THREE.MeshBasicMaterial({ color: SHIELD_BAR_CONFIG.color, side: THREE.DoubleSide }),
      );
      const shieldBarFg = new THREE.Mesh(shieldFgGeom, shieldFgMat);
      shieldBarFg.position.set(0, shieldBarY + 0.001, 0);

      mesh.add(shieldBarBg);
      mesh.add(shieldBarFg);
      mesh.userData['shieldBarBg'] = shieldBarBg;
      mesh.userData['shieldBarFg'] = shieldBarFg;
    }

    if (enemy.type === EnemyType.BOSS) {
      this.createBossCrown(mesh, stats.size, stats.color);
    }

    if (enemy.type === EnemyType.WYRM_ASCENDANT) {
      this.createWyrmEyeGlow(mesh, stats.size);
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
        // Capsule has unique geometry — registry doesn't expose it; fall through to fresh.
        // CapsuleGeometry is rarely used elsewhere so the loss is small.
        return this.cachedOrFreshCapsule(type, size);

      case EnemyType.HEAVY:
        return this.box(size * 1.6, size * 1.6, size * 1.6);

      case EnemyType.SWIFT:
        return this.tet(size * 1.2, 0);

      case EnemyType.BOSS:
        return this.sphere(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);

      case EnemyType.SHIELDED:
        return this.ico(size, 0);

      case EnemyType.SWARM:
        return this.oct(size, 0);

      case EnemyType.MINER:
        return this.box(size * 1.2, size * 1.4, size * 1.2);

      case EnemyType.UNSHAKEABLE:
        return this.oct(size, 0);

      case EnemyType.VEINSEEKER:
        return this.ico(size, 0);

      case EnemyType.FLYING:
        // Defensive fallback (FLYING actually built inline in createEnemyMesh).
        return this.sphere(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);

      case EnemyType.GLIDER:
        return this.box(size * 2.4, size * 0.3, size * 1.0);

      case EnemyType.TITAN:
        return this.cyl(size * 0.9, size * 1.1, size * 1.4, 8);

      case EnemyType.WYRM_ASCENDANT:
        return this.cyl(size * 0.65, size * 0.80, size * 2.2, 10);

      case EnemyType.BASIC:
      default:
        return this.sphere(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
    }
  }

  createBossCrown(mesh: THREE.Mesh, size: number, color: number): void {
    const crownGeometry = this.geometryRegistry
      ? this.geometryRegistry.getTorus(
          size * BOSS_CROWN_CONFIG.radiusMultiplier,
          size * BOSS_CROWN_CONFIG.tubeMultiplier,
          BOSS_CROWN_CONFIG.radialSegments,
          BOSS_CROWN_CONFIG.tubularSegments,
        )
      : new THREE.TorusGeometry(
          size * BOSS_CROWN_CONFIG.radiusMultiplier,
          size * BOSS_CROWN_CONFIG.tubeMultiplier,
          BOSS_CROWN_CONFIG.radialSegments,
          BOSS_CROWN_CONFIG.tubularSegments,
        );
    const crownMaterial = this.getOrCreateEffectMaterial(
      `enemy:bossCrown:${color}`,
      () => new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: BOSS_CROWN_CONFIG.emissiveIntensity,
        roughness: BOSS_CROWN_CONFIG.roughness,
        metalness: BOSS_CROWN_CONFIG.metalness,
      }),
    );
    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = size * BOSS_CROWN_CONFIG.yOffsetMultiplier;
    crown.castShadow = true;
    mesh.add(crown);
    mesh.userData['bossCrown'] = crown;
  }

  createWyrmEyeGlow(mesh: THREE.Mesh, size: number): void {
    const eyeGeometry = this.geometryRegistry
      ? this.geometryRegistry.getTorus(
          size * WYRM_ASCENDANT_VISUAL_CONFIG.eyeRadiusMultiplier,
          size * WYRM_ASCENDANT_VISUAL_CONFIG.eyeTubeMultiplier,
          WYRM_ASCENDANT_VISUAL_CONFIG.eyeRadialSegments,
          WYRM_ASCENDANT_VISUAL_CONFIG.eyeTubularSegments,
        )
      : new THREE.TorusGeometry(
          size * WYRM_ASCENDANT_VISUAL_CONFIG.eyeRadiusMultiplier,
          size * WYRM_ASCENDANT_VISUAL_CONFIG.eyeTubeMultiplier,
          WYRM_ASCENDANT_VISUAL_CONFIG.eyeRadialSegments,
          WYRM_ASCENDANT_VISUAL_CONFIG.eyeTubularSegments,
        );
    const eyeMaterial = this.getOrCreateEffectMaterial(
      `enemy:wyrmEye`,
      () => new THREE.MeshStandardMaterial({
        color: WYRM_ASCENDANT_VISUAL_CONFIG.eyeColor,
        emissive: WYRM_ASCENDANT_VISUAL_CONFIG.eyeColor,
        emissiveIntensity: WYRM_ASCENDANT_VISUAL_CONFIG.eyeEmissiveIntensity,
        roughness: WYRM_ASCENDANT_VISUAL_CONFIG.eyeRoughness,
        metalness: WYRM_ASCENDANT_VISUAL_CONFIG.eyeMetalness,
      }),
    );
    const eyeRing = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eyeRing.position.y = size * WYRM_ASCENDANT_VISUAL_CONFIG.eyeYOffsetMultiplier;
    eyeRing.castShadow = true;
    mesh.add(eyeRing);
    mesh.userData['wyrmEyeGlow'] = eyeRing;
  }

  createShieldMesh(enemySize: number): THREE.Mesh {
    const shieldRadius = enemySize * SHIELD_VISUAL_CONFIG.radiusMultiplier;
    const shieldGeometry = this.sphere(
      shieldRadius,
      SHIELD_VISUAL_CONFIG.segments,
      SHIELD_VISUAL_CONFIG.segments,
    );
    const shieldMaterial = this.getOrCreateEffectMaterial(
      `enemy:shieldDome`,
      () => new THREE.MeshStandardMaterial({
        color: SHIELD_VISUAL_CONFIG.color,
        emissive: SHIELD_VISUAL_CONFIG.color,
        emissiveIntensity: SHIELD_VISUAL_CONFIG.emissiveIntensity,
        transparent: true,
        opacity: SHIELD_VISUAL_CONFIG.opacity,
        side: THREE.DoubleSide,
      }),
    );
    return new THREE.Mesh(shieldGeometry, shieldMaterial);
  }

  removeShieldMesh(enemy: Enemy): void {
    if (!enemy.mesh) return;
    const shieldMesh = enemy.mesh.userData['shieldMesh'] as THREE.Mesh | undefined;
    if (!shieldMesh) return;

    enemy.shieldBreaking = true;
    enemy.shieldBreakTimer = SHIELD_BREAK_CONFIG.duration;
  }

  createMiniSwarmMesh(mini: Enemy): THREE.Mesh {
    const geometry = this.oct(MINI_SWARM_STATS.size, 0);
    const material = this.getOrCreateEffectMaterial(
      `enemy:miniSwarm`,
      () => new THREE.MeshStandardMaterial({
        color: MINI_SWARM_STATS.color,
        emissive: MINI_SWARM_STATS.color,
        emissiveIntensity: ENEMY_VISUAL_CONFIG.miniSwarmEmissive,
        roughness: ENEMY_VISUAL_CONFIG.roughness,
        metalness: ENEMY_VISUAL_CONFIG.metalness,
      }),
    );

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(mini.position.x, mini.position.y, mini.position.z);
    mesh.castShadow = true;

    const barWidth = HEALTH_BAR_CONFIG.width * 0.5;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = MINI_SWARM_STATS.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = this.plane(barWidth, barHeight);
    const bgMaterial = this.getOrCreateEffectMaterial(
      `enemy:hpBg`,
      () => new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide }),
    );
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);

    const fgGeometry = this.plane(barWidth, barHeight);
    const fgMaterial = this.getOrCreateEffectMaterial(
      `enemy:hpFg`,
      () => new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide }),
    );
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    return mesh;
  }

  // ── Geometry shortcuts (registry-aware) ──────────────────────────────────

  private box(w: number, h: number, d: number): THREE.BoxGeometry {
    return this.geometryRegistry?.getBox(w, h, d) ?? new THREE.BoxGeometry(w, h, d);
  }
  private sphere(r: number, w: number, h: number): THREE.SphereGeometry {
    return this.geometryRegistry?.getSphere(r, w, h) ?? new THREE.SphereGeometry(r, w, h);
  }
  private cyl(rt: number, rb: number, h: number, segs: number): THREE.CylinderGeometry {
    return this.geometryRegistry?.getCylinder(rt, rb, h, segs) ?? new THREE.CylinderGeometry(rt, rb, h, segs);
  }
  private oct(r: number, detail: number): THREE.OctahedronGeometry {
    return this.geometryRegistry?.getOctahedron(r, detail) ?? new THREE.OctahedronGeometry(r, detail);
  }
  private ico(r: number, detail: number): THREE.IcosahedronGeometry {
    return this.geometryRegistry?.getIcosahedron(r, detail) ?? new THREE.IcosahedronGeometry(r, detail);
  }
  private tet(r: number, detail: number): THREE.TetrahedronGeometry {
    return this.geometryRegistry?.getTetrahedron(r, detail) ?? new THREE.TetrahedronGeometry(r, detail);
  }
  private plane(w: number, h: number): THREE.PlaneGeometry {
    return this.geometryRegistry?.getPlane(w, h) ?? new THREE.PlaneGeometry(w, h);
  }

  /**
   * CapsuleGeometry isn't exposed by GeometryRegistry's typed methods.
   * Use the generic getOrCreateCustom escape hatch.
   */
  private cachedOrFreshCapsule(type: EnemyType, size: number): THREE.CapsuleGeometry {
    if (!this.geometryRegistry) {
      return new THREE.CapsuleGeometry(size * 0.6, size * 1.2, 4, ENEMY_MESH_SEGMENTS);
    }
    return this.geometryRegistry.getOrCreateCustom(
      `capsule:${type}:${size.toFixed(4)}`,
      () => new THREE.CapsuleGeometry(size * 0.6, size * 1.2, 4, ENEMY_MESH_SEGMENTS),
    );
  }

  /**
   * Per-type FLYING diamond geometry via the generic registry escape hatch.
   * Diamond is a custom BufferGeometry (not a typed primitive).
   */
  private cachedFlyingGeometry(type: EnemyType, size: number): THREE.BufferGeometry {
    if (!this.geometryRegistry) {
      return this.makeFlyingGeometry(size);
    }
    return this.geometryRegistry.getOrCreateCustom(
      `diamond:${type}:${size.toFixed(4)}`,
      () => this.makeFlyingGeometry(size),
    );
  }
  private makeFlyingGeometry(size: number): THREE.BufferGeometry {
    const s = size;
    const diamondGeom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
       0,  0, -s * 2,
       s,  0,  0,
       0,  0,  s * 2,
      -s,  0,  0,
    ]);
    const indices = new Uint16Array([0, 1, 3, 1, 2, 3]);
    diamondGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    diamondGeom.setIndex(new THREE.BufferAttribute(indices, 1));
    diamondGeom.computeVertexNormals();
    return diamondGeom;
  }

  /**
   * Per-enemy-type body material. Color comes from ENEMY_STATS;
   * materialSide differs between FLYING (DoubleSide) and grounded (FrontSide).
   * Cached separately per side because that flag baked into the shader.
   */
  private getOrCreateEnemyMaterial(
    type: EnemyType,
    color: number,
    side: THREE.Side,
  ): THREE.MeshStandardMaterial {
    if (!this.materialRegistry) {
      return new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: ENEMY_VISUAL_CONFIG.baseEmissive,
        roughness: ENEMY_VISUAL_CONFIG.roughness,
        metalness: ENEMY_VISUAL_CONFIG.metalness,
        side,
      });
    }
    const sideTag = side === THREE.DoubleSide ? 'D' : 'F';
    return this.materialRegistry.getOrCreate(
      `enemy:${type}:${sideTag}`,
      () => new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: ENEMY_VISUAL_CONFIG.baseEmissive,
        roughness: ENEMY_VISUAL_CONFIG.roughness,
        metalness: ENEMY_VISUAL_CONFIG.metalness,
        side,
      }),
    );
  }

  private getOrCreateEffectMaterial<T extends THREE.Material>(
    key: string,
    factory: () => T,
  ): T {
    if (!this.materialRegistry) return factory();
    return this.materialRegistry.getOrCreate(key, factory);
  }
}
