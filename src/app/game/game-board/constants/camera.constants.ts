export const CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 1000,
  distance: 35,
  zOffsetFactor: 0.5,
  panSpeed: 0.3,
};

export const CONTROLS_CONFIG = {
  dampingFactor: 0.05,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI / 2.5,
  minDistanceFactor: 0.5,
  maxDistanceFactor: 2,
  panBoundaryMargin: 0.55,  // fraction of board size beyond edges
};
