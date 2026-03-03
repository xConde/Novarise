import { FpsCounterService } from './fps-counter.service';

describe('FpsCounterService', () => {
  let service: FpsCounterService;

  beforeEach(() => {
    service = new FpsCounterService();
  });

  it('should start with 0 FPS', () => {
    expect(service.getFps()).toBe(0);
  });

  it('should calculate ~60 FPS from 16.67ms intervals', () => {
    // Simulate 61 frames at ~60fps (16.67ms apart) to fill the sample window
    for (let i = 0; i <= 60; i++) {
      service.tick(i * 16.67);
    }
    // After 500ms+ elapsed, FPS should update
    // 60 frames over ~1000ms = 60fps
    const fps = service.getFps();
    expect(fps).toBeGreaterThanOrEqual(58);
    expect(fps).toBeLessThanOrEqual(62);
  });

  it('should calculate ~30 FPS from 33.33ms intervals', () => {
    for (let i = 0; i <= 60; i++) {
      service.tick(i * 33.33);
    }
    const fps = service.getFps();
    expect(fps).toBeGreaterThanOrEqual(28);
    expect(fps).toBeLessThanOrEqual(32);
  });

  it('should not update FPS before 500ms elapsed', () => {
    // Only 10 frames at 16.67ms = 166.7ms total, below the 500ms update threshold
    for (let i = 0; i <= 10; i++) {
      service.tick(i * 16.67);
    }
    expect(service.getFps()).toBe(0);
  });

  it('should handle single frame without error', () => {
    service.tick(0);
    expect(service.getFps()).toBe(0);
  });

  it('should reset all state', () => {
    for (let i = 0; i <= 60; i++) {
      service.tick(i * 16.67);
    }
    expect(service.getFps()).toBeGreaterThan(0);

    service.reset();
    expect(service.getFps()).toBe(0);
  });

  it('should handle irregular frame times gracefully', () => {
    // Mix of fast and slow frames
    const times = [0, 10, 20, 100, 200, 250, 300, 350, 400, 450, 500, 550];
    for (const t of times) {
      service.tick(t);
    }
    const fps = service.getFps();
    expect(fps).toBeGreaterThan(0);
    expect(fps).toBeLessThan(200); // sanity bound
  });
});
