import { Injectable } from '@angular/core';
import * as THREE from 'three';

// ── Decal canvas configuration ───────────────────────────────────────────────

export type DecalKey = 'panelLines' | 'rivets' | 'ventSlats' | 'warningChevron';

const DECAL_CANVAS_CONFIG = {
  /** Side length (px) for the standard small decal canvas. */
  smallSize: 64,
  /** Side length (px) for the larger decal canvas (chevron needs more room). */
  largeSize: 128,
} as const;

const PANEL_LINE_CONFIG = {
  lineCount: 4,
  color: 'rgba(0,0,0,0.55)',
  lineWidth: 1.5,
  /** Background fill — semi-transparent dark metal. */
  bgColor: 'rgba(40,35,55,0.85)',
} as const;

const RIVET_CONFIG = {
  rows: 3,
  cols: 3,
  radius: 3,
  /** Rivet highlight (top-left specular). */
  highlightColor: 'rgba(200,190,220,0.7)',
  /** Rivet shadow (bottom-right). */
  shadowColor: 'rgba(0,0,0,0.5)',
  baseColor: 'rgba(80,70,100,0.9)',
  bgColor: 'rgba(35,30,50,0.9)',
} as const;

const VENT_SLAT_CONFIG = {
  slatCount: 5,
  slatHeight: 6,
  gap: 3,
  bgColor: 'rgba(30,25,45,0.95)',
  /** Dark face of the slat louver. */
  slatDark: 'rgba(15,12,25,0.9)',
  /** Lit face / highlight edge of the slat. */
  slatLight: 'rgba(90,80,120,0.7)',
} as const;

const CHEVRON_CONFIG = {
  stripes: 4,
  /** Warning yellow. */
  stripeColorA: 'rgba(220,180,0,0.85)',
  /** Dark gap between stripes. */
  stripeColorB: 'rgba(20,15,30,0.85)',
  bgColor: 'rgba(30,25,45,0.9)',
} as const;

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Lazily builds and caches small CanvasTexture decals shared across tower
 * mesh instances. Each decal key resolves to a single THREE.CanvasTexture
 * that is reused on every request — callers must NOT call `.dispose()` on
 * the returned texture directly; call `this.dispose()` to tear down the
 * whole library at encounter teardown.
 *
 * Scope: component-scoped (not providedIn: 'root'). Provide in GameModule
 * or GameBoardComponent.providers alongside TowerMeshFactoryService.
 */
@Injectable()
export class TowerDecalLibraryService {
  private readonly cache = new Map<DecalKey, THREE.CanvasTexture>();

  /** Return a cached texture for the given decal key, creating it on first call. */
  getDecal(key: DecalKey): THREE.CanvasTexture {
    const existing = this.cache.get(key);
    if (existing) return existing;

    const texture = this.buildDecal(key);
    this.cache.set(key, texture);
    return texture;
  }

  /** Dispose all cached textures and clear the cache. */
  dispose(): void {
    for (const texture of this.cache.values()) {
      texture.dispose();
    }
    this.cache.clear();
  }

  // ── Private builders ──────────────────────────────────────────────────────

  private buildDecal(key: DecalKey): THREE.CanvasTexture {
    switch (key) {
      case 'panelLines':    return this.buildPanelLines();
      case 'rivets':        return this.buildRivets();
      case 'ventSlats':     return this.buildVentSlats();
      case 'warningChevron': return this.buildWarningChevron();
    }
  }

  private buildPanelLines(): THREE.CanvasTexture {
    const size = DECAL_CANVAS_CONFIG.smallSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = PANEL_LINE_CONFIG.bgColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = PANEL_LINE_CONFIG.color;
    ctx.lineWidth = PANEL_LINE_CONFIG.lineWidth;

    const step = size / PANEL_LINE_CONFIG.lineCount;
    for (let i = 1; i < PANEL_LINE_CONFIG.lineCount; i++) {
      const pos = i * step;
      // Horizontal seam
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
      // Vertical seam
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }

  private buildRivets(): THREE.CanvasTexture {
    const size = DECAL_CANVAS_CONFIG.smallSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = RIVET_CONFIG.bgColor;
    ctx.fillRect(0, 0, size, size);

    const { rows, cols, radius } = RIVET_CONFIG;
    const colStep = size / (cols + 1);
    const rowStep = size / (rows + 1);

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const cx = c * colStep;
        const cy = r * rowStep;

        // Base circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = RIVET_CONFIG.baseColor;
        ctx.fill();

        // Shadow (bottom-right quadrant)
        const shadowGrad = ctx.createRadialGradient(cx + 1, cy + 1, 0, cx, cy, radius);
        shadowGrad.addColorStop(0, RIVET_CONFIG.shadowColor);
        shadowGrad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = shadowGrad;
        ctx.fill();

        // Highlight (top-left)
        const hlGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, radius);
        hlGrad.addColorStop(0, RIVET_CONFIG.highlightColor);
        hlGrad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = hlGrad;
        ctx.fill();
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  private buildVentSlats(): THREE.CanvasTexture {
    const size = DECAL_CANVAS_CONFIG.smallSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = VENT_SLAT_CONFIG.bgColor;
    ctx.fillRect(0, 0, size, size);

    const { slatCount, slatHeight, gap } = VENT_SLAT_CONFIG;
    const totalSlatBlock = slatCount * (slatHeight + gap);
    // Centre the slat block vertically
    const startY = (size - totalSlatBlock) / 2;

    for (let i = 0; i < slatCount; i++) {
      const y = startY + i * (slatHeight + gap);
      // Dark louver face
      ctx.fillStyle = VENT_SLAT_CONFIG.slatDark;
      ctx.fillRect(4, y, size - 8, slatHeight);
      // Lit edge along the bottom of each slat
      ctx.fillStyle = VENT_SLAT_CONFIG.slatLight;
      ctx.fillRect(4, y + slatHeight - 1, size - 8, 1);
    }

    return new THREE.CanvasTexture(canvas);
  }

  private buildWarningChevron(): THREE.CanvasTexture {
    const size = DECAL_CANVAS_CONFIG.largeSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = CHEVRON_CONFIG.bgColor;
    ctx.fillRect(0, 0, size, size);

    // Diagonal warning stripes (45°)
    const stripeWidth = size / (CHEVRON_CONFIG.stripes * 2);
    for (let i = -CHEVRON_CONFIG.stripes; i < CHEVRON_CONFIG.stripes * 2; i++) {
      ctx.fillStyle = i % 2 === 0
        ? CHEVRON_CONFIG.stripeColorA
        : CHEVRON_CONFIG.stripeColorB;
      ctx.beginPath();
      const x = i * stripeWidth;
      // Parallelogram: bottom-left → top-left → top-right → bottom-right
      ctx.moveTo(x, size);
      ctx.lineTo(x + size, 0);
      ctx.lineTo(x + size + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth, size);
      ctx.closePath();
      ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
  }
}
