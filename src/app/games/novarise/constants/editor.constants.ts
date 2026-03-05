// Editor minimap configuration constants
// All magic numbers for the minimap feature live here.

export const MINIMAP_CONFIG = {
  /** Canvas size in CSS pixels (square). */
  size: 150,
  /** Radius (px) of the spawn/exit point markers drawn on the minimap. */
  markerRadius: 4,
  /** Background fill color for the minimap canvas. */
  backgroundColor: '#0a0812',
  /** Border color around the minimap canvas. */
  borderColor: 'rgba(106, 90, 154, 0.6)',
  /** Spawn point marker fill color (green). */
  spawnColor: '#50ff50',
  /** Exit point marker fill color (red). */
  exitColor: '#ff5050',
} as const;
