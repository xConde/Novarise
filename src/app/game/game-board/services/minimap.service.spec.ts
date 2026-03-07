import { TestBed } from '@angular/core/testing';
import { MinimapService, MinimapTerrainData, MinimapEntityData } from './minimap.service';
import { MINIMAP_CONFIG } from '../constants/minimap.constants';

describe('MinimapService', () => {
  let service: MinimapService;
  let container: HTMLElement;

  const terrain: MinimapTerrainData = {
    gridSize: 25,
    isPath: (row: number, col: number) => row === 12,
    spawnPoint: { x: 0, z: 12 },
    exitPoint: { x: 24, z: 12 },
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

    it('should position canvas absolutely in bottom-left', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.style.position).toBe('absolute');
      expect(canvas.style.bottom).toBe(`${MINIMAP_CONFIG.padding}px`);
      expect(canvas.style.left).toBe(`${MINIMAP_CONFIG.padding}px`);
    });
  });

  describe('update', () => {
    it('should not throw without init', () => {
      expect(() => service.update(0, terrain, [])).not.toThrow();
    });

    it('should render without errors when initialized', () => {
      service.init(container);
      service.setVisible(true);
      expect(() => service.update(0, terrain, [])).not.toThrow();
    });

    it('should throttle updates based on updateIntervalMs', () => {
      service.init(container);
      service.setVisible(true);
      // First call renders
      service.update(0, terrain, []);
      // Immediate second call should be throttled (no error, just skipped)
      expect(() => service.update(10, terrain, [])).not.toThrow();
      // Call after interval passes should render
      expect(() => service.update(MINIMAP_CONFIG.updateIntervalMs + 1, terrain, [])).not.toThrow();
    });

    it('should render entities without errors', () => {
      service.init(container);
      service.setVisible(true);
      const entities: MinimapEntityData[] = [
        { x: 5, z: 12, type: 'tower' },
        { x: 10, z: 12, type: 'enemy' },
        { x: 15, z: 12, type: 'enemy' },
      ];
      expect(() => service.update(0, terrain, entities)).not.toThrow();
    });

    it('should skip rendering when not visible', () => {
      service.init(container);
      // Starts hidden — should not throw, just skip
      expect(() => service.update(0, terrain, [])).not.toThrow();
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

    it('should hide/show the canvas element', () => {
      service.init(container);
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;

      // Starts hidden
      expect(canvas.style.display).toBe('none');

      service.toggleVisibility();
      expect(canvas.style.display).toBe('block');

      service.toggleVisibility();
      expect(canvas.style.display).toBe('none');
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
  });
});
