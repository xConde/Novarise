import { StatusEffectType } from './status-effect.constants';
import { TowerType } from '../models/tower.model';

export const STATUS_EFFECT_VISUAL_CONFIG = {
  maxParticlesPerEnemy: 3,
  particleSize: 0.08,
  burn: {
    color: 0xff6600,
    emissive: 0xff4400,
    speed: 1.5,       // upward drift speed
    spread: 0.15,     // horizontal random spread
    lifetime: 0.6,    // seconds before respawn at base
  },
  poison: {
    color: 0x44ff44,
    emissive: 0x22cc22,
    speed: 0.5,       // slow outward drift
    spread: 0.2,
    lifetime: 0.8,
  },
  slow: {
    color: 0x88ccff,
    emissive: 0x4488cc,
    speed: 0.3,       // subtle downward drift
    spread: 0.1,
    lifetime: 1.0,
  },
} as const;

export const STATUS_EFFECT_VISUALS: Record<StatusEffectType, { emissiveColor: number; emissiveIntensity: number }> = {
  [StatusEffectType.SLOW]: { emissiveColor: 0x4488ff, emissiveIntensity: 0.7 },
  [StatusEffectType.BURN]: { emissiveColor: 0xff6622, emissiveIntensity: 0.9 },
  [StatusEffectType.POISON]: { emissiveColor: 0x44ff22, emissiveIntensity: 0.7 },
};

/** Priority order for resolving which visual takes precedence when multiple effects active */
export const STATUS_EFFECT_PRIORITY: StatusEffectType[] = [
  StatusEffectType.BURN,
  StatusEffectType.POISON,
  StatusEffectType.SLOW,
];

export const SCREEN_SHAKE_CONFIG = {
  bossHitIntensity: 0.15,
  bossHitDuration: 0.2,
  lifeLossIntensity: 0.3,
  lifeLossDuration: 0.4,
} as const;

export const GOLD_POPUP_CONFIG = {
  riseSpeed: 2,      // units per second upward
  lifetime: 1.0,     // seconds before removal
  fontSize: 48,      // canvas text size
  fontFamily: 'monospace',
  textColor: '#FFD700',
  strokeColor: '#000000',
  strokeWidth: 3,
  canvasWidth: 128,
  canvasHeight: 64,
  spriteScale: 0.8,
} as const;

export const TOWER_UPGRADE_VISUAL_CONFIG = {
  /** Scale multiplier per tower level: level 1 = 1.0, level 2 = 1.15, level 3 = 1.3 */
  scalePerLevel: [1.0, 1.15, 1.3] as readonly number[],
  /** Flash sprite settings */
  flash: {
    color: 0xffffff,
    opacity: 0.8,
    size: 1.5,
    duration: 0.3,
  },
  /** Base glow ring settings */
  glowRing: {
    innerRadius: 0.3,
    outerRadius: 0.5,
    color: 0x8a5cf6,
    opacity: 0.4,
    segments: 32,
  },
} as const;

export const TOWER_ANIM_CONFIG = {
  /** Basic crystal float: vertical bobbing */
  crystalBobSpeed: 2.0,
  crystalBobAmplitude: 0.05,
  crystalBaseY: 1.35,

  /** Slow crystal rotation speed (radians/sec) */
  slowCrystalRotSpeed: 1.5,
  slowCrystalBaseY: 0.82,
  slowCrystalBobAmplitude: 0.03,

  /** Chain orb pulse: scale oscillation */
  orbPulseSpeed: 3.0,
  orbPulseMin: 0.9,
  orbPulseMax: 1.15,

  /** Chain spark vertical bob speed (radians/sec) */
  sparkBobSpeed: 2.5,
  sparkPhaseScale: 10,
  sparkBobAmplitude: 0.03,

  /** Splash spore bob speed and amplitude */
  sporeBobSpeed: 1.8,
  sporeBobAmplitude: 0.04,
  sporePhaseScale: 5,

  /** Basic crystal rotation speed (radians/sec) */
  basicCrystalRotSpeed: 0.5,

  /** Sniper tip glow pulse */
  tipGlowSpeed: 2.0,
  tipGlowMin: 0.6,
  tipGlowMax: 1.2,
} as const;

export const ENEMY_ANIM_CONFIG = {
  bossCrownSpinSpeed: 2.0,  // radians per second
} as const;

/** Duration and visual parameters for the enemy death shrink-fade animation. */
export const DEATH_ANIM_CONFIG = {
  /** Seconds for a standard enemy to shrink and fade out. */
  duration: 0.3,
  /** Seconds for a BOSS enemy — slightly longer for impact. */
  durationBoss: 0.5,
  /** Scale the mesh reaches by the end of the animation (approaches 0 visually). */
  minScale: 0.1,
  /** Particle burst count for a standard enemy death. */
  burstCount: 8,
  /** Particle burst count for a BOSS enemy death — larger visual splash. */
  burstCountBoss: 20,
} as const;

export const BOSS_CROWN_CONFIG = {
  radiusMultiplier: 0.8,
  tubeMultiplier: 0.12,
  radialSegments: 8,
  tubularSegments: 16,
  emissiveIntensity: 0.8,
  roughness: 0.3,
  metalness: 0.5,
  yOffsetMultiplier: 0.6,
} as const;

export const HIT_FLASH_CONFIG = {
  /** Seconds the white flash is visible. */
  duration: 0.12,
  /** emissiveIntensity applied during the flash. */
  emissiveIntensity: 0.8,
  /** Emissive color during the flash (white). */
  color: 0xffffff,
  /** Minimum gap before the same enemy can be re-flashed. */
  cooldown: 0.1,
} as const;

export const MUZZLE_FLASH_CONFIG = {
  /** Seconds the emissive spike is visible. */
  duration: 0.1,
  /** Multiplier applied to current emissive intensity on fire. */
  intensityMultiplier: 1.5,
} as const;

export const TILE_PULSE_CONFIG = {
  /** Emissive intensity oscillation for spawner/exit tiles */
  speed: 1.5,
  min: 0.3,
  max: 0.7,
} as const;

export const SPECIALIZATION_VISUAL_CONFIG = {
  alpha: {
    emissiveTint: 0xff6633,    // warm orange/red
    emissiveIntensity: 0.4,
  },
  beta: {
    emissiveTint: 0x3366ff,    // cool blue
    emissiveIntensity: 0.4,
  },
} as const;

export const SHIELD_BREAK_CONFIG = {
  /** Seconds for the shield dome to scale up and fade out. */
  duration: 0.3,
  /** Scale the dome reaches at the end of the break animation. */
  breakScale: 2.0,
} as const;

/** Per-tower-type projectile appearance — color, emissive, scale, and emissive intensity.
 *  CHAIN and SLOW are omitted: CHAIN uses zigzag arc visuals, SLOW has no projectile. */
export const PROJECTILE_VISUAL_CONFIG: Partial<Record<TowerType, {
  color: number;
  emissive: number;
  scale: number;
  emissiveIntensity: number;
  scaleZ?: number;
}>> = {
  [TowerType.BASIC]:  { color: 0xffffcc, emissive: 0xffff88, scale: 1.0, emissiveIntensity: 0.5 },
  [TowerType.SNIPER]: { color: 0xff4444, emissive: 0xff2222, scale: 0.7, emissiveIntensity: 1.0, scaleZ: 1.5 },
  [TowerType.SPLASH]: { color: 0x44ff44, emissive: 0x22cc22, scale: 1.3, emissiveIntensity: 0.6 },
  [TowerType.MORTAR]: { color: 0xff8844, emissive: 0xff6622, scale: 1.5, emissiveIntensity: 0.8 },
} as const;
