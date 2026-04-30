import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { DEATH_BURST_CONFIG } from '../constants/particle.constants';
import { GeometryRegistryService } from './geometry-registry.service';

interface Particle {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  age: number;
  initialScale: number;
}

/**
 * Death-burst particle system.
 *
 * Phase B sprint 19: per-particle MeshStandardMaterial allocation
 * eliminated via a private free-list pool. Materials are reset
 * (color, emissive, opacity, transparent) on each acquire so a single
 * pooled instance can serve any burst color. Sphere geometry is shared
 * via GeometryRegistry when available (component-scoped); otherwise the
 * service keeps its private singleton.
 *
 * Per-particle emissive/opacity is mutated during update() to drive the
 * fade animation — that's why we pool one material per particle rather
 * than sharing one per color (which would merge fade timelines across
 * bursts of identical color).
 *
 * Phase E sprint 54 will replace this with THREE.Points + custom shader
 * for one-draw-call per burst.
 */
@Injectable()
export class ParticleService {
  private particles: Particle[] = [];
  private sharedGeometry: THREE.SphereGeometry | null = null;

  /** Pool of free (recyclable) MeshStandardMaterial instances. */
  private readonly freeMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(
    @Optional() private readonly geometryRegistry?: GeometryRegistryService,
  ) {}

  private getSharedGeometry(): THREE.SphereGeometry {
    if (this.geometryRegistry) {
      return this.geometryRegistry.getSphere(DEATH_BURST_CONFIG.radius, 4, 4);
    }
    if (!this.sharedGeometry) {
      this.sharedGeometry = new THREE.SphereGeometry(DEATH_BURST_CONFIG.radius, 4, 4);
    }
    return this.sharedGeometry;
  }

  /**
   * Spawns a burst of particles at the given world position, using the provided
   * hex color. Particles are added to the scene immediately.
   */
  spawnDeathBurst(
    position: { x: number; y: number; z: number },
    color: number,
    count: number = DEATH_BURST_CONFIG.defaultCount
  ): void {
    const geometry = this.getSharedGeometry();
    for (let i = 0; i < count; i++) {
      const material = this.acquireMaterial(color);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, position.z);

      const initialScale = 1 - DEATH_BURST_CONFIG.sizeVariation / 2 + Math.random() * DEATH_BURST_CONFIG.sizeVariation;
      mesh.scale.setScalar(initialScale);

      const velocity = this.randomVelocity();

      this.particles.push({ mesh, material, velocity, age: 0, initialScale });
    }
  }

  update(deltaTime: number, scene: THREE.Scene): void {
    if (deltaTime <= 0) {
      return;
    }

    const expired: Particle[] = [];
    const alive: Particle[] = [];

    for (const particle of this.particles) {
      particle.age += deltaTime;

      if (particle.age >= DEATH_BURST_CONFIG.lifetime) {
        expired.push(particle);
      } else {
        particle.velocity.y += DEATH_BURST_CONFIG.gravity * deltaTime;

        particle.mesh.position.x += particle.velocity.x * deltaTime;
        particle.mesh.position.y += particle.velocity.y * deltaTime;
        particle.mesh.position.z += particle.velocity.z * deltaTime;

        const progress = particle.age / DEATH_BURST_CONFIG.lifetime;
        const remaining = 1 - progress;
        particle.material.opacity = remaining;
        particle.material.emissiveIntensity = DEATH_BURST_CONFIG.emissiveIntensity * (1 - progress);

        const scale = particle.initialScale * (1 - progress * (1 - DEATH_BURST_CONFIG.scaleEnd));
        particle.mesh.scale.setScalar(scale);

        alive.push(particle);
      }
    }

    for (const particle of expired) {
      scene.remove(particle.mesh);
      this.releaseParticle(particle);
    }

    this.particles = alive;
  }

  addPendingToScene(scene: THREE.Scene): void {
    for (const particle of this.particles) {
      if (!particle.mesh.parent) {
        scene.add(particle.mesh);
      }
    }
  }

  cleanup(scene?: THREE.Scene): void {
    for (const particle of this.particles) {
      if (scene) {
        scene.remove(particle.mesh);
      }
      this.releaseParticle(particle);
    }
    this.particles = [];

    // Drain the free pool — final disposal at encounter teardown.
    for (const mat of this.freeMaterials) {
      mat.dispose();
    }
    this.freeMaterials.length = 0;

    // Geometry: only dispose if we own it (no registry). Registry path is
    // disposed by GeometryRegistry.dispose() in GameSessionService.cleanupScene.
    if (this.sharedGeometry && !this.geometryRegistry) {
      this.sharedGeometry.dispose();
    }
    this.sharedGeometry = null;
  }

  get particleCount(): number {
    return this.particles.length;
  }

  /** Pool size accessor for tests / instrumentation. */
  freeMaterialCount(): number {
    return this.freeMaterials.length;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private acquireMaterial(color: number): THREE.MeshStandardMaterial {
    let mat = this.freeMaterials.pop();
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: DEATH_BURST_CONFIG.emissiveIntensity,
        roughness: DEATH_BURST_CONFIG.roughness,
        metalness: DEATH_BURST_CONFIG.metalness,
        transparent: true,
        opacity: 1,
      });
    } else {
      mat.color.setHex(color);
      mat.emissive.setHex(color);
      mat.emissiveIntensity = DEATH_BURST_CONFIG.emissiveIntensity;
      mat.roughness = DEATH_BURST_CONFIG.roughness;
      mat.metalness = DEATH_BURST_CONFIG.metalness;
      mat.transparent = true;
      mat.opacity = 1;
      mat.needsUpdate = true;
    }
    return mat;
  }

  private releaseParticle(particle: Particle): void {
    this.freeMaterials.push(particle.material);
  }

  private randomVelocity(): THREE.Vector3 {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed =
      DEATH_BURST_CONFIG.minSpeed +
      Math.random() * (DEATH_BURST_CONFIG.maxSpeed - DEATH_BURST_CONFIG.minSpeed);

    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed
    );
  }
}
