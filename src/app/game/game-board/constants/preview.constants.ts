export const PREVIEW_CONFIG = {
  ghostOpacity: 0.4,
  /** UX-40: muted warm red matching the in-board blocked-placement tint
   *  (0xcc3322) — was 0xff0000 pure neon. Reads as "warning" not "alert." */
  invalidColor: 0xcc3322,
  groundOffset: 0.01,
  /**
   * Pre-merge cleanup: rangeRingColor / Opacity / Width / Segments removed.
   * The inline range ring this service used to render has been migrated to
   * RangeVisualizationService (UX-1) and its constants live in
   * RANGE_PREVIEW_CONFIG (ui.constants.ts). These four fields had no
   * remaining call sites.
   */
} as const;
