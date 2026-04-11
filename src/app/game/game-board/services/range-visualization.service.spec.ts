import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { RangeVisualizationService } from './range-visualization.service';
import { PlacedTower, TowerType, TargetingMode } from '../models/tower.model';
import { RANGE_PREVIEW_CONFIG, SELECTION_RING_CONFIG } from '../constants/ui.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlacedTower(row: number, col: number, type: TowerType = TowerType.BASIC): PlacedTower {
  return {
    id: `${row}-${col}`,
    type,
    row,
    col,
    level: 1,
    kills: 0,
    totalInvested: 100,
    targetingMode: TargetingMode.NEAREST,
    mesh: null,
  };
}

// ---------------------------------------------------------------------------
// RangeVisualizationService
// ---------------------------------------------------------------------------

describe('RangeVisualizationService', () => {
  let service: RangeVisualizationService;
  let scene: THREE.Scene;

  const BOARD_WIDTH = 10;
  const BOARD_HEIGHT = 10;
  const TILE_SIZE = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RangeVisualizationService],
    });
    service = TestBed.inject(RangeVisualizationService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    // Full cleanup to dispose any remaining Three.js objects
    service.cleanup(scene);
    scene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // showForTower
  // ---------------------------------------------------------------------------

  describe('showForTower', () => {
    it('adds range ring and selection ring to the scene', () => {
      const tower = makePlacedTower(3, 4);
      expect(scene.children.length).toBe(0);

      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(scene.children.length).toBe(2);
    });

    it('positions the range ring at the correct world coordinates', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const rangeRing = scene.children[0] as THREE.Mesh;
      const expectedX = (tower.col - BOARD_WIDTH / 2) * TILE_SIZE;
      const expectedZ = (tower.row - BOARD_HEIGHT / 2) * TILE_SIZE;

      expect(rangeRing.position.x).toBeCloseTo(expectedX);
      expect(rangeRing.position.z).toBeCloseTo(expectedZ);
      expect(rangeRing.position.y).toBeCloseTo(RANGE_PREVIEW_CONFIG.yPosition);
    });

    it('positions the selection ring at yOffset above the range ring', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const selectionRing = scene.children[1] as THREE.Mesh;
      const expectedY = RANGE_PREVIEW_CONFIG.yPosition + SELECTION_RING_CONFIG.yOffset;

      expect(selectionRing.position.y).toBeCloseTo(expectedY);
    });

    it('removes previous preview before showing a new one', () => {
      const tower1 = makePlacedTower(2, 2);
      const tower2 = makePlacedTower(3, 3);

      service.showForTower(tower1, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(2);

      service.showForTower(tower2, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      // Still 2: old rings removed, new ones added
      expect(scene.children.length).toBe(2);
    });

    it('rotates rings to lay flat (rotation.x = -PI/2)', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      for (const child of scene.children) {
        const mesh = child as THREE.Mesh;
        expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // removePreview
  // ---------------------------------------------------------------------------

  describe('removePreview', () => {
    it('removes both rings from the scene', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(2);

      service.removePreview(scene);

      expect(scene.children.length).toBe(0);
    });

    it('disposes geometry and material of both rings', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const [rangeRing, selectionRing] = scene.children.map(c => c as THREE.Mesh);
      spyOn(rangeRing.geometry, 'dispose').and.callThrough();
      spyOn(selectionRing.geometry, 'dispose').and.callThrough();

      service.removePreview(scene);

      expect(rangeRing.geometry.dispose).toHaveBeenCalled();
      expect(selectionRing.geometry.dispose).toHaveBeenCalled();
    });

    it('is idempotent — safe to call when no rings exist', () => {
      expect(() => service.removePreview(scene)).not.toThrow();
      expect(scene.children.length).toBe(0);
    });

    it('is idempotent — safe to call multiple times', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      service.removePreview(scene);

      expect(() => service.removePreview(scene)).not.toThrow();
      expect(scene.children.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // toggleAllRanges
  // ---------------------------------------------------------------------------

  describe('toggleAllRanges', () => {
    it('creates a ring for each placed tower when toggling on', () => {
      const towers = new Map<string, PlacedTower>([
        ['0-0', makePlacedTower(0, 0)],
        ['1-1', makePlacedTower(1, 1)],
        ['2-2', makePlacedTower(2, 2)],
      ]);

      const newState = service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(newState).toBeTrue();
      expect(scene.children.length).toBe(3);
    });

    it('removes all rings when toggling off', () => {
      const towers = new Map<string, PlacedTower>([
        ['0-0', makePlacedTower(0, 0)],
        ['1-1', makePlacedTower(1, 1)],
      ]);

      // Toggle on first
      service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(2);

      // Toggle off
      const newState = service.toggleAllRanges(true, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(newState).toBeFalse();
      expect(scene.children.length).toBe(0);
    });

    it('returns true when toggling from false', () => {
      const towers = new Map<string, PlacedTower>();
      const result = service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(result).toBeTrue();
    });

    it('returns false when toggling from true', () => {
      const towers = new Map<string, PlacedTower>();
      const result = service.toggleAllRanges(true, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(result).toBeFalse();
    });

    it('replaces existing rings on re-toggle on', () => {
      const towers = new Map<string, PlacedTower>([
        ['0-0', makePlacedTower(0, 0)],
      ]);

      service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(1);

      // Toggle off then on again — should still have 1 ring
      service.toggleAllRanges(true, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      const newState = service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(newState).toBeTrue();
      expect(scene.children.length).toBe(1);
    });

    it('creates no rings for an empty tower map when toggling on', () => {
      const newState = service.toggleAllRanges(
        false,
        new Map<string, PlacedTower>(),
        BOARD_WIDTH,
        BOARD_HEIGHT,
        TILE_SIZE,
        scene
      );

      expect(newState).toBeTrue();
      expect(scene.children.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('removes all range ring meshes from the scene', () => {
      const towers = new Map<string, PlacedTower>([
        ['0-0', makePlacedTower(0, 0)],
        ['1-1', makePlacedTower(1, 1)],
      ]);
      service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(2);

      service.cleanup(scene);

      expect(scene.children.length).toBe(0);
    });

    it('removes preview rings AND toggle rings', () => {
      const tower = makePlacedTower(5, 5);
      service.showForTower(tower, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const towers = new Map<string, PlacedTower>([['0-0', makePlacedTower(0, 0)]]);
      service.toggleAllRanges(false, towers, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      // 2 preview + 1 toggle = 3 total
      expect(scene.children.length).toBe(3);

      service.cleanup(scene);

      expect(scene.children.length).toBe(0);
    });

    it('is safe to call when nothing exists', () => {
      expect(() => service.cleanup(scene)).not.toThrow();
    });
  });
});
