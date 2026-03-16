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
