export const TOUCH_CONFIG = {
  tapThresholdMs: 300,
  tapThresholdPx: 10,
  dragSensitivity: 0.02,
  pinchZoomSpeed: 0.01,
  minZoom: 5,
  maxZoom: 25,
} as const;

/** Drag-and-drop tower placement config. */
export const DRAG_CONFIG = {
  /** Minimum distance (px) from mousedown before drag starts (prevents accidental drags). */
  minDragDistance: 8,
} as const;

/**
 * Two-step touch placement config.
 *
 * On touch devices in PLACE mode the first tap shows a ghost preview anchored
 * to the tapped tile; a second tap on the SAME tile confirms placement.
 * Tapping a different tile retargets the preview (stays in step one).
 * Tapping an invalid tile or outside the board cancels the pending preview.
 */
export const TOUCH_PLACEMENT_CONFIG = {
  /** Copy shown in the placement-indicator chip while a pending-preview tile is set. */
  confirmHint: 'Tap again to confirm',
  /** Copy shown in the placement-indicator chip while in place mode (first tap). */
  tapHint: 'Tap tile to preview',
} as const;
