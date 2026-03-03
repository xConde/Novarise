import { Injectable } from '@angular/core';

const FPS_SAMPLE_WINDOW = 60;
const FPS_UPDATE_INTERVAL_MS = 500;

@Injectable()
export class FpsCounterService {
  private frameTimes: number[] = [];
  private lastUpdateTime = 0;
  private currentFps = 0;

  /** Call once per frame with the current timestamp (ms). */
  tick(timeMs: number): void {
    this.frameTimes.push(timeMs);

    // Keep only the last N frame timestamps
    if (this.frameTimes.length > FPS_SAMPLE_WINDOW) {
      this.frameTimes.shift();
    }

    // Throttle the FPS calculation to avoid jitter
    if (timeMs - this.lastUpdateTime >= FPS_UPDATE_INTERVAL_MS && this.frameTimes.length >= 2) {
      const oldest = this.frameTimes[0];
      const newest = this.frameTimes[this.frameTimes.length - 1];
      const elapsed = newest - oldest;
      if (elapsed > 0) {
        this.currentFps = Math.round(((this.frameTimes.length - 1) / elapsed) * 1000);
      }
      this.lastUpdateTime = timeMs;
    }
  }

  /** Returns the current smoothed FPS value. */
  getFps(): number {
    return this.currentFps;
  }

  /** Reset all state. */
  reset(): void {
    this.frameTimes = [];
    this.lastUpdateTime = 0;
    this.currentFps = 0;
  }
}
