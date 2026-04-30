import { Injectable } from '@angular/core';
import * as THREE from 'three';

export interface TextSpriteOptions {
  text: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  font: string;
  canvasWidth: number;
  canvasHeight: number;
  scaleX: number;
  scaleY: number;
}

interface PooledSprite {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  /** Texture is OWNED by the textureCache, not the sprite — DO NOT dispose here. */
  textureKey: string;
}

/**
 * Pool for label-bearing Sprites (gold popups, damage numbers, future
 * muzzle-flash labels).
 *
 * Two-layer design:
 *   1. Texture cache — keyed by `<text>|<color>|<strokeColor>|<strokeWidth>|<font>|<w>x<h>`.
 *      Identical labels (e.g. "+50g" played repeatedly) reuse the same
 *      CanvasTexture — no per-spawn canvas redraw.
 *   2. Sprite pool — released sprites go back to a free list and are
 *      reused on the next acquire(). Each pooled sprite has its own
 *      SpriteMaterial because per-instance opacity is mutated during
 *      the popup's fade-out.
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered alongside other registries in GameBoardComponent.providers.
 *
 * Disposal: dispose() releases every active sprite, disposes every
 * cached texture and pooled material. Called by
 * GameSessionService.cleanupScene() at encounter teardown.
 */
@Injectable()
export class TextSpritePoolService {
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private readonly free: PooledSprite[] = [];
  private readonly active = new Set<PooledSprite>();

  /**
   * Acquire a Sprite ready to position into the scene. The sprite is
   * preconfigured with the given text texture + scale + opacity 1.
   * Caller adds it to the scene and positions it.
   */
  acquire(opts: TextSpriteOptions): THREE.Sprite {
    const textureKey = this.makeTextureKey(opts);
    const texture = this.getOrCreateTexture(textureKey, opts);

    let pooled = this.free.pop();
    if (!pooled) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      pooled = { sprite, material, textureKey };
    } else {
      pooled.material.map = texture;
      pooled.material.transparent = true;
      pooled.material.opacity = 1;
      pooled.material.depthTest = false;
      pooled.material.needsUpdate = true;
      pooled.textureKey = textureKey;
    }

    pooled.sprite.scale.set(opts.scaleX, opts.scaleY, 1);
    this.active.add(pooled);
    return pooled.sprite;
  }

  /**
   * Return a sprite to the pool. Removes it from its parent if attached.
   * The sprite's material + texture stay pooled / cached respectively;
   * the next acquire() may re-use the material with a different texture.
   */
  release(sprite: THREE.Sprite): void {
    let target: PooledSprite | undefined;
    for (const p of this.active) {
      if (p.sprite === sprite) {
        target = p;
        break;
      }
    }
    if (!target) return;
    if (sprite.parent) sprite.parent.remove(sprite);
    this.active.delete(target);
    this.free.push(target);
  }

  /** Number of currently-acquired sprites (for instrumentation/tests). */
  activeCount(): number {
    return this.active.size;
  }

  /** Number of pooled-but-idle sprites (for instrumentation/tests). */
  freeCount(): number {
    return this.free.length;
  }

  /** Number of distinct cached textures (for instrumentation/tests). */
  textureCacheSize(): number {
    return this.textureCache.size;
  }

  /**
   * Release every active sprite, dispose every pooled material, and
   * dispose every cached texture. Called by GameSessionService.cleanupScene().
   */
  dispose(): void {
    for (const p of this.active) {
      if (p.sprite.parent) p.sprite.parent.remove(p.sprite);
      p.material.dispose();
    }
    this.active.clear();
    for (const p of this.free) {
      p.material.dispose();
    }
    this.free.length = 0;
    this.textureCache.forEach(t => t.dispose());
    this.textureCache.clear();
  }

  private makeTextureKey(opts: TextSpriteOptions): string {
    return `${opts.text}|${opts.textColor}|${opts.strokeColor}|${opts.strokeWidth}|${opts.font}|${opts.canvasWidth}x${opts.canvasHeight}`;
  }

  private getOrCreateTexture(key: string, opts: TextSpriteOptions): THREE.CanvasTexture {
    let texture = this.textureCache.get(key);
    if (texture) return texture;

    const canvas = document.createElement('canvas');
    canvas.width = opts.canvasWidth;
    canvas.height = opts.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Caller can't usefully recover; return an empty texture and cache it
      // so the failed canvas allocation doesn't repeat.
      texture = new THREE.CanvasTexture(canvas);
      this.textureCache.set(key, texture);
      return texture;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = opts.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (opts.strokeWidth > 0) {
      ctx.strokeStyle = opts.strokeColor;
      ctx.lineWidth = opts.strokeWidth;
      ctx.strokeText(opts.text, canvas.width / 2, canvas.height / 2);
    }
    ctx.fillStyle = opts.textColor;
    ctx.fillText(opts.text, canvas.width / 2, canvas.height / 2);

    texture = new THREE.CanvasTexture(canvas);
    this.textureCache.set(key, texture);
    return texture;
  }
}
