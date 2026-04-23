import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, fromEvent, merge } from 'rxjs';
import { map, distinctUntilChanged, startWith } from 'rxjs/operators';
import { JOYSTICK_BREAKPOINTS } from '../models/joystick.types';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  hasTouchSupport: boolean;
  deviceType: DeviceType;
  orientation: Orientation;
  screenWidth: number;
  screenHeight: number;
  showVirtualControls: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TouchDetectionService {
  private deviceInfo$ = new BehaviorSubject<DeviceInfo>(this.detectDevice());
  // Root-scoped — no ngOnDestroy needed. Field captured for discoverability and testability.
  private readonly resizeSub: Subscription | null;

  constructor() {
    // Listen for resize and orientation changes
    if (typeof window !== 'undefined') {
      this.resizeSub = merge(
        fromEvent(window, 'resize'),
        fromEvent(window, 'orientationchange')
      ).pipe(
        startWith(null),
        map(() => this.detectDevice()),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      ).subscribe(info => this.deviceInfo$.next(info));
    } else {
      this.resizeSub = null;
    }
  }

  /**
   * Get current device info as observable
   */
  getDeviceInfo(): Observable<DeviceInfo> {
    return this.deviceInfo$.asObservable();
  }

  /**
   * Get current device info snapshot
   */
  getDeviceInfoSnapshot(): DeviceInfo {
    return this.deviceInfo$.getValue();
  }

  /**
   * Check if device has touch support
   */
  hasTouchSupport(): boolean {
    if (typeof window === 'undefined') return false;

    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      'DocumentTouch' in window
    );
  }

  /**
   * Detect device type based on screen size and touch capability
   */
  private detectDevice(): DeviceInfo {
    if (typeof window === 'undefined') {
      return this.getDefaultDeviceInfo();
    }

    const hasTouchSupport = this.hasTouchSupport();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const orientation: Orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';

    // Determine device type based on screen width
    let deviceType: DeviceType;
    if (screenWidth <= JOYSTICK_BREAKPOINTS.TABLET_SMALL) {
      deviceType = 'mobile';
    } else if (screenWidth <= JOYSTICK_BREAKPOINTS.TABLET_LARGE) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    // Show virtual controls if:
    // 1. Device has touch support AND
    // 2. Device is mobile or tablet
    const showVirtualControls = hasTouchSupport && deviceType !== 'desktop';

    return {
      hasTouchSupport,
      deviceType,
      orientation,
      screenWidth,
      screenHeight,
      showVirtualControls
    };
  }

  private getDefaultDeviceInfo(): DeviceInfo {
    return {
      hasTouchSupport: false,
      deviceType: 'desktop',
      orientation: 'landscape',
      screenWidth: 1920,
      screenHeight: 1080,
      showVirtualControls: false
    };
  }
}
