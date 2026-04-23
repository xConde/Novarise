import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TouchInteractionService } from './touch-interaction.service';
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
});
