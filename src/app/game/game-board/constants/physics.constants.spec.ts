import { PHYSICS_CONFIG } from './physics.constants';

describe('PHYSICS_CONFIG', () => {
  it('should define fixedTimestep as 1/60', () => {
    expect(PHYSICS_CONFIG.fixedTimestep).toBeCloseTo(1 / 60, 10);
  });

  it('fixedTimestep should be positive', () => {
    expect(PHYSICS_CONFIG.fixedTimestep).toBeGreaterThan(0);
  });

  it('fixedTimestep should be less than maxDeltaTime', () => {
    expect(PHYSICS_CONFIG.fixedTimestep).toBeLessThan(PHYSICS_CONFIG.maxDeltaTime);
  });

  it('should define maxStepsPerFrame as 5', () => {
    expect(PHYSICS_CONFIG.maxStepsPerFrame).toBe(5);
  });

  it('maxStepsPerFrame should be a positive integer', () => {
    expect(PHYSICS_CONFIG.maxStepsPerFrame).toBeGreaterThan(0);
    expect(Number.isInteger(PHYSICS_CONFIG.maxStepsPerFrame)).toBe(true);
  });

  it('should define maxDeltaTime as 0.1', () => {
    expect(PHYSICS_CONFIG.maxDeltaTime).toBe(0.1);
  });

  it('maxDeltaTime should be positive', () => {
    expect(PHYSICS_CONFIG.maxDeltaTime).toBeGreaterThan(0);
  });
});
