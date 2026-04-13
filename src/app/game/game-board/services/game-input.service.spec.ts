import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { GameInputService, HotkeyActions, TOWER_HOTKEYS } from './game-input.service';
import { TowerType } from '../models/tower.model';
import { GamePhase, INITIAL_GAME_STATE } from '../models/game-state.model';
import { GameModifier } from '../models/game-modifier.model';

/** Minimal OrbitControls stub — only the fields updateCameraPan touches. */
class StubOrbitControls {
  target = new THREE.Vector3();
}

function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  cam.position.set(0, 20, 20);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('GameInputService', () => {
  let service: GameInputService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameInputService],
    });
    service = TestBed.inject(GameInputService);
  });

  afterEach(() => {
    // Guard: complete hotkey$ if it hasn't been already (avoids open subscription warnings)
    try { service.cleanup(); } catch { /* already cleaned */ }
  });

  // -----------------------------------------------------------------------
  // init() — listener registration
  // -----------------------------------------------------------------------

  describe('init()', () => {
    it('registers a keydown listener on window', () => {
      spyOn(window, 'addEventListener').and.callThrough();
      service.init();

      const calls: readonly unknown[][] = (window.addEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keydown')).toBeTrue();
      service.cleanup();
    });

    it('registers a keyup listener on window', () => {
      spyOn(window, 'addEventListener').and.callThrough();
      service.init();

      const calls: readonly unknown[][] = (window.addEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keyup')).toBeTrue();
      service.cleanup();
    });

    it('double-init does not orphan listeners', () => {
      service.init();
      const firstHandler = (service as unknown as Record<string, unknown>)['keydownHandler'];

      // Spy on removeEventListener to verify cleanup during second init
      spyOn(window, 'removeEventListener').and.callThrough();
      service.init();

      // First handler should have been removed
      const removeCalls: readonly unknown[][] = (window.removeEventListener as jasmine.Spy).calls.allArgs();
      expect(removeCalls.some(args => args[0] === 'keydown' && args[1] === firstHandler)).toBeTrue();

      // Only one keydown event should fire per key press (not two)
      let count = 0;
      service.hotkey$.subscribe(() => count++);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      expect(count).toBe(1);

      service.cleanup();
    });
  });

  // -----------------------------------------------------------------------
  // cleanup() — listener removal
  // -----------------------------------------------------------------------

  describe('cleanup()', () => {
    it('removes the keydown listener from window', () => {
      service.init();
      spyOn(window, 'removeEventListener').and.callThrough();
      service.cleanup();

      const calls: readonly unknown[][] = (window.removeEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keydown')).toBeTrue();
    });

    it('removes the keyup listener from window', () => {
      service.init();
      spyOn(window, 'removeEventListener').and.callThrough();
      service.cleanup();

      const calls: readonly unknown[][] = (window.removeEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keyup')).toBeTrue();
    });

    it('completes hotkey$', () => {
      service.init();
      let completed = false;
      service.hotkey$.subscribe({ complete: () => (completed = true) });
      service.cleanup();
      expect(completed).toBeTrue();
    });
  });

  // -----------------------------------------------------------------------
  // hotkey$ — event emission
  // -----------------------------------------------------------------------

  describe('hotkey$', () => {
    it('emits every keydown event including non-pan keys', () => {
      service.init();

      const received: KeyboardEvent[] = [];
      const sub = service.hotkey$.subscribe(e => received.push(e));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

      expect(received.length).toBe(2);
      expect(received[0].key).toBe('p');
      expect(received[1].key).toBe('1');

      sub.unsubscribe();
      service.cleanup();
    });

    it('does not emit after cleanup()', () => {
      service.init();

      const received: KeyboardEvent[] = [];
      service.hotkey$.subscribe({ next: e => received.push(e), complete: () => {} });

      service.cleanup();
      // Dispatch after cleanup — should NOT arrive (handlers removed and subject completed)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));

      expect(received.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // updateCameraPan() — camera movement
  // -----------------------------------------------------------------------

  describe('updateCameraPan()', () => {
    it('does nothing when no pan keys are held', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();
      const beforeX = camera.position.x;
      const beforeZ = camera.position.z;

      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.x).toBe(beforeX);
      expect(camera.position.z).toBe(beforeZ);
      service.cleanup();
    });

    it('moves camera forward when W is held', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      // Camera was looking toward negative Z; W = forward = z should decrease
      expect(camera.position.z).toBeLessThan(beforeZ);
      service.cleanup();
    });

    it('moves camera backward when S is held', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.z).toBeGreaterThan(beforeZ);
      service.cleanup();
    });

    it('moves OrbitControls target by the same delta as the camera', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

      const camBeforeX = camera.position.x;
      const tgtBeforeX = controls.target.x;

      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      const camDelta = camera.position.x - camBeforeX;
      const tgtDelta = controls.target.x - tgtBeforeX;

      expect(camDelta).toBeCloseTo(tgtDelta, 5);
      service.cleanup();
    });

    it('stops moving after keyup clears the pan key', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.z).toBe(beforeZ);
      service.cleanup();
    });

    it('supports ArrowUp as equivalent to W', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.z).toBeLessThan(beforeZ);
      service.cleanup();
    });
  });

  // -----------------------------------------------------------------------
  // ngOnDestroy — delegates to cleanup
  // -----------------------------------------------------------------------

  describe('ngOnDestroy()', () => {
    it('calls cleanup()', () => {
      spyOn(service, 'cleanup');
      service.ngOnDestroy();
      expect(service.cleanup).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // dispatchHotkey()
  // -----------------------------------------------------------------------

  describe('dispatchHotkey()', () => {
    function makeState(overrides: Partial<typeof INITIAL_GAME_STATE> = {}) {
      return {
        ...INITIAL_GAME_STATE,
        activeModifiers: new Set<GameModifier>(),
        ...overrides,
      };
    }

    function makeActions(overrides: Partial<HotkeyActions> = {}): HotkeyActions {
      return {
        onSpace: jasmine.createSpy('onSpace'),
        onPause: jasmine.createSpy('onPause'),
        onEscape: jasmine.createSpy('onEscape'),
        onToggleRanges: jasmine.createSpy('onToggleRanges'),
        onToggleHelp: jasmine.createSpy('onToggleHelp'),
        onToggleEncyclopedia: jasmine.createSpy('onToggleEncyclopedia'),
        onToggleMinimap: jasmine.createSpy('onToggleMinimap'),
        onTogglePath: jasmine.createSpy('onTogglePath'),
        onUpgrade: jasmine.createSpy('onUpgrade'),
        onCycleTargeting: jasmine.createSpy('onCycleTargeting'),
        onSell: jasmine.createSpy('onSell'),
        onTowerHotkey: jasmine.createSpy('onTowerHotkey'),
        isInRun: jasmine.createSpy('isInRun').and.returnValue(false),
        isPlaceMode: jasmine.createSpy('isPlaceMode').and.returnValue(false),
        getSelectedTowerInfo: jasmine.createSpy('getSelectedTowerInfo').and.returnValue(null),
        ...overrides,
      };
    }

    it('does nothing in VICTORY phase', () => {
      const state = makeState({ phase: GamePhase.VICTORY });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'u' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onUpgrade).not.toHaveBeenCalled();
    });

    it('does nothing in DEFEAT phase', () => {
      const state = makeState({ phase: GamePhase.DEFEAT });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'u' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onUpgrade).not.toHaveBeenCalled();
    });

    it('blocks non-pause keys when paused', () => {
      const state = makeState({ phase: GamePhase.COMBAT, isPaused: true });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'u' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onUpgrade).not.toHaveBeenCalled();
    });

    it('allows Escape when paused', () => {
      const state = makeState({ phase: GamePhase.COMBAT, isPaused: true });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onEscape).toHaveBeenCalled();
    });

    it('Space calls onSpace', () => {
      const state = makeState({ phase: GamePhase.COMBAT });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: ' ' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onSpace).toHaveBeenCalled();
    });

    it('p calls onPause', () => {
      const state = makeState({ phase: GamePhase.COMBAT });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'p' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onPause).toHaveBeenCalled();
    });

    it('u calls onUpgrade', () => {
      const state = makeState({ phase: GamePhase.COMBAT });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'u' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onUpgrade).toHaveBeenCalled();
    });

    it('Delete calls onSell', () => {
      const state = makeState({ phase: GamePhase.COMBAT });
      const actions = makeActions();
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onSell).toHaveBeenCalled();
    });

    it('tower hotkey 1 calls onTowerHotkey with BASIC when not in run', () => {
      const state = makeState({ phase: GamePhase.SETUP });
      const actions = makeActions({ isInRun: jasmine.createSpy().and.returnValue(false) });
      const event = new KeyboardEvent('keydown', { key: '1' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onTowerHotkey).toHaveBeenCalledWith(TowerType.BASIC);
    });

    it('tower hotkey 1 is blocked in run mode', () => {
      const state = makeState({ phase: GamePhase.SETUP });
      const actions = makeActions({ isInRun: jasmine.createSpy().and.returnValue(true) });
      const event = new KeyboardEvent('keydown', { key: '1' });
      service.dispatchHotkey(event, state, actions);
      expect(actions.onTowerHotkey).not.toHaveBeenCalled();
    });

    it('TOWER_HOTKEYS maps 1-6 to correct TowerTypes', () => {
      expect(TOWER_HOTKEYS['1']).toBe(TowerType.BASIC);
      expect(TOWER_HOTKEYS['2']).toBe(TowerType.SNIPER);
      expect(TOWER_HOTKEYS['3']).toBe(TowerType.SPLASH);
      expect(TOWER_HOTKEYS['4']).toBe(TowerType.SLOW);
      expect(TOWER_HOTKEYS['5']).toBe(TowerType.CHAIN);
      expect(TOWER_HOTKEYS['6']).toBe(TowerType.MORTAR);
    });
  });
});
