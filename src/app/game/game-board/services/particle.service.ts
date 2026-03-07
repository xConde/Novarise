import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { DEATH_BURST_CONFIG } from '../constants/particle.constants';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  initialScale: number;
}

@Injectable()
export class ParticleService {
  private particles: Particle[] = [];
  private sharedGeometry: THREE.SphereGeometry | null = null;

  private getSharedGeometry(): THREE.SphereGeometry {
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
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: DEATH_BURST_CONFIG.emissiveIntensity,
        roughness: DEATH_BURST_CONFIG.roughness,
        metalness: DEATH_BURST_CONFIG.metalness,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, position.z);

      const initialScale = 1 - DEATH_BURST_CONFIG.sizeVariation / 2 + Math.random() * DEATH_BURST_CONFIG.sizeVariation;
      mesh.scale.setScalar(initialScale);

      const velocity = this.randomVelocity();

      this.particles.push({ mesh, velocity, age: 0, initialScale });
    }
  }

  /**
   * Advances all active particles by deltaTime. Particles whose age exceeds
   * DEATH_BURST_CONFIG.lifetime are removed from the scene and disposed.
   *
   * @param deltaTime Seconds elapsed since last frame. Non-positive values are ignored.
   * @param scene     The Three.js scene that owns the particle meshes.
   */
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
        // Apply gravity to vertical velocity component
        particle.velocity.y += DEATH_BURST_CONFIG.gravity * deltaTime;

        particle.mesh.position.x += particle.velocity.x * deltaTime;
        particle.mesh.position.y += particle.velocity.y * deltaTime;
        particle.mesh.position.z += particle.velocity.z * deltaTime;

        // Fade out linearly over lifetime
        const progress = particle.age / DEATH_BURST_CONFIG.lifetime;
        const remaining = 1 - progress;
        const mat = particle.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = remaining;
        mat.emissiveIntensity = DEATH_BURST_CONFIG.emissiveIntensity * (1 - progress);

        // Shrink over lifetime
        const scale = particle.initialScale * (1 - progress * (1 - DEATH_BURST_CONFIG.scaleEnd));
        particle.mesh.scale.setScalar(scale);

        alive.push(particle);
      }
    }

    for (const particle of expired) {
      scene.remove(particle.mesh);
      this.disposeParticle(particle);
    }

    this.particles = alive;
  }

  /**
   * Adds all pending particles to the scene. Call this once per frame BEFORE
   * update() so newly spawned particles are visible on the same frame.
   *
   * Note: particles are not added to the scene in spawnDeathBurst() to keep
   * scene mutation centralised in the component that owns the render loop.
   * Call this method with the scene after spawning bursts.
   */
  addPendingToScene(scene: THREE.Scene): void {
    for (const particle of this.particles) {
      if (!particle.mesh.parent) {
        scene.add(particle.mesh);
      }
    }
  }

  /**
   * Disposes all active particles and clears the internal list. Call this in
   * ngOnDestroy() or when the game resets.
   */
  cleanup(scene?: THREE.Scene): void {
    for (const particle of this.particles) {
      if (scene) {
        scene.remove(particle.mesh);
      }
      this.disposeParticle(particle);
    }
    this.particles = [];

    if (this.sharedGeometry) {
      this.sharedGeometry.dispose();
      this.sharedGeometry = null;
    }
  }

  /** Returns the number of currently tracked particles (for testing). */
  get particleCount(): number {
    return this.particles.length;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private randomVelocity(): THREE.Vector3 {
    // Random direction on the unit sphere
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

  private disposeParticle(particle: Particle): void {
    // Geometry is shared — disposed in cleanup(), not per-particle
    const mat = particle.mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach(m => m.dispose());
    } else {
      mat.dispose();
    }
  }
}
