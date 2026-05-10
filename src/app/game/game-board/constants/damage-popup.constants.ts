export const DAMAGE_POPUP_CONFIG = {
  riseSpeed: 1.5,
  lifetime: 0.6,
  fontSize: 32,
  fontFamily: 'monospace',
  normalColor: '#ffffff',
  criticalColor: '#ff4444',
  shieldColor: '#4488ff',
  /** Tint for BURN DoT ticks — orange-red, distinct from tower-fire critical red. */
  burnColor: '#ff8c2a',
  /** Tint for POISON DoT ticks — sickly green. */
  poisonColor: '#7be37b',
  strokeColor: '#000000',
  strokeWidth: 2,
  canvasWidth: 64,
  canvasHeight: 32,
  /** Baseline sprite scale used for low-damage hits. */
  spriteScale: 0.5,
  /** Maximum sprite scale — damage at or above scaleSaturationDamage clamps here. */
  spriteScaleMax: 0.95,
  /** Damage value at which sprite scale saturates to spriteScaleMax. */
  scaleSaturationDamage: 80,
  criticalThreshold: 50,
  jitterRange: 0.3,
  spawnHeightOffset: 0.5,
} as const;

/** Damage source type for popup color routing. Defaults to 'tower' when omitted. */
export type DamagePopupSource = 'tower' | 'burn' | 'poison';
