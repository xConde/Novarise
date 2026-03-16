import { Injectable } from '@angular/core';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_CONFIG = {
  canvasWidth: 128,
  canvasHeight: 48,
  fontSize: 28,
  fontFamily: 'Arial',
  fontWeight: 'bold',
  /** World-unit width/height of the sprite billboard. */
  spriteWidth: 0.7,
  spriteHeight: 0.25,
  /** Y position above the tile surface. */
  yOffset: 0.45,
  /**
   * Minimum percentIncrease required to show a label.
   * Low-value labels (+3%, +4%) add visual noise on large boards.
   */
  minPercentIncrease: 8,
} as const;

const TIER_TEXT_COLORS: Record<string, string> = {
  base: '#22cc66',
  low: '#88cc22',
  medium: '#ccaa00',
  high: '#dd6600',
  critical: '#dd2200',
};

/** Fallback color for unknown tiers. */
const DEFAULT_TEXT_COLOR = '#ffffff';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Renders floating "+X%" price labels above board tiles using Three.js Sprites.
 *
 * Each sprite uses a canvas-drawn texture so we avoid importing a font loader.
 * Labels are keyed by "row-col" and managed as a pool — existing entries are
 * reused when showLabels is called again with the same key.
 */
@Injectable()
export class PriceLabelService {
  /** Active sprites. Key: "row-col". */
  private sprites: Map<string, THREE.Sprite> = new Map();

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Show price labels for all tiles that have a strategic premium (percentIncrease > 0).
   * Calls hideLabels first so the scene is always in a consistent state.
   *
   * @param priceMap Map of "row-col" → TilePriceInfo subset
   * @param boardWidth Number of columns (used for world-X centering)
   * @param boardHeight Number of rows (used for world-Z centering)
   * @param tileSize Size of each tile in world units
   * @param scene Three.js scene to add sprites to
   */
  showLabels(
    priceMap: Map<string, { percentIncrease: number; tier: string }>,
    boardWidth: number,
    boardHeight: number,
    tileSize: number,
    scene: THREE.Scene
  ): void {
    this.hideLabels(scene);

    for (const [key, info] of priceMap) {
      if (info.percentIncrease < LABEL_CONFIG.minPercentIncrease) {
        continue;
      }

      const sprite = this.createSprite(info.percentIncrease, info.tier);
      const { worldX, worldZ } = this.tileKeyToWorldPos(key, boardWidth, boardHeight, tileSize);
      sprite.position.set(worldX, LABEL_CONFIG.yOffset, worldZ);

      scene.add(sprite);
      this.sprites.set(key, sprite);
    }
  }

  /**
   * Remove all labels from the scene and dispose their GPU resources.
   * Safe to call even when no labels are active.
   */
  hideLabels(scene: THREE.Scene): void {
    for (const sprite of this.sprites.values()) {
      scene.remove(sprite);
      this.disposeSprite(sprite);
    }
    this.sprites.clear();
  }

  /**
   * Full cleanup — disposes everything and optionally removes from scene.
   * Call in ngOnDestroy.
   *
   * @param scene If provided, sprites are removed from the scene before disposal.
   */
  cleanup(scene?: THREE.Scene): void {
    if (scene !== undefined) {
      this.hideLabels(scene);
    } else {
      for (const sprite of this.sprites.values()) {
        this.disposeSprite(sprite);
      }
      this.sprites.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a Sprite for the given percentage increase and tier.
   * Canvas is 64×32 pixels; text is drawn centered.
   */
  private createSprite(percentIncrease: number, tier: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = LABEL_CONFIG.canvasWidth;
    canvas.height = LABEL_CONFIG.canvasHeight;

    const ctx = canvas.getContext('2d');
    if (ctx !== null) {
      const label = `+${percentIncrease}%`;
      const textColor = TIER_TEXT_COLORS[tier] ?? DEFAULT_TEXT_COLOR;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${LABEL_CONFIG.fontWeight} ${LABEL_CONFIG.fontSize}px ${LABEL_CONFIG.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Dark stroke for readability against the board surface.
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(label, canvas.width / 2, canvas.height / 2);

      ctx.fillStyle = textColor;
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(LABEL_CONFIG.spriteWidth, LABEL_CONFIG.spriteHeight, 1);

    return sprite;
  }

  /**
   * Parse a "row-col" key and return the world-space X/Z centre of that tile.
   * Mirrors the formula used throughout the game board:
   *   worldX = (col - boardWidth  / 2) * tileSize
   *   worldZ = (row - boardHeight / 2) * tileSize
   */
  private tileKeyToWorldPos(
    key: string,
    boardWidth: number,
    boardHeight: number,
    tileSize: number
  ): { worldX: number; worldZ: number } {
    const dashIdx = key.indexOf('-');
    const row = parseInt(key.slice(0, dashIdx), 10);
    const col = parseInt(key.slice(dashIdx + 1), 10);
    return {
      worldX: (col - boardWidth  / 2) * tileSize,
      worldZ: (row - boardHeight / 2) * tileSize,
    };
  }

  /** Dispose texture and material for a single sprite. */
  private disposeSprite(sprite: THREE.Sprite): void {
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }
}
