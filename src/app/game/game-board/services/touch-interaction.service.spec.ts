import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TouchInteractionService, TouchPlacementCallbacks } from './touch-interaction.service';
import { SceneService } from './scene.service';
import { GameStateService } from './game-state.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { PathfindingService } from './pathfinding.service';
import { GamePhase } from '../models/game-state.model';

/** Typed access to private members needed in tests. Local to this spec only. */
interface TestableTouchInteraction {
  touchStartX: number;
  touchStartY: number;
  touchStartTime: number;
  touchIsDragging: boolean;
  pinchStartDistance: number;
  touchStartHandler: (e: TouchEvent) => void;
  touchMoveHandler: (e: TouchEvent) => void;
  touchEndHandler: (e: TouchEvent) => void;
}

/** Minimal stub for GameStateService — only isPaused is needed. */
class StubGameStateService {
  private _paused = false;
  setPaused(v: boolean): void { this._paused = v; }
  getState() { return { isPaused: this._paused, phase: GamePhase.SETUP }; }
}

/** Minimal stub for SceneService — only camera and controls are needed. */
class StubSceneService {
  private camera = { position: new THREE.Vector3(0, 10, 0) };
  private controls = { target: new THREE.Vector3(0, 0, 0), enabled: true };
  getCamera() { return this.camera as unknown as THREE.PerspectiveCamera; }
  getControls() { return this.controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls; }
}

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

describe('TouchInteractionService', () => {
  let service: TouchInteractionService;
  let svc: TestableTouchInteraction;
  let gameStateStub: StubGameStateService;
  let sceneStub: StubSceneService;

  beforeEach(() => {
    gameStateStub = new StubGameStateService();
    sceneStub = new StubSceneService();

    TestBed.configureTestingModule({
      providers: [
        TouchInteractionService,
        BoardMeshRegistryService,
        GameBoardService,
        PathfindingService,
        { provide: GameStateService, useValue: gameStateStub },
        { provide: SceneService, useValue: sceneStub },
      ],
    });
    service = TestBed.inject(TouchInteractionService);
    svc = service as unknown as TestableTouchInteraction;
  });

  afterEach(() => {
    service.cleanup();
  });

  // ---------------------------------------------------------------------------
  // init() — listener registration
  // ---------------------------------------------------------------------------

  describe('init()', () => {
    it('registers touchstart, touchmove, and touchend on the canvas', () => {
      const canvas = makeCanvas();
      const addSpy = spyOn(canvas, 'addEventListener').and.callThrough();
      service.init(canvas, () => {});

      const events = addSpy.calls.allArgs().map(a => a[0]);
      expect(events).toContain('touchstart');
      expect(events).toContain('touchmove');
      expect(events).toContain('touchend');
    });

    it('registers handlers as passive: false', () => {
      const canvas = makeCanvas();
      const addSpy = spyOn(canvas, 'addEventListener').and.callThrough();
      service.init(canvas, () => {});

      const startArgs = addSpy.calls.allArgs().find(a => a[0] === 'touchstart');
      expect(startArgs?.[2]).toEqual({ passive: false });
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup() — listener removal
  // ---------------------------------------------------------------------------

  describe('cleanup()', () => {
    it('removes touchstart, touchmove, and touchend from the canvas', () => {
      const canvas = makeCanvas();
      const removeSpy = spyOn(canvas, 'removeEventListener').and.callThrough();
      service.init(canvas, () => {});
      service.cleanup();

      const events = removeSpy.calls.allArgs().map(a => a[0]);
      expect(events).toContain('touchstart');
      expect(events).toContain('touchmove');
      expect(events).toContain('touchend');
    });

    it('cleanup() is idempotent — second call does not throw', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // touchStartHandler — single touch
  // ---------------------------------------------------------------------------

  describe('touchStartHandler', () => {
    it('records start position and resets drag flag', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      svc.touchIsDragging = true;

      const touch = { clientX: 150, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;
      svc.touchStartHandler(event);

      expect(svc.touchStartX).toBe(150);
      expect(svc.touchStartY).toBe(200);
      expect(svc.touchIsDragging).toBeFalse();
    });

    it('records pinch start distance for two-finger touch', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});

      const t0 = { clientX: 0, clientY: 0 } as Touch;
      const t1 = { clientX: 30, clientY: 40 } as Touch;
      const event = { preventDefault: () => {}, touches: [t0, t1] } as unknown as TouchEvent;
      svc.touchStartHandler(event);

      // sqrt(30^2 + 40^2) = 50
      expect(svc.pinchStartDistance).toBe(50);
    });

    it('does nothing when paused', () => {
      gameStateStub.setPaused(true);
      const canvas = makeCanvas();
      service.init(canvas, () => {});

      const touch = { clientX: 99, clientY: 88 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;
      svc.touchStartHandler(event);

      // Start position should remain 0 (initial)
      expect(svc.touchStartX).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // touchMoveHandler
  // ---------------------------------------------------------------------------

  describe('touchMoveHandler', () => {
    it('sets touchIsDragging when movement exceeds threshold', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      svc.touchStartX = 0;
      svc.touchStartY = 0;

      const touch = { clientX: 20, clientY: 20 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;
      svc.touchMoveHandler(event);

      expect(svc.touchIsDragging).toBeTrue();
    });

    it('does not set touchIsDragging when movement is within threshold', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      svc.touchStartX = 0;
      svc.touchStartY = 0;
      svc.touchIsDragging = false;

      // 3-4-5 triangle: dist = 5, below threshold of 10
      const touch = { clientX: 3, clientY: 4 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;
      svc.touchMoveHandler(event);

      expect(svc.touchIsDragging).toBeFalse();
    });

    it('does nothing when paused', () => {
      gameStateStub.setPaused(true);
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      svc.touchStartX = 0;
      svc.touchStartY = 0;

      const touch = { clientX: 50, clientY: 50 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;
      svc.touchMoveHandler(event);

      expect(svc.touchIsDragging).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // touchEndHandler
  // ---------------------------------------------------------------------------

  describe('touchEndHandler', () => {
    it('calls onTap for a short tap with no drag', () => {
      let tapX = 0;
      let tapY = 0;
      let tapped = false;
      const canvas = makeCanvas();
      service.init(canvas, (x, y) => { tapped = true; tapX = x; tapY = y; });
      svc.touchStartX = 100;
      svc.touchStartY = 200;
      svc.touchStartTime = performance.now() - 50; // 50ms — within 300ms
      svc.touchIsDragging = false;

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;
      svc.touchEndHandler(event);

      expect(tapped).toBeTrue();
      expect(tapX).toBe(100);
      expect(tapY).toBe(200);
    });

    it('does not call onTap when drag occurred', () => {
      let tapped = false;
      const canvas = makeCanvas();
      service.init(canvas, () => { tapped = true; });
      svc.touchStartTime = performance.now() - 50;
      svc.touchIsDragging = true;

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;
      svc.touchEndHandler(event);

      expect(tapped).toBeFalse();
    });

    it('does not call onTap when tap duration exceeds threshold', () => {
      let tapped = false;
      const canvas = makeCanvas();
      service.init(canvas, () => { tapped = true; });
      svc.touchStartTime = performance.now() - 500; // 500ms > 300ms threshold
      svc.touchIsDragging = false;

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;
      svc.touchEndHandler(event);

      expect(tapped).toBeFalse();
    });

    it('resets touchIsDragging and pinchStartDistance', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      svc.touchIsDragging = true;
      svc.pinchStartDistance = 50;
      svc.touchStartTime = performance.now() - 500;

      const touch = { clientX: 0, clientY: 0 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;
      svc.touchEndHandler(event);

      expect(svc.touchIsDragging).toBeFalse();
      expect(svc.pinchStartDistance).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // ngOnDestroy
  // ---------------------------------------------------------------------------

  describe('ngOnDestroy()', () => {
    it('delegates to cleanup()', () => {
      spyOn(service, 'cleanup');
      service.ngOnDestroy();
      expect(service.cleanup).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Two-step touch placement
  // ---------------------------------------------------------------------------

  /**
   * Helper: build a minimal TouchPlacementCallbacks stub.
   * - `coord`: what resolveTileCoord returns (null = off-board miss)
   * - `canPlace`: what canPlaceAt returns (default true = valid tile)
   */
  function makePlacementCallbacks(
    opts: {
      isPlaceMode?: boolean;
      coord?: { row: number; col: number } | null;
      canPlace?: boolean;
    } = {}
  ): {
    callbacks: TouchPlacementCallbacks;
    showPreviewAt: jasmine.Spy;
    hidePreview: jasmine.Spy;
    confirmPlacement: jasmine.Spy;
    onPendingTileChanged: jasmine.Spy;
  } {
    const inPlaceMode = opts.isPlaceMode ?? true;
    const coord = opts.coord !== undefined ? opts.coord : { row: 2, col: 3 };
    const canPlaceResult = opts.canPlace !== undefined ? opts.canPlace : true;
    const showPreviewAt = jasmine.createSpy('showPreviewAt');
    const hidePreview = jasmine.createSpy('hidePreview');
    const confirmPlacement = jasmine.createSpy('confirmPlacement');
    const onPendingTileChanged = jasmine.createSpy('onPendingTileChanged');

    const callbacks: TouchPlacementCallbacks = {
      isPlaceMode: () => inPlaceMode,
      resolveTileCoord: () => coord,
      canPlaceAt: () => canPlaceResult,
      showPreviewAt,
      hidePreview,
      confirmPlacement,
      onPendingTileChanged,
    };
    return { callbacks, showPreviewAt, hidePreview, confirmPlacement, onPendingTileChanged };
  }

  /** Fire a touch-end event that reads as a short tap at (x, y). */
  function fireTap(x: number, y: number): void {
    svc.touchStartX = x;
    svc.touchStartY = y;
    svc.touchStartTime = performance.now() - 50; // 50ms < 300ms threshold
    svc.touchIsDragging = false;
    const touch = { clientX: x, clientY: y } as Touch;
    const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;
    svc.touchEndHandler(event);
  }

  describe('two-step touch placement — initPlacementCallbacks()', () => {
    it('first tap on a valid tile shows preview and does NOT confirm', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, showPreviewAt, confirmPlacement } = makePlacementCallbacks({
        coord: { row: 1, col: 2 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(100, 200);

      expect(showPreviewAt).toHaveBeenCalledOnceWith(1, 2);
      expect(confirmPlacement).not.toHaveBeenCalled();
    });

    it('first tap notifies onPendingTileChanged(true)', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, onPendingTileChanged } = makePlacementCallbacks({
        coord: { row: 0, col: 0 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(10, 10);

      expect(onPendingTileChanged).toHaveBeenCalledWith(true);
    });

    it('second tap on the same tile confirms placement exactly once', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, confirmPlacement, showPreviewAt } = makePlacementCallbacks({
        coord: { row: 2, col: 3 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(100, 100); // first tap — sets pendingTile
      fireTap(100, 100); // second tap — same tile, confirms

      expect(confirmPlacement).toHaveBeenCalledOnceWith(2, 3);
      // showPreviewAt called only once (first tap)
      expect(showPreviewAt).toHaveBeenCalledTimes(1);
    });

    it('second tap on the same tile notifies onPendingTileChanged(false) on confirm', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, onPendingTileChanged } = makePlacementCallbacks({
        coord: { row: 2, col: 3 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(100, 100); // first tap
      onPendingTileChanged.calls.reset();
      fireTap(100, 100); // second tap — confirm, pending cleared

      expect(onPendingTileChanged).toHaveBeenCalledWith(false);
    });

    it('retarget: tapping a different tile moves the preview (stays in step one)', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});

      let tapCount = 0;
      const coords = [{ row: 1, col: 1 }, { row: 3, col: 4 }];
      const showPreviewAt = jasmine.createSpy('showPreviewAt');
      const confirmPlacement = jasmine.createSpy('confirmPlacement');
      const onPendingTileChanged = jasmine.createSpy('onPendingTileChanged');

      const callbacks: TouchPlacementCallbacks = {
        isPlaceMode: () => true,
        resolveTileCoord: () => coords[tapCount < 1 ? 0 : 1],
        canPlaceAt: () => true,
        showPreviewAt,
        hidePreview: jasmine.createSpy('hidePreview'),
        confirmPlacement,
        onPendingTileChanged,
      };
      service.initPlacementCallbacks(callbacks);

      fireTap(50, 50);   // first tap → tile (1,1)
      tapCount = 1;
      fireTap(200, 200); // second tap → different tile (3,4) → retarget, NOT confirm

      expect(confirmPlacement).not.toHaveBeenCalled();
      expect(showPreviewAt).toHaveBeenCalledTimes(2);
      expect(showPreviewAt).toHaveBeenCalledWith(1, 1);
      expect(showPreviewAt).toHaveBeenCalledWith(3, 4);
      // getPendingTile should track the latest tile
      expect(service.getPendingTile()).toEqual({ row: 3, col: 4 });
    });

    it('tapping off-board (resolveTileCoord returns null) cancels the pending preview', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, hidePreview, onPendingTileChanged } = makePlacementCallbacks({
        coord: { row: 1, col: 1 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(100, 100); // first tap — sets pending tile

      // Now configure resolveTileCoord to return null (off-board miss)
      (callbacks as unknown as { resolveTileCoord: () => null }).resolveTileCoord = () => null;
      fireTap(999, 999); // tap off-board

      expect(hidePreview).toHaveBeenCalled();
      expect(onPendingTileChanged).toHaveBeenCalledWith(false);
      expect(service.getPendingTile()).toBeNull();
    });

    it('tapping a structurally invalid tile (canPlaceAt=false) cancels the pending preview', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      // canPlace: false → occupied / wall / path-blocking tile
      const { callbacks, hidePreview, onPendingTileChanged } = makePlacementCallbacks({
        coord: { row: 2, col: 2 },
        canPlace: false,
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(100, 100); // tap invalid tile — should NOT set pending

      expect(hidePreview).toHaveBeenCalled();
      expect(onPendingTileChanged).not.toHaveBeenCalledWith(true);
      expect(service.getPendingTile()).toBeNull();
    });

    it('placing mode exit via clearPendingTile() resets pending state', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, onPendingTileChanged } = makePlacementCallbacks({
        coord: { row: 0, col: 0 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(10, 10); // set pending tile
      service.clearPendingTile(); // simulate cancelPlacement() call

      expect(service.getPendingTile()).toBeNull();
      expect(onPendingTileChanged).toHaveBeenCalledWith(false);
    });

    it('does not intercept taps when not in place mode — forwards to onTap', () => {
      let tapped = false;
      const canvas = makeCanvas();
      service.init(canvas, () => { tapped = true; });
      const { callbacks } = makePlacementCallbacks({ isPlaceMode: false });
      service.initPlacementCallbacks(callbacks);

      fireTap(100, 100);

      expect(tapped).toBeTrue();
    });

    it('cleanup() clears pending tile and nulls placement callbacks', () => {
      const canvas = makeCanvas();
      service.init(canvas, () => {});
      const { callbacks, onPendingTileChanged } = makePlacementCallbacks({
        coord: { row: 1, col: 1 },
      });
      service.initPlacementCallbacks(callbacks);

      fireTap(10, 10); // set a pending tile
      onPendingTileChanged.calls.reset();
      service.cleanup();

      expect(service.getPendingTile()).toBeNull();
      // onPendingTileChanged notified during cleanup
      expect(onPendingTileChanged).toHaveBeenCalledWith(false);
    });
  });
});
