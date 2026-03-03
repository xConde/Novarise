import * as THREE from 'three';
import { GoldPopupService } from './gold-popup.service';
import { GOLD_POPUP_CONFIG } from '../constants/effects.constants';

describe('GoldPopupService', () => {
  let service: GoldPopupService;
  let scene: THREE.Scene;

  beforeEach(() => {
    service = new GoldPopupService();
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
  });

  it('should start with no popups', () => {
    expect(service.popupCount).toBe(0);
  });

  it('spawn() adds a sprite to the scene', () => {
    service.spawn(10, { x: 1, y: 2, z: 3 }, scene);

    expect(service.popupCount).toBe(1);
    expect(scene.children.length).toBe(1);
    expect(scene.children[0]).toBeInstanceOf(THREE.Sprite);
  });

  it('spawn() positions the sprite at the given coordinates', () => {
    service.spawn(5, { x: 2, y: 4, z: 6 }, scene);

    const sprite = scene.children[0] as THREE.Sprite;
    expect(sprite.position.x).toBeCloseTo(2, 5);
    expect(sprite.position.y).toBeCloseTo(4, 5);
    expect(sprite.position.z).toBeCloseTo(6, 5);
  });

  it('update() moves sprite upward', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    const sprite = scene.children[0] as THREE.Sprite;
    const initialY = sprite.position.y;

    service.update(0.1);

    expect(sprite.position.y).toBeGreaterThan(initialY);
    expect(sprite.position.y).toBeCloseTo(
      initialY + GOLD_POPUP_CONFIG.riseSpeed * 0.1,
      5
    );
  });

  it('update() fades sprite opacity over time', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    const sprite = scene.children[0] as THREE.Sprite;
    const mat = sprite.material as THREE.SpriteMaterial;

    expect(mat.opacity).toBe(1);

    service.update(GOLD_POPUP_CONFIG.lifetime / 2);

    expect(mat.opacity).toBeLessThan(1);
    expect(mat.opacity).toBeGreaterThan(0);
  });

  it('sprite is removed from scene after lifetime expires', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    expect(scene.children.length).toBe(1);

    // Advance past full lifetime
    service.update(GOLD_POPUP_CONFIG.lifetime + 0.1);

    expect(service.popupCount).toBe(0);
    expect(scene.children.length).toBe(0);
  });

  it('update() is no-op for non-positive deltaTime', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    const sprite = scene.children[0] as THREE.Sprite;
    const initialY = sprite.position.y;

    service.update(0);
    expect(sprite.position.y).toBe(initialY);
    expect(service.popupCount).toBe(1);

    service.update(-1);
    expect(sprite.position.y).toBe(initialY);
    expect(service.popupCount).toBe(1);
  });

  it('multiple popups can coexist', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    service.spawn(25, { x: 1, y: 0, z: 0 }, scene);
    service.spawn(5,  { x: 2, y: 0, z: 0 }, scene);

    expect(service.popupCount).toBe(3);
    expect(scene.children.length).toBe(3);
  });

  it('popups expire independently', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    service.update(GOLD_POPUP_CONFIG.lifetime * 0.5);

    // Spawn a second popup mid-way through the first's life
    service.spawn(20, { x: 1, y: 0, z: 0 }, scene);
    expect(service.popupCount).toBe(2);

    // Advance enough to expire the first but not the second
    service.update(GOLD_POPUP_CONFIG.lifetime * 0.6);

    expect(service.popupCount).toBe(1);
  });

  it('cleanup() removes all sprites from scene and clears state', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);
    service.spawn(20, { x: 1, y: 0, z: 0 }, scene);

    service.cleanup(scene);

    expect(service.popupCount).toBe(0);
    expect(scene.children.length).toBe(0);
  });

  it('cleanup() without scene still clears internal state', () => {
    service.spawn(10, { x: 0, y: 0, z: 0 }, scene);

    service.cleanup();

    expect(service.popupCount).toBe(0);
  });
});
