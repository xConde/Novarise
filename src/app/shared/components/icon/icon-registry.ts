export type IconName =
  | 'gear' | 'heart' | 'diamond' | 'coin'
  | 'play' | 'pause' | 'range' | 'activity'
  | 'sound-on' | 'sound-off' | 'chevron-left'
  | 'cart' | 'check' | 'card' | 'moon' | 'kills'
  | 'draw-pile' | 'discard' | 'exhaust' | 'crosshair' | 'bolt' | 'shield'
  | 'node-combat' | 'node-elite' | 'node-boss'
  | 'node-rest' | 'node-shop' | 'node-event' | 'node-unknown';

export interface IconDef {
  readonly viewBox: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: string;
}

export const ICON_REGISTRY: Record<IconName, IconDef> = {
  'gear':          { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'heart':         { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'currentColor', strokeWidth: '1' },
  'diamond':       { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'coin':          { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'chevron-left':  { viewBox: '0 0 16 16', fill: 'none',         stroke: 'currentColor', strokeWidth: '1.5' },
  'check':         { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '3' },
  'play':          { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'pause':         { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'range':         { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'activity':      { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'sound-on':      { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'sound-off':     { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'cart':          { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'card':          { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'moon':          { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'kills':         { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'draw-pile':     { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'discard':       { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'exhaust':       { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'crosshair':     { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'bolt':          { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'shield':        { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2' },
  'node-combat':   { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'node-elite':    { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'node-boss':     { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'node-rest':     { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none',         strokeWidth: '0' },
  'node-shop':     { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '2.5' },
  'node-event':    { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '3' },
  'node-unknown':  { viewBox: '0 0 24 24', fill: 'none',         stroke: 'currentColor', strokeWidth: '3' },
};
