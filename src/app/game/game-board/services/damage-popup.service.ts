import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { DAMAGE_POPUP_CONFIG } from '../constants/damage-popup.constants';
import { TextSpritePoolService } from './text-sprite-pool.service';

interface DamagePopup {
  sprite: THREE.Sprite;
  age: number;
}

@Injectable()
export class DamagePopupService {
  private popups: DamagePopup[] = [];

  constructor(
    @Optional() private readonly spritePool?: TextSpritePoolService,
  ) {}

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
    const label = `${Math.round(damage)}`;
    const textColor = isShieldHit
      ? DAMAGE_POPUP_CONFIG.shieldColor
      : damage >= DAMAGE_POPUP_CONFIG.criticalThreshold
        ? DAMAGE_POPUP_CONFIG.criticalColor
        : DAMAGE_POPUP_CONFIG.normalColor;

    const sprite = this.acquireSprite(label, textColor);
    if (!sprite) return;

    const jitterX = (Math.random() - 0.5) * DAMAGE_POPUP_CONFIG.jitterRange;
    sprite.position.set(position.x + jitterX, position.y + DAMAGE_POPUP_CONFIG.spawnHeightOffset, position.z);
    scene.add(sprite);
    this.popups.push({ sprite, age: 0 });
  }

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
      this.releasePopup(popup);
    }

    this.popups = alive;
  }

  cleanup(scene?: THREE.Scene): void {
    for (const popup of this.popups) {
      if (scene !== undefined && popup.sprite.parent === scene) {
        scene.remove(popup.sprite);
      }
      this.releasePopup(popup);
    }
    this.popups = [];
  }

  get popupCount(): number {
    return this.popups.length;
  }

  private acquireSprite(label: string, textColor: string): THREE.Sprite | null {
    if (this.spritePool) {
      return this.spritePool.acquire({
        text: label,
        textColor,
        strokeColor: DAMAGE_POPUP_CONFIG.strokeColor,
        strokeWidth: DAMAGE_POPUP_CONFIG.strokeWidth,
        font: `bold ${DAMAGE_POPUP_CONFIG.fontSize}px ${DAMAGE_POPUP_CONFIG.fontFamily}`,
        canvasWidth: DAMAGE_POPUP_CONFIG.canvasWidth,
        canvasHeight: DAMAGE_POPUP_CONFIG.canvasHeight,
        scaleX: DAMAGE_POPUP_CONFIG.spriteScale,
        scaleY: DAMAGE_POPUP_CONFIG.spriteScale / 2,
      });
    }
    return this.fallbackBuildSprite(label, textColor);
  }

  private releasePopup(popup: DamagePopup): void {
    if (this.spritePool) {
      this.spritePool.release(popup.sprite);
      return;
    }
    const parent = popup.sprite.parent;
    if (parent !== null) parent.remove(popup.sprite);
    const mat = popup.sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
  }

  private fallbackBuildSprite(label: string, textColor: string): THREE.Sprite | null {
    const canvas = document.createElement('canvas');
    canvas.width = DAMAGE_POPUP_CONFIG.canvasWidth;
    canvas.height = DAMAGE_POPUP_CONFIG.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;
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
    return sprite;
  }
}
