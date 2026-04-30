export const PATH_LINE_CONFIG = {
  color: 0x8a5cf6,
  dashSize: 0.3,
  gapSize: 0.2,
  lineWidth: 2,
  yOffset: 0.05,
  /** UX-15: opacity 0.6 → 0.5 — slight pull-back so the path reads as
   *  ambient routing hint rather than UI overlay on the new darker board. */
  opacity: 0.5,
} as const;
