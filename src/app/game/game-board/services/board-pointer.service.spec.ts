import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { BoardPointerService, PointerCallbacks } from './board-pointer.service';
import { SceneService } from './scene.service';
import { GameStateService } from './game-state.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TileHighlightService } from './tile-highlight.service';
import { TowerPreviewService } from './tower-preview.service';
import { PathfindingService } from './pathfinding.service';
import { GamePhase } from '../models/game-state.model';
import { TowerType } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';

/** Minimal stub for GameStateService. */
class StubGameStateService {
  private _paused = false;
  private _phase = GamePhase.SETUP;
  setPaused(v: boolean): void { this._paused = v; }
  setPhase(p: GamePhase): void { this._phase = p; }
  getState() { return { isPaused: this._paused, phase: this._phase, gold: 100 }; }
  getModifierEffects() { return { towerCostMultiplier: 1 }; }
  canAfford(_cost: number): boolean { return true; }
}

/** Minimal stub for SceneService. */
class StubSceneService {
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  getCamera() { return this.camera; }
  getRenderer() { return { domElement: document.createElement('canvas') }; }
}

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

/** Builds a minimal PointerCallbacks object with spies. */
function makeCallbacks(): jasmine.SpyObj<PointerCallbacks> {
  return jasmine.createSpyObj<PointerCallbacks>('PointerCallbacks', [
    'onTowerClick', 'onTilePlace', 'onDeselect', 'onCancelPlacement', 'onContextMenu', 'getPlacementState',
  ]);
}

describe('BoardPointerService', () => {
  let service: BoardPointerService;
  let gameStateStub: StubGameStateService;

  beforeEach(() => {
    gameStateStub = new StubGameStateService();

    TestBed.configureTestingModule({
      providers: [
        BoardPointerService,
        BoardMeshRegistryService,
        TileHighlightService,
        TowerPreviewService,
        GameBoardService,
        PathfindingService,
        { provide: GameStateService, useValue: gameStateStub },
        { provide: SceneService, useValue: new StubSceneService() },
      ],
    });
    service = TestBed.inject(BoardPointerService);
  });

  afterEach(() => {
    service.cleanup();
  });

  // ---------------------------------------------------------------------------
  // init() — listener registration
  // ---------------------------------------------------------------------------

  describe('init()', () => {
    it('registers mousemove, click, and contextmenu on the canvas', () => {
      const canvas = makeCanvas();
      const addSpy = spyOn(canvas, 'addEventListener').and.callThrough();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({ isPlaceMode: false, towerType: null, gold: 100, selectedTowerInfo: null });
      service.init(canvas, cb);

      const events = addSpy.calls.allArgs().map(a => a[0]);
      expect(events).toContain('mousemove');
      expect(events).toContain('click');
      expect(events).toContain('contextmenu');
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup() — listener removal
  // ---------------------------------------------------------------------------

  describe('cleanup()', () => {
    it('removes mousemove, click, and contextmenu from the canvas', () => {
      const canvas = makeCanvas();
      const removeSpy = spyOn(canvas, 'removeEventListener').and.callThrough();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({ isPlaceMode: false, towerType: null, gold: 100, selectedTowerInfo: null });
      service.init(canvas, cb);
      service.cleanup();

      const events = removeSpy.calls.allArgs().map(a => a[0]);
      expect(events).toContain('mousemove');
      expect(events).toContain('click');
      expect(events).toContain('contextmenu');
    });

    it('cleanup() is idempotent — second call does not throw', () => {
      const canvas = makeCanvas();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({ isPlaceMode: false, towerType: null, gold: 100, selectedTowerInfo: null });
      service.init(canvas, cb);
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // pause guard
  // ---------------------------------------------------------------------------

  describe('pause guard', () => {
    it('click handler does nothing when paused', () => {
      gameStateStub.setPaused(true);
      const canvas = makeCanvas();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({ isPlaceMode: false, towerType: null, gold: 100, selectedTowerInfo: null });
      service.init(canvas, cb);

      const handleInteractionSpy = spyOn(service, 'handleInteraction');
      const clickEvent = new MouseEvent('click', { clientX: 50, clientY: 50 });
      canvas.dispatchEvent(clickEvent);

      expect(handleInteractionSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleInteraction — empty scene (no intersections)
  // ---------------------------------------------------------------------------

  describe('handleInteraction()', () => {
    it('calls onDeselect when no tile is hit', () => {
      const canvas = makeCanvas();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({ isPlaceMode: false, towerType: null, gold: 100, selectedTowerInfo: null });
      service.init(canvas, cb);

      // Mock raycaster to return empty intersections
      spyOn((service as any).raycaster, 'intersectObjects').and.returnValue([]);

      service.handleInteraction(50, 50);

      expect(cb.onDeselect).toHaveBeenCalled();
    });

    it('does not call onTilePlace in INSPECT mode (isPlaceMode = false)', () => {
      const canvas = makeCanvas();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({ isPlaceMode: false, towerType: null, gold: 100, selectedTowerInfo: null });
      service.init(canvas, cb);

      // Mock a tile hit
      const fakeMesh = new THREE.Mesh();
      fakeMesh.userData['row'] = 2;
      fakeMesh.userData['col'] = 3;
      fakeMesh.userData['tile'] = { type: BlockType.BASE };
      fakeMesh.material = new THREE.MeshStandardMaterial();

      const raycaster = (service as any).raycaster as THREE.Raycaster;
      let callCount = 0;
      spyOn(raycaster, 'intersectObjects').and.callFake(() => {
        callCount++;
        // First call: tower children (empty), second call: tiles (hit)
        if (callCount === 1) return [];
        return [{ object: fakeMesh, distance: 1, point: new THREE.Vector3(), face: null, uv: undefined, uv2: undefined, normal: undefined, instanceId: undefined } as any];
      });

      service.handleInteraction(50, 50);

      expect(cb.onTilePlace).not.toHaveBeenCalled();
      expect(cb.onDeselect).toHaveBeenCalled();
    });

    it('calls onTilePlace in PLACE mode when a tile is hit', () => {
      const canvas = makeCanvas();
      const cb = makeCallbacks();
      cb.getPlacementState.and.returnValue({
        isPlaceMode: true,
        towerType: TowerType.BASIC,
        gold: 100,
        selectedTowerInfo: null,
      });
      service.init(canvas, cb);

      const fakeMesh = new THREE.Mesh();
      fakeMesh.userData['row'] = 1;
      fakeMesh.userData['col'] = 2;
      fakeMesh.userData['tile'] = { type: BlockType.BASE };
      fakeMesh.material = new THREE.MeshStandardMaterial();

      const raycaster = (service as any).raycaster as THREE.Raycaster;
      let callCount = 0;
      spyOn(raycaster, 'intersectObjects').and.callFake(() => {
        callCount++;
        if (callCount === 1) return [];
        return [{ object: fakeMesh } as any];
      });

      service.handleInteraction(50, 50);

      expect(cb.onTilePlace).toHaveBeenCalledWith(1, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // clearSelectedTile / getSelectedTile
  // ---------------------------------------------------------------------------

  describe('clearSelectedTile() / getSelectedTile()', () => {
    it('getSelectedTile returns null initially', () => {
      expect(service.getSelectedTile()).toBeNull();
    });

    it('clearSelectedTile resets selected tile and preview key', () => {
      (service as any).selectedTile = { row: 1, col: 2 };
      (service as any).lastPreviewKey = 'key';
      service.clearSelectedTile();

      expect(service.getSelectedTile()).toBeNull();
      expect((service as any).lastPreviewKey).toBe('');
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
