import { DAMAGE_POPUP_CONFIG } from './damage-popup.constants';

describe('DAMAGE_POPUP_CONFIG', () => {
  it('lifetime should be 1.0s to avoid strobing on busy boards', () => {
    expect(DAMAGE_POPUP_CONFIG.lifetime).toBeCloseTo(1.0);
  });

  it('lifetime should be at least 0.8s', () => {
    expect(DAMAGE_POPUP_CONFIG.lifetime).toBeGreaterThanOrEqual(0.8);
  });

  it('riseSpeed should be 1.0 (reduced from original for readability)', () => {
    expect(DAMAGE_POPUP_CONFIG.riseSpeed).toBeCloseTo(1.0);
  });

  it('riseSpeed should be at most 1.2', () => {
    expect(DAMAGE_POPUP_CONFIG.riseSpeed).toBeLessThanOrEqual(1.2);
  });

  it('spawnAgeJitter should be a small positive value for staggering simultaneous flushes', () => {
    expect(DAMAGE_POPUP_CONFIG.spawnAgeJitter).toBeGreaterThan(0);
    expect(DAMAGE_POPUP_CONFIG.spawnAgeJitter).toBeLessThanOrEqual(0.1);
  });

  it('spawnAgeJitter should be 0.05s', () => {
    expect(DAMAGE_POPUP_CONFIG.spawnAgeJitter).toBeCloseTo(0.05);
  });

  it('should have positive fontSize', () => {
    expect(DAMAGE_POPUP_CONFIG.fontSize).toBeGreaterThan(0);
  });

  it('should have positive canvasWidth and canvasHeight', () => {
    expect(DAMAGE_POPUP_CONFIG.canvasWidth).toBeGreaterThan(0);
    expect(DAMAGE_POPUP_CONFIG.canvasHeight).toBeGreaterThan(0);
  });

  it('should have spriteScaleMax greater than spriteScale', () => {
    expect(DAMAGE_POPUP_CONFIG.spriteScaleMax).toBeGreaterThan(DAMAGE_POPUP_CONFIG.spriteScale);
  });

  it('criticalThreshold should be a positive number', () => {
    expect(DAMAGE_POPUP_CONFIG.criticalThreshold).toBeGreaterThan(0);
  });
});
