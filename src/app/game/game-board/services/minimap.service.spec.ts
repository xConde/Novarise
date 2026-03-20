import { TestBed } from '@angular/core/testing';
import { MinimapService, MinimapTerrainData, MinimapEntityData } from './minimap.service';
import { MINIMAP_CONFIG } from '../constants/minimap.constants';

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
  });
});
