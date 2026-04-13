import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CAMERA_CONFIG } from '../constants/camera.constants';
import { TowerType, PlacedTower } from '../models/tower.model';
import { GamePhase, GameState } from '../models/game-state.model';

export const TOWER_HOTKEYS: Record<string, TowerType> = {
  '1': TowerType.BASIC,
  '2': TowerType.SNIPER,
  '3': TowerType.SPLASH,
  '4': TowerType.SLOW,
  '5': TowerType.CHAIN,
  '6': TowerType.MORTAR,
};

export interface HotkeyActions {
  onSpace: () => void;
  onPause: () => void;
  onEscape: () => void;
  onToggleRanges: () => void;
  onToggleMinimap: () => void;
  onTogglePath: () => void;
  onUpgrade: () => void;
  onCycleTargeting: () => void;
  onSell: () => void;
  onTowerHotkey: (type: TowerType) => void;
  isInRun: () => boolean;
  isPlaceMode: () => boolean;
  getSelectedTowerInfo: () => PlacedTower | null;
}

@Injectable()
export class GameInputService implements OnDestroy {
  readonly hotkey$ = new Subject<KeyboardEvent>();

  private readonly panKeys = new Set<string>();
  private readonly _panForward = new THREE.Vector3();
  private readonly _panRight = new THREE.Vector3();
  private readonly _panUp = new THREE.Vector3(0, 1, 0);

  private keydownHandler!: (e: KeyboardEvent) => void;
  private keyupHandler!: (e: KeyboardEvent) => void;

  private static readonly PAN_KEYS = [
    'w', 'a', 's', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ];

  init(): void {
    // Guard: tear down existing listeners before attaching new ones (prevents orphaned listeners on double-init)
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('keyup', this.keyupHandler);
      this.panKeys.clear();
    }
    this.keydownHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (GameInputService.PAN_KEYS.includes(key)) {
        this.panKeys.add(key);
      }
      this.hotkey$.next(e);
    };
    this.keyupHandler = (e: KeyboardEvent) => {
      this.panKeys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  updateCameraPan(camera: THREE.PerspectiveCamera, controls: OrbitControls): void {
    if (this.panKeys.size === 0) return;

    // Forward = camera look direction projected onto XZ plane
    camera.getWorldDirection(this._panForward);
    this._panForward.y = 0;
    this._panForward.normalize();

    // Right = forward × up (perpendicular on XZ plane)
    this._panRight.crossVectors(this._panForward, this._panUp).normalize();

    let moveX = 0;
    let moveZ = 0;

    if (this.panKeys.has('w') || this.panKeys.has('arrowup')) {
      moveX += this._panForward.x * CAMERA_CONFIG.panSpeed;
      moveZ += this._panForward.z * CAMERA_CONFIG.panSpeed;
    }
    if (this.panKeys.has('s') || this.panKeys.has('arrowdown')) {
      moveX -= this._panForward.x * CAMERA_CONFIG.panSpeed;
      moveZ -= this._panForward.z * CAMERA_CONFIG.panSpeed;
    }
    if (this.panKeys.has('a') || this.panKeys.has('arrowleft')) {
      moveX -= this._panRight.x * CAMERA_CONFIG.panSpeed;
      moveZ -= this._panRight.z * CAMERA_CONFIG.panSpeed;
    }
    if (this.panKeys.has('d') || this.panKeys.has('arrowright')) {
      moveX += this._panRight.x * CAMERA_CONFIG.panSpeed;
      moveZ += this._panRight.z * CAMERA_CONFIG.panSpeed;
    }

    camera.position.x += moveX;
    camera.position.z += moveZ;
    controls.target.x += moveX;
    controls.target.z += moveZ;
  }

  /**
   * Dispatches a keyboard event to the appropriate action callback.
   * Terminal-phase guard and pause guard are applied here.
   */
  dispatchHotkey(event: KeyboardEvent, state: GameState, actions: HotkeyActions): void {
    const phase = state.phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    // Block all inputs except pause/resume keys when the game is paused
    if (state.isPaused && event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') return;

    // Tower hotkeys 1-6 only work in standalone mode
    if (TOWER_HOTKEYS[event.key] && !actions.isInRun()) {
      event.preventDefault();
      actions.onTowerHotkey(TOWER_HOTKEYS[event.key]);
      return;
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        actions.onSpace();
        break;
      case 'p': case 'P':
        event.preventDefault();
        actions.onPause();
        break;
      case 'Escape':
        event.preventDefault();
        actions.onEscape();
        break;
      case 'r': case 'R':
        event.preventDefault();
        actions.onToggleRanges();
        break;
      case 'm': case 'M':
        event.preventDefault();
        actions.onToggleMinimap();
        break;
      case 'v': case 'V':
        event.preventDefault();
        actions.onTogglePath();
        break;
      case 'u': case 'U':
        event.preventDefault();
        actions.onUpgrade();
        break;
      case 't': case 'T':
        event.preventDefault();
        actions.onCycleTargeting();
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        actions.onSell();
        break;
    }
  }

  cleanup(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler);
    }
    this.panKeys.clear();
    this.hotkey$.complete();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
