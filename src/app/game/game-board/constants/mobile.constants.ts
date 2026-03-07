export const MOBILE_CONFIG = {
  /** Breakpoint below which mobile optimizations apply */
  breakpoint: 768,
  /** Breakpoint below which phone-specific optimizations apply */
  phoneBreakpoint: 480,
  /** Max pixel ratio on mobile to reduce GPU load */
  maxPixelRatio: 1.5,
  /** Shadow map cap on mobile */
  maxShadowMapSize: 1024,
  /** Particle count divisor on mobile */
  particleDivisor: 2,
} as const;
