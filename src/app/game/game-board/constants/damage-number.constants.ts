export type DamageNumberType = 'normal' | 'splash' | 'chain' | 'critical';

export const DAMAGE_NUMBER_CONFIG = {
  /** How long each number floats before disappearing (seconds). */
  lifetime: 1.0,
  /** Upward rise speed in world units per second. */
  speed: 1.2,
  /** Maximum simultaneously active sprites — oldest evicted when limit is hit. */
  maxActive: 50,
  /** Horizontal jitter range (±half) to prevent stacking. */
  jitterRange: 0.4,
  /** Vertical offset above the hit position at spawn. */
  spawnHeightOffset: 0.6,
  /** Canvas dimensions for text rendering. */
  canvasWidth: 80,
  canvasHeight: 40,
  /** Font settings. */
  fontSize: 28,
  fontFamily: 'monospace',
  /** Text stroke for legibility against the dark scene. */
  strokeColor: '#000000',
  strokeWidth: 3,
  /** Sprite world-space scale (width, height). */
  spriteScaleX: 0.7,
  spriteScaleY: 0.35,
  /** Color per hit type. */
  colors: {
    normal: '#ffffff',
    splash: '#ffaa00',
    chain: '#00ccff',
    critical: '#ff4444',
  } as Record<DamageNumberType, string>,
} as const;
