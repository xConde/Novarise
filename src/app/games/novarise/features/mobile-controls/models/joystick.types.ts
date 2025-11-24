/**
 * 2D vector representing joystick position
 * Values are normalized from -1 to 1
 */
export interface JoystickVector {
  x: number;
  y: number;
}

/**
 * Joystick purpose/type
 */
export type JoystickType = 'movement' | 'rotation';

/**
 * Joystick position on screen
 */
export type JoystickPosition = 'left' | 'right';

/**
 * Configuration for a virtual joystick
 */
export interface JoystickConfig {
  type: JoystickType;
  position: JoystickPosition;
  /** Max distance stick can move from center (in pixels) */
  maxDistance?: number;
  /** Sensitivity multiplier for output values */
  sensitivity?: number;
}

/**
 * Output event from joystick
 */
export interface JoystickEvent {
  type: JoystickType;
  vector: JoystickVector;
  active: boolean;
}

/**
 * Device/screen breakpoints for responsive joystick sizing
 */
export const JOYSTICK_BREAKPOINTS = {
  /** Mobile phones */
  MOBILE: 480,
  /** Small tablets / large phones */
  TABLET_SMALL: 768,
  /** Regular tablets (iPad, etc.) */
  TABLET: 1024,
  /** Large tablets (iPad Pro, etc.) */
  TABLET_LARGE: 1366
} as const;

/**
 * Joystick sizes for different screen sizes
 */
export const JOYSTICK_SIZES = {
  /** Phone portrait */
  MOBILE_PORTRAIT: { base: 120, stick: 50, maxDistance: 35 },
  /** Phone landscape */
  MOBILE_LANDSCAPE: { base: 100, stick: 42, maxDistance: 29 },
  /** Tablet */
  TABLET: { base: 140, stick: 58, maxDistance: 41 }
} as const;
