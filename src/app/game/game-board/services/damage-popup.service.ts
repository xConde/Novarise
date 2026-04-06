import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { DAMAGE_POPUP_CONFIG } from '../constants/damage-popup.constants';

interface DamagePopup {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  age: number;
}

@Injectable()
export class DamagePopupService {
  private popups: DamagePopup[] = [];

  /**
   * Spawn a floating damage number at the given world position.
   * Color is determined by damage amount and whether it hit a shield.
   */
  spawn(
    damage: number,
    position: { x: number; y: number; z: number },
    scene: THREE.Scene,
    isShieldHit = false
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = DAMAGE_POPUP_CONFIG.canvasWidth;
    canvas.height = DAMAGE_POPUP_CONFIG.canvasHeight;

    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }

    const label = `${Math.round(damage)}`;
    const textColor = isShieldHit
      ? DAMAGE_POPUP_CONFIG.shieldColor
      : damage >= DAMAGE_POPUP_CONFIG.criticalThreshold
        ? DAMAGE_POPUP_CONFIG.criticalColor
        : DAMAGE_POPUP_CONFIG.normalColor;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${DAMAGE_POPUP_CONFIG.fontSize}px ${DAMAGE_POPUP_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = DAMAGE_POPUP_CONFIG.strokeColor;
    ctx.lineWidth = DAMAGE_POPUP_CONFIG.strokeWidth;
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
    sprite.scale.set(DAMAGE_POPUP_CONFIG.spriteScale, DAMAGE_POPUP_CONFIG.spriteScale / 2, 1);
    // Offset slightly upward and add random x jitter to prevent overlap
    const jitterX = (Math.random() - 0.5) * DAMAGE_POPUP_CONFIG.jitterRange;
    sprite.position.set(position.x + jitterX, position.y + DAMAGE_POPUP_CONFIG.spawnHeightOffset, position.z);

    scene.add(sprite);
    this.popups.push({ sprite, texture, age: 0 });
  }

  /**
   * Advance all active popups. They rise upward and fade out.
   */
  update(deltaTime: number): void {
    if (deltaTime <= 0) {
      return;
    }

    const expired: DamagePopup[] = [];
    const alive: DamagePopup[] = [];

    for (const popup of this.popups) {
      popup.age += deltaTime;

      if (popup.age >= DAMAGE_POPUP_CONFIG.lifetime) {
        expired.push(popup);
      } else {
        popup.sprite.position.y += DAMAGE_POPUP_CONFIG.riseSpeed * deltaTime;
        const remaining = 1 - popup.age / DAMAGE_POPUP_CONFIG.lifetime;
        (popup.sprite.material as THREE.SpriteMaterial).opacity = remaining;
        alive.push(popup);
      }
    }

    for (const popup of expired) {
      this.disposePopup(popup);
    }

    this.popups = alive;
  }

  /**
   * Dispose all active popups and clear.
   */
  cleanup(scene?: THREE.Scene): void {
    for (const popup of this.popups) {
      if (scene !== undefined) {
        scene.remove(popup.sprite);
      }
      this.disposePopup(popup);
    }
    this.popups = [];
  }

  get popupCount(): number {
    return this.popups.length;
  }

  private disposePopup(popup: DamagePopup): void {
    const parent = popup.sprite.parent;
    if (parent !== null) {
      parent.remove(popup.sprite);
    }
    popup.texture.dispose();
    popup.sprite.material.dispose();
  }
}
