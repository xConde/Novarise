import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { GOLD_POPUP_CONFIG } from '../constants/effects.constants';
import { TextSpritePoolService } from './text-sprite-pool.service';

interface GoldPopup {
  sprite: THREE.Sprite;
  age: number;
}

@Injectable()
export class GoldPopupService {
  private popups: GoldPopup[] = [];

  constructor(
    @Optional() private readonly spritePool?: TextSpritePoolService,
  ) {}

  /**
   * Spawn a floating "+Xg" text sprite at the given world position.
   * The sprite is added to the scene immediately.
   */
  spawn(amount: number, position: { x: number; y: number; z: number }, scene: THREE.Scene): void {
    const label = `+${amount}g`;
    const sprite = this.acquireSprite(label);
    if (!sprite) return;

    sprite.position.set(position.x, position.y, position.z);
    scene.add(sprite);
    this.popups.push({ sprite, age: 0 });
  }

  /**
   * Advance all active popups. Popups rise upward and fade out over their
   * lifetime. Expired popups are returned to the sprite pool (if present)
   * or disposed individually as a fallback.
   *
   * @param deltaTime Seconds elapsed since the last frame. Non-positive values are ignored.
   */
  update(deltaTime: number): void {
    if (deltaTime <= 0) {
      return;
    }

    const expired: GoldPopup[] = [];
    const alive: GoldPopup[] = [];

    for (const popup of this.popups) {
      popup.age += deltaTime;

      if (popup.age >= GOLD_POPUP_CONFIG.lifetime) {
        expired.push(popup);
      } else {
        popup.sprite.position.y += GOLD_POPUP_CONFIG.riseSpeed * deltaTime;

        const remaining = 1 - popup.age / GOLD_POPUP_CONFIG.lifetime;
        (popup.sprite.material as THREE.SpriteMaterial).opacity = remaining;

        alive.push(popup);
      }
    }

    for (const popup of expired) {
      this.releasePopup(popup);
    }

    this.popups = alive;
  }

  /**
   * Dispose all active popups and clear the internal list.
   * Call this in ngOnDestroy() or when the game resets.
   *
   * Pool-owned sprites release back to the pool (the pool itself disposes
   * them in its own dispose()). Sprites without a pool fall back to
   * per-popup material disposal.
   */
  cleanup(scene?: THREE.Scene): void {
    for (const popup of this.popups) {
      if (scene !== undefined && popup.sprite.parent === scene) {
        scene.remove(popup.sprite);
      }
      this.releasePopup(popup);
    }
    this.popups = [];
  }

  /** Returns the number of currently tracked popups (for testing). */
  get popupCount(): number {
    return this.popups.length;
  }

  private acquireSprite(label: string): THREE.Sprite | null {
    if (this.spritePool) {
      return this.spritePool.acquire({
        text: label,
        textColor: GOLD_POPUP_CONFIG.textColor,
        strokeColor: GOLD_POPUP_CONFIG.strokeColor,
        strokeWidth: GOLD_POPUP_CONFIG.strokeWidth,
        font: `bold ${GOLD_POPUP_CONFIG.fontSize}px ${GOLD_POPUP_CONFIG.fontFamily}`,
        canvasWidth: GOLD_POPUP_CONFIG.canvasWidth,
        canvasHeight: GOLD_POPUP_CONFIG.canvasHeight,
        scaleX: GOLD_POPUP_CONFIG.spriteScale,
        scaleY: GOLD_POPUP_CONFIG.spriteScale / 2,
      });
    }
    // Fallback for flat test beds without TextSpritePool — mirrors the
    // pre-Phase-B allocation pattern.
    return this.fallbackBuildSprite(label);
  }

  private releasePopup(popup: GoldPopup): void {
    if (this.spritePool) {
      this.spritePool.release(popup.sprite);
      return;
    }
    // Fallback: dispose per-popup texture + material.
    const parent = popup.sprite.parent;
    if (parent !== null) parent.remove(popup.sprite);
    const mat = popup.sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
  }

  private fallbackBuildSprite(label: string): THREE.Sprite | null {
    const canvas = document.createElement('canvas');
    canvas.width = GOLD_POPUP_CONFIG.canvasWidth;
    canvas.height = GOLD_POPUP_CONFIG.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${GOLD_POPUP_CONFIG.fontSize}px ${GOLD_POPUP_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = GOLD_POPUP_CONFIG.strokeColor;
    ctx.lineWidth = GOLD_POPUP_CONFIG.strokeWidth;
    ctx.strokeText(label, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = GOLD_POPUP_CONFIG.textColor;
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(GOLD_POPUP_CONFIG.spriteScale, GOLD_POPUP_CONFIG.spriteScale / 2, 1);
    return sprite;
  }
}
