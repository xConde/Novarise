import { TestBed } from '@angular/core/testing';
import { MinimapService, MinimapTerrainData, MinimapEntityData, MinimapBoardSnapshot, MinimapGridPosition } from './minimap.service';
import { MINIMAP_CONFIG } from '../constants/minimap.constants';
import { BlockType } from '../models/game-board-tile';

describe('MinimapService', () => {
  let service: MinimapService;
  let container: HTMLElement;

  const terrain: MinimapTerrainData = {
    gridWidth: 25,
    gridHeight: 20,
    isPath: (row: number, col: number) => row === 12,
    spawnPoints: [{ x: 0, z: 12 }],
    exitPoints: [{ x: 24, z: 12 }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MinimapService],
    });
    service = TestBed.inject(MinimapService);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    service.cleanup();
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  describe('init', () => {
    it('should create and append a canvas to the container', () => {
      service.init(container);
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas!.width).toBe(MINIMAP_CONFIG.canvasSize);
      expect(canvas!.height).toBe(MINIMAP_CONFIG.canvasSize);
    });

    it('should add canvas with game-minimap class for CSS positioning', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.className).toBe('game-minimap');
    });
  });

  describe('update', () => {
    it('should not throw without init', () => {
      expect(() => service.update(0, terrain, [])).not.toThrow();
    });

    it('should render without errors when initialized', () => {
      service.init(container);
      service.show();
      expect(() => service.update(0, terrain, [])).not.toThrow();
    });

    it('should throttle updates based on updateIntervalMs', () => {
      service.init(container);
      service.show();
      // First call renders
      service.update(0, terrain, []);
      // Immediate second call should be throttled (no error, just skipped)
      expect(() => service.update(10, terrain, [])).not.toThrow();
      // Call after interval passes should render
      expect(() => service.update(MINIMAP_CONFIG.updateIntervalMs + 1, terrain, [])).not.toThrow();
    });

    it('should render entities without errors', () => {
      service.init(container);
      service.show();
      const entities: MinimapEntityData[] = [
        { x: 5, z: 12, type: 'tower' },
        { x: 10, z: 12, type: 'enemy' },
        { x: 15, z: 12, type: 'enemy' },
      ];
      expect(() => service.update(0, terrain, entities)).not.toThrow();
    });

    it('should skip rendering when not visible', () => {
      service.init(container);
      // Service starts with visible=false, so update should skip
      expect(() => service.update(0, terrain, [])).not.toThrow();
    });
  });

  describe('show', () => {
    it('should set visible to true', () => {
      expect(service.isVisible()).toBe(false);
      service.show();
      expect(service.isVisible()).toBe(true);
    });

    it('should clear display style on canvas', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      canvas.style.display = 'none';
      service.show();
      expect(canvas.style.display).toBe('');
    });

    it('should have game-minimap class for CSS transition', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.classList.contains('game-minimap')).toBeTrue();
    });

    it('should start with opacity 0 before show is called', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.opacity).toBe('0');
    });

    it('should not throw without init', () => {
      expect(() => service.show()).not.toThrow();
    });
  });

  describe('hide', () => {
    it('should set visible to false', () => {
      service.show();
      expect(service.isVisible()).toBe(true);
      service.hide();
      expect(service.isVisible()).toBe(false);
    });

    it('should set display none on canvas', () => {
      service.init(container);
      service.show();
      service.hide();
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.display).toBe('none');
    });

    it('should reset opacity to 0 when hidden', () => {
      service.init(container);
      service.show();
      service.hide();
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.opacity).toBe('0');
    });

    it('should not throw without init', () => {
      expect(() => service.hide()).not.toThrow();
    });
  });

  describe('toggleVisibility', () => {
    it('should toggle visible state', () => {
      expect(service.isVisible()).toBe(false);
      service.toggleVisibility();
      expect(service.isVisible()).toBe(true);
      service.toggleVisibility();
      expect(service.isVisible()).toBe(false);
    });

    it('should show the canvas element on first toggle (display cleared)', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      // Starts hidden (visible=false), toggle makes it visible — display is cleared
      service.toggleVisibility();
      expect(canvas.style.display).toBe('');

      // Toggle again hides it instantly
      service.toggleVisibility();
      expect(canvas.style.display).toBe('none');
    });
  });

  describe('setDimmed', () => {
    it('should set canvas opacity to pausedOpacity when dimmed and visible', () => {
      service.init(container);
      service.show();
      service.setDimmed(true);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.opacity).toBe(String(MINIMAP_CONFIG.pausedOpacity));
    });

    it('should restore canvas opacity to 1 when un-dimmed and visible', () => {
      service.init(container);
      service.show();
      service.setDimmed(true);
      service.setDimmed(false);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.opacity).toBe('1');
    });

    it('should not affect opacity when minimap is not visible', () => {
      service.init(container);
      // Not shown — calling setDimmed should be a no-op
      service.setDimmed(true);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      // Opacity stays at '0' (hidden state), not pausedOpacity
      expect(canvas.style.opacity).toBe('0');
    });

    it('should not throw without init', () => {
      expect(() => service.setDimmed(true)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove canvas from container', () => {
      service.init(container);
      expect(container.querySelector('canvas')).not.toBeNull();
      service.cleanup();
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('should handle cleanup without init', () => {
      expect(() => service.cleanup()).not.toThrow();
    });

    it('should handle double cleanup', () => {
      service.init(container);
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });

    it('should clear the terrain cache on cleanup', () => {
      const snapshot: MinimapBoardSnapshot = {
        boardWidth: 10,
        boardHeight: 10,
        spawnerTiles: [[0, 0]],
        exitTiles: [[9, 9]],
        getTileType: () => BlockType.BASE,
      };
      service.buildTerrainCache(snapshot);
      expect(service.getCachedTerrain()).not.toBeNull();
      service.cleanup();
      expect(service.getCachedTerrain()).toBeNull();
    });
  });

  describe('buildTerrainCache', () => {
    const snapshot: MinimapBoardSnapshot = {
      boardWidth: 25,
      boardHeight: 20,
      spawnerTiles: [[12, 0]],
      exitTiles: [[12, 24]],
      getTileType: (row: number, col: number) => (row === 12 ? BlockType.BASE : BlockType.WALL),
    };

    it('should return a MinimapTerrainData with correct dimensions', () => {
      const terrain = service.buildTerrainCache(snapshot);
      expect(terrain.gridWidth).toBe(25);
      expect(terrain.gridHeight).toBe(20);
    });

    it('should cache the terrain (getCachedTerrain returns it)', () => {
      expect(service.getCachedTerrain()).toBeNull();
      service.buildTerrainCache(snapshot);
      expect(service.getCachedTerrain()).not.toBeNull();
    });

    it('should derive isPath from getTileType (WALL tiles are not path)', () => {
      const terrain = service.buildTerrainCache(snapshot);
      expect(terrain.isPath(12, 5)).toBeTrue();   // BASE tile
      expect(terrain.isPath(0, 0)).toBeFalse();   // WALL tile
    });

    it('should map spawner/exit tiles to minimap points (col→x, row→z)', () => {
      const terrain = service.buildTerrainCache(snapshot);
      expect(terrain.spawnPoints).toEqual([{ x: 0, z: 12 }]);
      expect(terrain.exitPoints).toEqual([{ x: 24, z: 12 }]);
    });

    it('should handle out-of-bounds getTileType returning undefined (treated as not-path)', () => {
      const snap: MinimapBoardSnapshot = {
        boardWidth: 5,
        boardHeight: 5,
        spawnerTiles: [],
        exitTiles: [],
        getTileType: () => undefined,
      };
      const terrain = service.buildTerrainCache(snap);
      expect(terrain.isPath(0, 0)).toBeFalse();
    });
  });

  describe('updateWithEntities', () => {
    const snapshot: MinimapBoardSnapshot = {
      boardWidth: 25,
      boardHeight: 20,
      spawnerTiles: [],
      exitTiles: [],
      getTileType: () => BlockType.BASE,
    };

    it('should be a no-op when terrain cache has not been built', () => {
      // No buildTerrainCache() called — should not throw
      expect(() =>
        service.updateWithEntities(0, [{ row: 0, col: 0 }], [])
      ).not.toThrow();
    });

    it('should call update() with entity data derived from position arrays', () => {
      service.init(container);
      service.show();
      service.buildTerrainCache(snapshot);

      const updateSpy = spyOn(service, 'update').and.callThrough();

      const towers: MinimapGridPosition[] = [{ row: 5, col: 10 }];
      const enemies: MinimapGridPosition[] = [{ row: 12, col: 3 }];

      service.updateWithEntities(0, towers, enemies);

      expect(updateSpy).toHaveBeenCalled();
      const [, , entities] = updateSpy.calls.mostRecent().args as [number, MinimapTerrainData, MinimapEntityData[]];
      expect(entities.some(e => e.type === 'tower' && e.x === 10 && e.z === 5)).toBeTrue();
      expect(entities.some(e => e.type === 'enemy' && e.x === 3 && e.z === 12)).toBeTrue();
    });

    it('should handle empty tower and enemy arrays without error', () => {
      service.buildTerrainCache(snapshot);
      expect(() => service.updateWithEntities(0, [], [])).not.toThrow();
    });
  });
});
