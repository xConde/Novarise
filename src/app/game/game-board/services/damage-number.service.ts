import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { DAMAGE_NUMBER_CONFIG, DamageNumberType } from '../constants/damage-number.constants';

interface DamageNumber {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  age: number;
}

@Injectable()
export class DamageNumberService {
  private numbers: DamageNumber[] = [];

  /**
   * Spawn a floating damage number at the given world position.
   * Older entries are evicted when the pool limit is reached.
   */
  showDamage(
    position: { x: number; y: number; z: number },
    damage: number,
    type: DamageNumberType,
    scene: THREE.Scene
  ): void {
    // Enforce pool limit by evicting the oldest entry
    if (this.numbers.length >= DAMAGE_NUMBER_CONFIG.maxActive) {
      const oldest = this.numbers.shift();
      if (oldest !== undefined) {
        this.disposeNumber(oldest);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = DAMAGE_NUMBER_CONFIG.canvasWidth;
    canvas.height = DAMAGE_NUMBER_CONFIG.canvasHeight;

    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }

    const label = `${Math.round(damage)}`;
    const textColor = DAMAGE_NUMBER_CONFIG.colors[type];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${DAMAGE_NUMBER_CONFIG.fontSize}px ${DAMAGE_NUMBER_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = DAMAGE_NUMBER_CONFIG.strokeColor;
    ctx.lineWidth = DAMAGE_NUMBER_CONFIG.strokeWidth;
    ctx.strokeText(label, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = textColor;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(DAMAGE_NUMBER_CONFIG.spriteScaleX, DAMAGE_NUMBER_CONFIG.spriteScaleY, 1);

    const jitterX = (Math.random() - 0.5) * DAMAGE_NUMBER_CONFIG.jitterRange;
    sprite.position.set(
      position.x + jitterX,
      position.y + DAMAGE_NUMBER_CONFIG.spawnHeightOffset,
      position.z
    );

    scene.add(sprite);
    this.numbers.push({ sprite, texture, age: 0 });
  }

  /**
   * Advance all active numbers each frame — rise upward and fade out over lifetime.
   */
  update(deltaTime: number): void {
    if (deltaTime <= 0) {
      return;
    }

    const expired: DamageNumber[] = [];
    const alive: DamageNumber[] = [];

    for (const num of this.numbers) {
      num.age += deltaTime;

      if (num.age >= DAMAGE_NUMBER_CONFIG.lifetime) {
        expired.push(num);
      } else {
        num.sprite.position.y += DAMAGE_NUMBER_CONFIG.speed * deltaTime;
        const remaining = 1 - num.age / DAMAGE_NUMBER_CONFIG.lifetime;
        (num.sprite.material as THREE.SpriteMaterial).opacity = remaining;
        alive.push(num);
      }
    }

    for (const num of expired) {
      this.disposeNumber(num);
    }

    this.numbers = alive;
  }

  /**
   * Dispose all active numbers and clear state.
   */
  cleanup(scene?: THREE.Scene): void {
    for (const num of this.numbers) {
      if (scene !== undefined) {
        scene.remove(num.sprite);
      }
      this.disposeNumber(num);
    }
    this.numbers = [];
  }

  get activeCount(): number {
    return this.numbers.length;
  }

  private disposeNumber(num: DamageNumber): void {
    const parent = num.sprite.parent;
    if (parent !== null) {
      parent.remove(num.sprite);
    }
    num.texture.dispose();
    num.sprite.material.dispose();
  }
}
