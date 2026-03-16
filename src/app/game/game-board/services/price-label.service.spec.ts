import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { PriceLabelService } from './price-label.service';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal TilePriceInfo shape accepted by showLabels. */
interface LabelInfo {
  percentIncrease: number;
  tier: string;
}

/** Build a priceMap that showLabels can consume. */
function makePriceMap(entries: Array<[string, LabelInfo]>): Map<string, LabelInfo> {
  return new Map(entries);
}

/** 5×5 board defaults used across most tests. */
const BOARD_WIDTH  = 5;
const BOARD_HEIGHT = 5;
const TILE_SIZE    = 1;

// ---------------------------------------------------------------------------
// PriceLabelService
// ---------------------------------------------------------------------------

describe('PriceLabelService', () => {
  let service: PriceLabelService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PriceLabelService],
    });
    service = TestBed.inject(PriceLabelService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    scene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // showLabels — sprite creation
  // ---------------------------------------------------------------------------

  describe('showLabels', () => {
    it('creates sprites for tiles with percentIncrease > 0', () => {
      const priceMap = makePriceMap([
        ['2-3', { percentIncrease: 25, tier: 'medium' }],
        ['0-1', { percentIncrease: 10, tier: 'low'    }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(scene.children.length).toBe(2);
    });

    it('does NOT create sprites for tiles where percentIncrease === 0', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 0,  tier: 'base'   }],
        ['1-1', { percentIncrease: 50, tier: 'high'   }],
        ['2-2', { percentIncrease: 0,  tier: 'base'   }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(scene.children.length).toBe(1);
    });

    it('adds no sprites when all tiles have percentIncrease === 0', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 0, tier: 'base' }],
        ['1-2', { percentIncrease: 0, tier: 'base' }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(scene.children.length).toBe(0);
    });

    it('adds no sprites for an empty priceMap', () => {
      service.showLabels(new Map(), BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(0);
    });

    it('positions sprites at the correct world Y offset', () => {
      const priceMap = makePriceMap([
        ['2-3', { percentIncrease: 30, tier: 'medium' }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const sprite = scene.children[0] as THREE.Sprite;
      expect(sprite.position.y).toBeCloseTo(0.5);
    });

    it('positions sprites at the correct world X/Z for row 2, col 3 on a 5×5 board', () => {
      const priceMap = makePriceMap([
        ['2-3', { percentIncrease: 30, tier: 'medium' }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const sprite = scene.children[0] as THREE.Sprite;
      // worldX = (3 - 5/2) * 1 = 0.5
      // worldZ = (2 - 5/2) * 1 = -0.5
      expect(sprite.position.x).toBeCloseTo(0.5);
      expect(sprite.position.z).toBeCloseTo(-0.5);
    });

    it('each added child is a THREE.Sprite', () => {
      const priceMap = makePriceMap([
        ['1-1', { percentIncrease: 15, tier: 'low'    }],
        ['3-4', { percentIncrease: 80, tier: 'critical' }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      for (const child of scene.children) {
        expect(child).toBeInstanceOf(THREE.Sprite);
      }
    });

    it('sprite material is transparent', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 20, tier: 'low' }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const sprite = scene.children[0] as THREE.Sprite;
      expect((sprite.material as THREE.SpriteMaterial).transparent).toBeTrue();
    });

    it('sprite material has a canvas texture map', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 20, tier: 'low' }],
      ]);

      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const sprite = scene.children[0] as THREE.Sprite;
      expect((sprite.material as THREE.SpriteMaterial).map).toBeInstanceOf(THREE.CanvasTexture);
    });
  });

  // ---------------------------------------------------------------------------
  // showLabels — replaces existing labels
  // ---------------------------------------------------------------------------

  describe('showLabels replaces existing labels', () => {
    it('replaces existing sprites — scene count matches new priceMap', () => {
      const firstMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low'  }],
        ['1-1', { percentIncrease: 20, tier: 'low'  }],
        ['2-2', { percentIncrease: 30, tier: 'medium' }],
      ]);
      service.showLabels(firstMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(3);

      const secondMap = makePriceMap([
        ['3-3', { percentIncrease: 50, tier: 'high' }],
      ]);
      service.showLabels(secondMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      // Only the one sprite from the second call must remain.
      expect(scene.children.length).toBe(1);
    });

    it('second showLabels positions sprite from second call', () => {
      const firstMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low' }],
      ]);
      service.showLabels(firstMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const secondMap = makePriceMap([
        ['4-4', { percentIncrease: 50, tier: 'high' }],
      ]);
      service.showLabels(secondMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      const sprite = scene.children[0] as THREE.Sprite;
      // worldX = (4 - 5/2) * 1 = 1.5, worldZ = (4 - 5/2) * 1 = 1.5
      expect(sprite.position.x).toBeCloseTo(1.5);
      expect(sprite.position.z).toBeCloseTo(1.5);
    });
  });

  // ---------------------------------------------------------------------------
  // hideLabels
  // ---------------------------------------------------------------------------

  describe('hideLabels', () => {
    it('removes all sprites from the scene', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 25, tier: 'medium' }],
        ['1-2', { percentIncrease: 40, tier: 'high'   }],
      ]);
      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(2);

      service.hideLabels(scene);

      expect(scene.children.length).toBe(0);
    });

    it('is idempotent — calling twice does not throw', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low' }],
      ]);
      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      expect(() => {
        service.hideLabels(scene);
        service.hideLabels(scene);
      }).not.toThrow();
    });

    it('is safe to call before any labels are shown', () => {
      expect(() => service.hideLabels(scene)).not.toThrow();
      expect(scene.children.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('removes all sprites from the scene when scene is provided', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low'  }],
        ['1-0', { percentIncrease: 20, tier: 'low'  }],
      ]);
      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      expect(scene.children.length).toBe(2);

      service.cleanup(scene);

      expect(scene.children.length).toBe(0);
    });

    it('disposes resources without scene argument', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low' }],
      ]);
      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);

      // Should not throw even without a scene reference.
      expect(() => service.cleanup()).not.toThrow();
    });

    it('is safe to call before any labels are shown', () => {
      expect(() => service.cleanup(scene)).not.toThrow();
    });

    it('can be called multiple times without error', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low' }],
      ]);
      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      service.cleanup(scene);

      expect(() => service.cleanup(scene)).not.toThrow();
    });

    it('after cleanup, showLabels still works', () => {
      const priceMap = makePriceMap([
        ['0-0', { percentIncrease: 10, tier: 'low' }],
      ]);
      service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
      service.cleanup(scene);

      const newScene = new THREE.Scene();
      const newMap = makePriceMap([
        ['1-1', { percentIncrease: 20, tier: 'medium' }],
        ['2-2', { percentIncrease: 40, tier: 'high'   }],
      ]);
      service.showLabels(newMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, newScene);

      expect(newScene.children.length).toBe(2);
      service.cleanup(newScene);
      newScene.clear();
    });
  });

  // ---------------------------------------------------------------------------
  // All tiers — smoke test
  // ---------------------------------------------------------------------------

  describe('all tier values', () => {
    const tiers = ['base', 'low', 'medium', 'high', 'critical', 'unknown'];

    tiers.forEach((tier, idx) => {
      it(`creates sprite without error for tier="${tier}"`, () => {
        const priceMap = makePriceMap([
          [`${idx}-0`, { percentIncrease: 10, tier }],
        ]);
        expect(() => {
          service.showLabels(priceMap, BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE, scene);
        }).not.toThrow();
        service.hideLabels(scene);
      });
    });
  });
});
