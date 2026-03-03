// Editor camera configuration constants
// Extracted from camera-control.service.ts — do NOT duplicate or inline these values.

import type { CameraConfig } from '../core/camera-control.service';

export const EDITOR_CAMERA_CONFIG: CameraConfig = {
  moveSpeed: 0.25,
  fastSpeed: 0.6,
  acceleration: 0.15,
  rotationSpeed: 0.005,
  rotationAcceleration: 0.15,
  minDistance: 10,
  maxDistance: 80,
  minHeight: 5,
  maxHeight: 60,
  maxPitch: Math.PI / 4,       // 45 degrees up
  minPitch: -Math.PI * 5 / 12, // 75 degrees down
};

/** Initial world-space camera position [x, y, z]. */
export const EDITOR_CAMERA_INITIAL_POSITION: [number, number, number] = [0, 35, 17.5];

/** Multiplier applied to rotationSpeed when driven by joystick. */
export const EDITOR_CAMERA_JOYSTICK_ROTATION_MULTIPLIER = 1.5;

/** Maximum absolute XZ distance from origin the camera can travel. */
export const EDITOR_CAMERA_POSITION_BOUND = 50;

/** Forward distance used when computing the look-at target. */
export const EDITOR_CAMERA_LOOK_AT_DISTANCE = 10;

/** Y offset subtracted from the look-at target to tilt view slightly downward. */
export const EDITOR_CAMERA_LOOK_AT_Y_OFFSET = -5;
