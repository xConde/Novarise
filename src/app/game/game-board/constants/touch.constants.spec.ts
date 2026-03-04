import { TOUCH_CONFIG } from './touch.constants';

describe('TOUCH_CONFIG', () => {
  it('should define tapThresholdMs as 300', () => {
    expect(TOUCH_CONFIG.tapThresholdMs).toBe(300);
  });

  it('should define tapThresholdPx as 10', () => {
    expect(TOUCH_CONFIG.tapThresholdPx).toBe(10);
  });

  it('should define dragSensitivity as 0.02', () => {
    expect(TOUCH_CONFIG.dragSensitivity).toBe(0.02);
  });

  it('should define pinchZoomSpeed as 0.01', () => {
    expect(TOUCH_CONFIG.pinchZoomSpeed).toBe(0.01);
  });

  it('should define minZoom as 5', () => {
    expect(TOUCH_CONFIG.minZoom).toBe(5);
  });

  it('should define maxZoom as 25', () => {
    expect(TOUCH_CONFIG.maxZoom).toBe(25);
  });

  it('minZoom should be less than maxZoom', () => {
    expect(TOUCH_CONFIG.minZoom).toBeLessThan(TOUCH_CONFIG.maxZoom);
  });

  it('tapThresholdMs should be a positive number', () => {
    expect(TOUCH_CONFIG.tapThresholdMs).toBeGreaterThan(0);
  });

  it('tapThresholdPx should be a positive number', () => {
    expect(TOUCH_CONFIG.tapThresholdPx).toBeGreaterThan(0);
  });
});
