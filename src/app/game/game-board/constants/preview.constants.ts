export const PREVIEW_CONFIG = {
  ghostOpacity: 0.4,
  /** UX-40: muted warm red matching the in-board blocked-placement tint
   *  (0xcc3322) — was 0xff0000 pure neon. Reads as "warning" not "alert." */
  invalidColor: 0xcc3322,
  /** UX-40: muted green (was 0x00ff00 neon). The inline ring this color
   *  was used for is removed (UX-1); kept for future range-ring callers. */
  rangeRingColor: 0x4ac47a,
  rangeRingOpacity: 0.15,
  rangeRingWidth: 0.05,  // inner to outer radius difference
  rangeRingSegments: 64,
  groundOffset: 0.01,
} as const;
