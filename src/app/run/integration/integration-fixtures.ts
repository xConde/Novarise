/**
 * Shared test fixtures for run-mode integration specs.
 *
 * STUB_MAP_STATE is a minimal 10×10 BEDROCK terrain grid used by both
 * run-flow.spec.ts and combat-flow.spec.ts to satisfy EncounterService's
 * loadLevel contract without pulling in real map data. Kept in one place
 * so both files stay in sync when the TerrainGridState interface changes.
 */

import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';

export const STUB_MAP_STATE: TerrainGridState = {
  gridSize: 10,
  tiles: Array.from({ length: 10 }, () =>
    new Array<TerrainType>(10).fill(TerrainType.BEDROCK),
  ),
  heightMap: Array.from({ length: 10 }, () => new Array<number>(10).fill(0)),
  spawnPoints: [{ x: 0, z: 4 }],
  exitPoints: [{ x: 9, z: 4 }],
  version: '2.0.0',
};
