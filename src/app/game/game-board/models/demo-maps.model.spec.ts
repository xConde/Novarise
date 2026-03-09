import { DEMO_MAPS, DemoMapConfig } from './demo-maps.model';
import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';

const MIN_GRID_SIZE = 5;
const MAX_GRID_SIZE = 30;

/** BFS reachability check: can any exit be reached from a spawn point? */
function canReachExit(
  tiles: TerrainType[][],
  gridSize: number,
  spawn: { x: number; z: number },
  exits: { x: number; z: number }[],
  spawns: { x: number; z: number }[]
): boolean {
  const exitSet = new Set(exits.map(e => `${e.x},${e.z}`));
  const spawnSet = new Set(spawns.map(s => `${s.x},${s.z}`));
  const visited = new Set<string>();
  const queue: { x: number; z: number }[] = [spawn];
  visited.add(`${spawn.x},${spawn.z}`);

  const WALL_TYPES = new Set([TerrainType.CRYSTAL, TerrainType.ABYSS]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (exitSet.has(`${current.x},${current.z}`)) {
      return true;
    }

    const neighbors = [
      { x: current.x - 1, z: current.z },
      { x: current.x + 1, z: current.z },
      { x: current.x, z: current.z - 1 },
      { x: current.x, z: current.z + 1 },
    ];

    for (const n of neighbors) {
      const key = `${n.x},${n.z}`;
      if (n.x < 0 || n.x >= gridSize || n.z < 0 || n.z >= gridSize) continue;
      if (visited.has(key)) continue;

      const tileType = tiles[n.x][n.z];
      const isWall = WALL_TYPES.has(tileType);
      const isSpawnOrExit = spawnSet.has(key) || exitSet.has(key);

      // Traversable if not a wall, or if it's a spawn/exit point
      if (!isWall || isSpawnOrExit) {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  return false;
}

describe('DEMO_MAPS', () => {
  it('should have at least 3 demo maps', () => {
    expect(DEMO_MAPS.length).toBeGreaterThanOrEqual(3);
  });

  it('should have unique keys', () => {
    const keys = DEMO_MAPS.map(m => m.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  DEMO_MAPS.forEach((demo: DemoMapConfig) => {
    describe(`"${demo.name}" (${demo.key})`, () => {
      it('should have a non-empty name and description', () => {
        expect(demo.name.length).toBeGreaterThan(0);
        expect(demo.description.length).toBeGreaterThan(0);
      });

      it('should have a valid grid size', () => {
        expect(demo.state.gridSize).toBeGreaterThanOrEqual(MIN_GRID_SIZE);
        expect(demo.state.gridSize).toBeLessThanOrEqual(MAX_GRID_SIZE);
      });

      it('should have tiles array matching gridSize dimensions', () => {
        const { gridSize, tiles } = demo.state;
        expect(tiles.length).toBe(gridSize);
        for (let x = 0; x < gridSize; x++) {
          expect(tiles[x].length).toBe(gridSize);
        }
      });

      it('should have heightMap matching gridSize dimensions', () => {
        const { gridSize, heightMap } = demo.state;
        expect(heightMap.length).toBe(gridSize);
        for (let x = 0; x < gridSize; x++) {
          expect(heightMap[x].length).toBe(gridSize);
        }
      });

      it('should only contain valid TerrainType values in tiles', () => {
        const validTypes = new Set(Object.values(TerrainType));
        const { gridSize, tiles } = demo.state;
        for (let x = 0; x < gridSize; x++) {
          for (let z = 0; z < gridSize; z++) {
            expect(validTypes.has(tiles[x][z]))
              .withContext(`Invalid terrain at tiles[${x}][${z}]: ${tiles[x][z]}`)
              .toBeTrue();
          }
        }
      });

      it('should have at least one spawn point', () => {
        expect(demo.state.spawnPoints.length).toBeGreaterThanOrEqual(1);
      });

      it('should have at least one exit point', () => {
        expect(demo.state.exitPoints.length).toBeGreaterThanOrEqual(1);
      });

      it('should have spawn points within grid bounds', () => {
        const { gridSize, spawnPoints } = demo.state;
        for (const sp of spawnPoints) {
          expect(sp.x).toBeGreaterThanOrEqual(0);
          expect(sp.x).toBeLessThan(gridSize);
          expect(sp.z).toBeGreaterThanOrEqual(0);
          expect(sp.z).toBeLessThan(gridSize);
        }
      });

      it('should have exit points within grid bounds', () => {
        const { gridSize, exitPoints } = demo.state;
        for (const ep of exitPoints) {
          expect(ep.x).toBeGreaterThanOrEqual(0);
          expect(ep.x).toBeLessThan(gridSize);
          expect(ep.z).toBeGreaterThanOrEqual(0);
          expect(ep.z).toBeLessThan(gridSize);
        }
      });

      it('should not overlap spawn and exit points', () => {
        const { spawnPoints, exitPoints } = demo.state;
        for (const sp of spawnPoints) {
          for (const ep of exitPoints) {
            const overlaps = sp.x === ep.x && sp.z === ep.z;
            expect(overlaps)
              .withContext(`Spawn (${sp.x},${sp.z}) overlaps exit (${ep.x},${ep.z})`)
              .toBeFalse();
          }
        }
      });

      it('should have spawn point tiles that are not walls', () => {
        const { tiles, spawnPoints } = demo.state;
        const wallTypes = new Set([TerrainType.CRYSTAL, TerrainType.ABYSS]);
        for (const sp of spawnPoints) {
          expect(wallTypes.has(tiles[sp.x][sp.z]))
            .withContext(`Spawn tile at (${sp.x},${sp.z}) is a wall: ${tiles[sp.x][sp.z]}`)
            .toBeFalse();
        }
      });

      it('should have exit point tiles that are not walls', () => {
        const { tiles, exitPoints } = demo.state;
        const wallTypes = new Set([TerrainType.CRYSTAL, TerrainType.ABYSS]);
        for (const ep of exitPoints) {
          expect(wallTypes.has(tiles[ep.x][ep.z]))
            .withContext(`Exit tile at (${ep.x},${ep.z}) is a wall: ${tiles[ep.x][ep.z]}`)
            .toBeFalse();
        }
      });

      it('should have a valid version string', () => {
        expect(demo.state.version).toBe('2.0.0');
      });

      it('should have a path from every spawn to at least one exit', () => {
        const { tiles, gridSize, spawnPoints, exitPoints } = demo.state;
        for (const sp of spawnPoints) {
          const reachable = canReachExit(tiles, gridSize, sp, exitPoints, spawnPoints);
          expect(reachable)
            .withContext(`Spawn (${sp.x},${sp.z}) cannot reach any exit`)
            .toBeTrue();
        }
      });
    });
  });
});
