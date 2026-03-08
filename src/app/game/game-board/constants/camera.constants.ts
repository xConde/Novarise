export const CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 1000,
  distance: 35,
  zOffsetFactor: 0.5,
  panSpeed: 0.5,
};

export const CONTROLS_CONFIG = {
  dampingFactor: 0.05,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI / 2.5,
  minDistanceFactor: 0.5,
  maxDistanceFactor: 3
};

/**
 * Sentinel value for disabling an OrbitControls mouse button action.
 * OrbitControls' switch statement falls to `default: state = NONE` for unknown values.
 */
export const MOUSE_ACTION_DISABLED = -1;
