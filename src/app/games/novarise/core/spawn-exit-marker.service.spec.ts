import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { SpawnExitMarkerService } from './spawn-exit-marker.service';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';

describe('SpawnExitMarkerService', () => {
  let service: SpawnExitMarkerService;
  let scene: THREE.Scene;
  let terrainGrid: TerrainGrid;

  // TerrainGrid(scene, 5) creates default spawn at {x:0,z:2} and exit at {x:4,z:2}
  const DEFAULT_SPAWN = { x: 0, z: 2 };
  const DEFAULT_EXIT = { x: 4, z: 2 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SpawnExitMarkerService],
    });

    service = TestBed.inject(SpawnExitMarkerService);
    scene = new THREE.Scene();
    terrainGrid = new TerrainGrid(scene, 5);
    service.setScene(scene);
    service.setTerrainGrid(terrainGrid);
  });

  afterEach(() => {
    service.cleanup();
    terrainGrid.dispose();
  });

  describe('service creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('setScene() / setTerrainGrid()', () => {
    it('should accept scene and grid without error', () => {
      expect(() => {
        service.setScene(new THREE.Scene());
        service.setTerrainGrid(terrainGrid);
      }).not.toThrow();
    });
  });

  describe('createSpawnExitMarkers()', () => {
    it('should create markers for the default spawn and exit points', () => {
      // TerrainGrid initializes with 1 spawn + 1 exit by default
      service.createSpawnExitMarkers();
      expect(service.getSpawnMarkers().length).toBe(1);
      expect(service.getExitMarkers().length).toBe(1);
    });

    it('should create additional spawn marker when a second spawn is added', () => {
      terrainGrid.addSpawnPoint(2, 0);
      service.createSpawnExitMarkers();
      expect(service.getSpawnMarkers().length).toBe(2);
    });

    it('should create additional exit marker when a second exit is added', () => {
      terrainGrid.addExitPoint(2, 4);
      service.createSpawnExitMarkers();
      expect(service.getExitMarkers().length).toBe(2);
    });
  });

  describe('updateSpawnMarkers()', () => {
    it('should create one marker for the default spawn point', () => {
      service.updateSpawnMarkers();
      expect(service.getSpawnMarkers().length).toBe(1);
    });

    it('should create two markers when a second spawn is added', () => {
      terrainGrid.addSpawnPoint(2, 0);
      service.updateSpawnMarkers();
      expect(service.getSpawnMarkers().length).toBe(2);
    });

    it('should remove excess markers when spawn point is removed', () => {
      terrainGrid.addSpawnPoint(2, 0);
      service.updateSpawnMarkers();
      expect(service.getSpawnMarkers().length).toBe(2);

      // Revert to just the default spawn
      terrainGrid.setSpawnPoints([DEFAULT_SPAWN]);
      service.updateSpawnMarkers();
      expect(service.getSpawnMarkers().length).toBe(1);
    });

    it('should add marker meshes to the scene when spawns increase', () => {
      service.updateSpawnMarkers(); // establish baseline
      const baseCount = scene.children.length;
      terrainGrid.addSpawnPoint(2, 0);
      service.updateSpawnMarkers();
      expect(scene.children.length).toBe(baseCount + 1);
    });

    it('should remove marker meshes from scene when spawns decrease', () => {
      terrainGrid.addSpawnPoint(2, 0);
      service.updateSpawnMarkers();
      const countWithTwo = scene.children.length;

      terrainGrid.setSpawnPoints([DEFAULT_SPAWN]);
      service.updateSpawnMarkers();
      expect(scene.children.length).toBe(countWithTwo - 1);
    });
  });

  describe('updateExitMarkers()', () => {
    it('should create one marker for the default exit point', () => {
      service.updateExitMarkers();
      expect(service.getExitMarkers().length).toBe(1);
    });

    it('should create two markers when a second exit is added', () => {
      terrainGrid.addExitPoint(2, 4);
      service.updateExitMarkers();
      expect(service.getExitMarkers().length).toBe(2);
    });

    it('should remove excess markers when exit point is removed', () => {
      terrainGrid.addExitPoint(2, 4);
      service.updateExitMarkers();
      expect(service.getExitMarkers().length).toBe(2);

      terrainGrid.setExitPoints([DEFAULT_EXIT]);
      service.updateExitMarkers();
      expect(service.getExitMarkers().length).toBe(1);
    });
  });

  describe('getSpawnMarkers() / getExitMarkers()', () => {
    it('should return empty arrays before any update call', () => {
      expect(service.getSpawnMarkers()).toEqual([]);
      expect(service.getExitMarkers()).toEqual([]);
    });
  });

  describe('cleanup()', () => {
    it('should remove all spawn markers from scene', () => {
      terrainGrid.addSpawnPoint(2, 0);
      service.updateSpawnMarkers();
      const countBefore = scene.children.length;
      service.cleanup();
      // 2 spawn markers removed (default + added)
      expect(scene.children.length).toBe(countBefore - 2);
    });

    it('should remove all exit markers from scene', () => {
      service.updateExitMarkers();
      const countBefore = scene.children.length;
      service.cleanup();
      expect(scene.children.length).toBe(countBefore - 1);
    });

    it('should empty internal marker arrays', () => {
      service.createSpawnExitMarkers();
      service.cleanup();
      expect(service.getSpawnMarkers().length).toBe(0);
      expect(service.getExitMarkers().length).toBe(0);
    });
  });
});
