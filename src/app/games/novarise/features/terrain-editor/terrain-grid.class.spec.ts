import * as THREE from 'three';
import { TerrainGrid, TerrainTile } from './terrain-grid.class';
import { TerrainType, TERRAIN_CONFIGS } from '../../models/terrain-types.enum';

describe('TerrainGrid', () => {
  let scene: THREE.Scene;
  let terrainGrid: TerrainGrid;
  const defaultGridSize = 10; // Use smaller grid for faster tests

  beforeEach(() => {
    scene = new THREE.Scene();
    terrainGrid = new TerrainGrid(scene, defaultGridSize);
  });

  afterEach(() => {
    terrainGrid.dispose();
  });

  describe('Initialization', () => {
    it('should create a terrain grid with specified size', () => {
      const meshes = terrainGrid.getTileMeshes();
      expect(meshes.length).toBe(defaultGridSize * defaultGridSize);
    });

    it('should initialize all tiles as BEDROCK type', () => {
      for (let x = 0; x < defaultGridSize; x++) {
        for (let z = 0; z < defaultGridSize; z++) {
          const tile = terrainGrid.getTileAt(x, z);
          expect(tile).toBeTruthy();
          expect(tile!.type).toBe(TerrainType.BEDROCK);
        }
      }
    });

    it('should initialize all tiles with height 0', () => {
      for (let x = 0; x < defaultGridSize; x++) {
        for (let z = 0; z < defaultGridSize; z++) {
          const tile = terrainGrid.getTileAt(x, z);
          expect(tile).toBeTruthy();
          expect(tile!.height).toBe(0);
        }
      }
    });

    it('should add tile meshes to the scene', () => {
      // Scene should contain tile meshes plus grid lines
      expect(scene.children.length).toBeGreaterThan(0);
    });

    it('should set default spawn point', () => {
      const spawnPoint = terrainGrid.getSpawnPoint();
      expect(spawnPoint).toBeTruthy();
      expect(spawnPoint!.x).toBe(0);
      expect(spawnPoint!.z).toBe(Math.floor(defaultGridSize / 2));
    });

    it('should set default exit point', () => {
      const exitPoint = terrainGrid.getExitPoint();
      expect(exitPoint).toBeTruthy();
      expect(exitPoint!.x).toBe(defaultGridSize - 1);
      expect(exitPoint!.z).toBe(Math.floor(defaultGridSize / 2));
    });

    it('should create meshes with correct userData', () => {
      const tile = terrainGrid.getTileAt(3, 5);
      expect(tile).toBeTruthy();
      expect(tile!.mesh.userData['gridX']).toBe(3);
      expect(tile!.mesh.userData['gridZ']).toBe(5);
    });
  });

  describe('getTileAt', () => {
    it('should return tile at valid position', () => {
      const tile = terrainGrid.getTileAt(0, 0);
      expect(tile).toBeTruthy();
    });

    it('should return null for negative x', () => {
      const tile = terrainGrid.getTileAt(-1, 0);
      expect(tile).toBeNull();
    });

    it('should return null for negative z', () => {
      const tile = terrainGrid.getTileAt(0, -1);
      expect(tile).toBeNull();
    });

    it('should return null for x >= gridSize', () => {
      const tile = terrainGrid.getTileAt(defaultGridSize, 0);
      expect(tile).toBeNull();
    });

    it('should return null for z >= gridSize', () => {
      const tile = terrainGrid.getTileAt(0, defaultGridSize);
      expect(tile).toBeNull();
    });
  });

  describe('paintTile', () => {
    it('should change tile type when painted', () => {
      terrainGrid.paintTile(5, 5, TerrainType.CRYSTAL);

      const tile = terrainGrid.getTileAt(5, 5);
      expect(tile!.type).toBe(TerrainType.CRYSTAL);
    });

    it('should update tile material color', () => {
      terrainGrid.paintTile(5, 5, TerrainType.MOSS);

      const tile = terrainGrid.getTileAt(5, 5);
      const material = tile!.mesh.material as THREE.MeshStandardMaterial;
      const config = TERRAIN_CONFIGS[TerrainType.MOSS];

      expect(material.color.getHex()).toBe(config.color);
    });

    it('should update tile material emissive properties', () => {
      terrainGrid.paintTile(5, 5, TerrainType.CRYSTAL);

      const tile = terrainGrid.getTileAt(5, 5);
      const material = tile!.mesh.material as THREE.MeshStandardMaterial;
      const config = TERRAIN_CONFIGS[TerrainType.CRYSTAL];

      expect(material.emissive.getHex()).toBe(config.emissiveColor);
      expect(material.emissiveIntensity).toBe(config.emissiveIntensity);
    });

    it('should not repaint if same type', () => {
      const tile = terrainGrid.getTileAt(5, 5);
      const material = tile!.mesh.material as THREE.MeshStandardMaterial;
      const colorSpy = spyOn(material.color, 'setHex').and.callThrough();

      // Paint to CRYSTAL first
      terrainGrid.paintTile(5, 5, TerrainType.CRYSTAL);
      expect(colorSpy).toHaveBeenCalledTimes(1);

      // Paint to CRYSTAL again - should not call setHex
      terrainGrid.paintTile(5, 5, TerrainType.CRYSTAL);
      expect(colorSpy).toHaveBeenCalledTimes(1);
    });

    it('should ignore invalid positions', () => {
      // Should not throw
      expect(() => terrainGrid.paintTile(-1, 0, TerrainType.CRYSTAL)).not.toThrow();
      expect(() => terrainGrid.paintTile(0, -1, TerrainType.CRYSTAL)).not.toThrow();
      expect(() => terrainGrid.paintTile(defaultGridSize, 0, TerrainType.CRYSTAL)).not.toThrow();
    });

    it('should update buildability based on terrain type', () => {
      // CRYSTAL should not be buildable
      terrainGrid.paintTile(5, 5, TerrainType.CRYSTAL);
      expect(terrainGrid.isBuildable(5, 5)).toBe(false);

      // ABYSS should not be buildable
      terrainGrid.paintTile(6, 6, TerrainType.ABYSS);
      expect(terrainGrid.isBuildable(6, 6)).toBe(false);

      // BEDROCK and MOSS should be buildable
      terrainGrid.paintTile(7, 7, TerrainType.BEDROCK);
      expect(terrainGrid.isBuildable(7, 7)).toBe(true);

      terrainGrid.paintTile(8, 8, TerrainType.MOSS);
      expect(terrainGrid.isBuildable(8, 8)).toBe(true);
    });
  });

  describe('adjustHeight', () => {
    it('should increase tile height', () => {
      terrainGrid.adjustHeight(5, 5, 1.0);

      const tile = terrainGrid.getTileAt(5, 5);
      expect(tile!.height).toBeGreaterThan(0);
    });

    it('should decrease tile height', () => {
      terrainGrid.adjustHeight(5, 5, 2.0);
      terrainGrid.adjustHeight(5, 5, -1.0);

      const tile = terrainGrid.getTileAt(5, 5);
      expect(tile!.height).toBeLessThan(2.0);
    });

    it('should clamp height to minimum 0', () => {
      terrainGrid.adjustHeight(5, 5, -10);

      const tile = terrainGrid.getTileAt(5, 5);
      expect(tile!.height).toBe(0);
    });

    it('should clamp height to maximum 5', () => {
      terrainGrid.adjustHeight(5, 5, 10);

      const tile = terrainGrid.getTileAt(5, 5);
      expect(tile!.height).toBeLessThanOrEqual(5);
    });

    it('should ignore invalid positions', () => {
      expect(() => terrainGrid.adjustHeight(-1, 0, 1)).not.toThrow();
      expect(() => terrainGrid.adjustHeight(0, -1, 1)).not.toThrow();
      expect(() => terrainGrid.adjustHeight(defaultGridSize, 0, 1)).not.toThrow();
    });

    it('should update mesh position when height changes', () => {
      const tile = terrainGrid.getTileAt(5, 5);
      const initialY = tile!.mesh.position.y;

      terrainGrid.adjustHeight(5, 5, 2.0);

      const newTile = terrainGrid.getTileAt(5, 5);
      expect(newTile!.mesh.position.y).toBeGreaterThan(initialY);
    });

    it('should not update if height is already at limit', () => {
      // Set to max
      terrainGrid.adjustHeight(5, 5, 5);
      const tile1 = terrainGrid.getTileAt(5, 5);
      const height1 = tile1!.height;

      // Try to increase beyond max
      terrainGrid.adjustHeight(5, 5, 1);
      const tile2 = terrainGrid.getTileAt(5, 5);

      expect(tile2!.height).toBe(height1);
    });
  });

  describe('Spawn and Exit Points', () => {
    it('should set spawn point', () => {
      terrainGrid.setSpawnPoint(3, 3);

      const spawn = terrainGrid.getSpawnPoint();
      expect(spawn!.x).toBe(3);
      expect(spawn!.z).toBe(3);
    });

    it('should set exit point', () => {
      terrainGrid.setExitPoint(7, 7);

      const exit = terrainGrid.getExitPoint();
      expect(exit!.x).toBe(7);
      expect(exit!.z).toBe(7);
    });

    it('should mark spawn point as not buildable', () => {
      terrainGrid.setSpawnPoint(3, 3);

      expect(terrainGrid.isBuildable(3, 3)).toBe(false);
    });

    it('should mark exit point as not buildable', () => {
      terrainGrid.setExitPoint(7, 7);

      expect(terrainGrid.isBuildable(7, 7)).toBe(false);
    });

    it('should ignore invalid spawn point positions', () => {
      const originalSpawn = terrainGrid.getSpawnPoint();

      terrainGrid.setSpawnPoint(-1, 0);

      expect(terrainGrid.getSpawnPoint()).toEqual(originalSpawn);
    });

    it('should ignore invalid exit point positions', () => {
      const originalExit = terrainGrid.getExitPoint();

      terrainGrid.setExitPoint(defaultGridSize, 0);

      expect(terrainGrid.getExitPoint()).toEqual(originalExit);
    });
  });

  describe('isBuildable', () => {
    it('should return true for default buildable tiles', () => {
      expect(terrainGrid.isBuildable(5, 5)).toBe(true);
    });

    it('should return false for invalid positions', () => {
      expect(terrainGrid.isBuildable(-1, 0)).toBe(false);
      expect(terrainGrid.isBuildable(0, -1)).toBe(false);
      expect(terrainGrid.isBuildable(defaultGridSize, 0)).toBe(false);
    });
  });

  describe('getTileMeshes', () => {
    it('should return cached mesh array', () => {
      const meshes1 = terrainGrid.getTileMeshes();
      const meshes2 = terrainGrid.getTileMeshes();

      expect(meshes1).toBe(meshes2); // Same reference
    });

    it('should return all tile meshes', () => {
      const meshes = terrainGrid.getTileMeshes();
      expect(meshes.length).toBe(defaultGridSize * defaultGridSize);
    });
  });

  describe('exportState', () => {
    it('should export grid size', () => {
      const state = terrainGrid.exportState();
      expect(state.gridSize).toBe(defaultGridSize);
    });

    it('should export version', () => {
      const state = terrainGrid.exportState();
      expect(state.version).toBe('1.0.0');
    });

    it('should export tile types', () => {
      terrainGrid.paintTile(0, 0, TerrainType.CRYSTAL);
      terrainGrid.paintTile(1, 1, TerrainType.MOSS);

      const state = terrainGrid.exportState();

      expect(state.tiles[0][0]).toBe(TerrainType.CRYSTAL);
      expect(state.tiles[1][1]).toBe(TerrainType.MOSS);
    });

    it('should export height map', () => {
      terrainGrid.adjustHeight(3, 3, 2.0);

      const state = terrainGrid.exportState();

      expect(state.heightMap[3][3]).toBeGreaterThan(0);
    });

    it('should export spawn point', () => {
      terrainGrid.setSpawnPoint(2, 4);

      const state = terrainGrid.exportState();

      expect(state.spawnPoint).toEqual({ x: 2, z: 4 });
    });

    it('should export exit point', () => {
      terrainGrid.setExitPoint(8, 6);

      const state = terrainGrid.exportState();

      expect(state.exitPoint).toEqual({ x: 8, z: 6 });
    });
  });

  describe('importState', () => {
    it('should import tile types', () => {
      const state = terrainGrid.exportState();
      state.tiles[2][2] = TerrainType.ABYSS;
      state.tiles[3][3] = TerrainType.CRYSTAL;

      terrainGrid.importState(state);

      expect(terrainGrid.getTileAt(2, 2)!.type).toBe(TerrainType.ABYSS);
      expect(terrainGrid.getTileAt(3, 3)!.type).toBe(TerrainType.CRYSTAL);
    });

    it('should import height map', () => {
      const state = terrainGrid.exportState();
      state.heightMap[4][4] = 3.0;

      terrainGrid.importState(state);

      expect(terrainGrid.getTileAt(4, 4)!.height).toBe(3.0);
    });

    it('should import spawn point', () => {
      const state = terrainGrid.exportState();
      state.spawnPoint = { x: 1, z: 1 };

      terrainGrid.importState(state);

      expect(terrainGrid.getSpawnPoint()).toEqual({ x: 1, z: 1 });
    });

    it('should import exit point', () => {
      const state = terrainGrid.exportState();
      state.exitPoint = { x: 8, z: 8 };

      terrainGrid.importState(state);

      expect(terrainGrid.getExitPoint()).toEqual({ x: 8, z: 8 });
    });

    it('should reject state with mismatched grid size', () => {
      const invalidState = {
        gridSize: 50, // Different from our 10x10 grid
        tiles: [],
        heightMap: [],
        spawnPoint: { x: 0, z: 0 },
        exitPoint: { x: 1, z: 1 },
        version: '1.0.0'
      };

      // Should not throw but should not import
      expect(() => terrainGrid.importState(invalidState)).not.toThrow();

      // State should remain unchanged
      expect(terrainGrid.getTileAt(0, 0)!.type).toBe(TerrainType.BEDROCK);
    });

    it('should handle null state gracefully', () => {
      expect(() => terrainGrid.importState(null)).not.toThrow();
    });

    it('should handle undefined state gracefully', () => {
      expect(() => terrainGrid.importState(undefined)).not.toThrow();
    });

    it('should handle partial state data', () => {
      const partialState = terrainGrid.exportState();
      // Remove some tiles
      partialState.tiles[5] = undefined as any;

      expect(() => terrainGrid.importState(partialState)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should remove all meshes from scene', () => {
      const initialChildCount = scene.children.length;
      expect(initialChildCount).toBeGreaterThan(0);

      terrainGrid.dispose();

      // After dispose, scene should have fewer children
      expect(scene.children.length).toBeLessThan(initialChildCount);
    });

    it('should clear mesh cache', () => {
      terrainGrid.dispose();

      const meshes = terrainGrid.getTileMeshes();
      expect(meshes.length).toBe(0);
    });

    it('should dispose geometries and materials', () => {
      const tile = terrainGrid.getTileAt(0, 0);
      const geometry = tile!.mesh.geometry;
      const material = tile!.mesh.material as THREE.Material;

      // Spy on dispose methods
      const geometryDisposeSpy = spyOn(geometry, 'dispose').and.callThrough();
      const materialDisposeSpy = spyOn(material, 'dispose').and.callThrough();

      terrainGrid.dispose();

      expect(geometryDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive paint operations', () => {
      for (let i = 0; i < 100; i++) {
        const type = i % 2 === 0 ? TerrainType.CRYSTAL : TerrainType.MOSS;
        terrainGrid.paintTile(5, 5, type);
      }

      // Should end up as MOSS (last paint)
      expect(terrainGrid.getTileAt(5, 5)!.type).toBe(TerrainType.MOSS);
    });

    it('should handle painting all tiles', () => {
      for (let x = 0; x < defaultGridSize; x++) {
        for (let z = 0; z < defaultGridSize; z++) {
          terrainGrid.paintTile(x, z, TerrainType.CRYSTAL);
        }
      }

      // All tiles should be CRYSTAL
      for (let x = 0; x < defaultGridSize; x++) {
        for (let z = 0; z < defaultGridSize; z++) {
          expect(terrainGrid.getTileAt(x, z)!.type).toBe(TerrainType.CRYSTAL);
        }
      }
    });

    it('should preserve mesh cache consistency after height changes', () => {
      const meshes = terrainGrid.getTileMeshes();
      const initialLength = meshes.length;

      // Adjust heights on multiple tiles
      terrainGrid.adjustHeight(0, 0, 2);
      terrainGrid.adjustHeight(5, 5, 3);
      terrainGrid.adjustHeight(9, 9, 1);

      // Cache should still have same number of meshes
      expect(terrainGrid.getTileMeshes().length).toBe(initialLength);
    });
  });
});
