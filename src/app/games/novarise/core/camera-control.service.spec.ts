import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import {
  CameraControlService,
  MovementInput,
  RotationInput,
  JoystickInput
} from './camera-control.service';

describe('CameraControlService', () => {
  let service: CameraControlService;

  const noMovement: MovementInput = {
    forward: false, backward: false, left: false, right: false, up: false, down: false, fast: false
  };

  const noRotation: RotationInput = {
    left: false, right: false, up: false, down: false
  };

  const noJoystick: JoystickInput = { active: false, x: 0, y: 0 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CameraControlService]
    });
    service = TestBed.inject(CameraControlService);
  });

  describe('initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have default configuration', () => {
      const config = service.getConfig();

      expect(config.moveSpeed).toBe(0.25);
      expect(config.fastSpeed).toBe(0.6);
      expect(config.acceleration).toBe(0.15);
      expect(config.rotationSpeed).toBe(0.005);
    });

    it('should have initial position', () => {
      const position = service.getPosition();

      expect(position).toBeInstanceOf(THREE.Vector3);
      expect(position.y).toBeGreaterThan(0); // Camera should be above ground
    });
  });

  describe('initializeFromCamera', () => {
    it('should sync position with camera', () => {
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(10, 20, 30);

      service.initializeFromCamera(camera);

      const position = service.getPosition();
      expect(position.x).toBe(10);
      expect(position.y).toBe(20);
      expect(position.z).toBe(30);
    });

    it('should calculate rotation from look-at point', () => {
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(0, 10, 10);

      service.initializeFromCamera(camera, new THREE.Vector3(0, 0, 0));

      const rotation = service.getRotation();
      expect(rotation.yaw).toBeDefined();
      expect(rotation.pitch).toBeDefined();
    });
  });

  describe('rotation input', () => {
    it('should increase yaw when rotating left', () => {
      const initialRotation = service.getRotation();

      // Multiple updates to build up rotation
      for (let i = 0; i < 10; i++) {
        service.update(noMovement, { ...noRotation, left: true }, noJoystick, noJoystick);
      }

      const newRotation = service.getRotation();
      expect(newRotation.yaw).toBeGreaterThan(initialRotation.yaw);
    });

    it('should decrease yaw when rotating right', () => {
      const initialRotation = service.getRotation();

      for (let i = 0; i < 10; i++) {
        service.update(noMovement, { ...noRotation, right: true }, noJoystick, noJoystick);
      }

      const newRotation = service.getRotation();
      expect(newRotation.yaw).toBeLessThan(initialRotation.yaw);
    });

    it('should increase pitch when rotating up (within limits)', () => {
      const initialRotation = service.getRotation();

      for (let i = 0; i < 10; i++) {
        service.update(noMovement, { ...noRotation, up: true }, noJoystick, noJoystick);
      }

      const newRotation = service.getRotation();
      expect(newRotation.pitch).toBeGreaterThan(initialRotation.pitch);
    });

    it('should clamp pitch to max limit', () => {
      const config = service.getConfig();

      // Apply many upward rotations
      for (let i = 0; i < 1000; i++) {
        service.update(noMovement, { ...noRotation, up: true }, noJoystick, noJoystick);
      }

      const rotation = service.getRotation();
      expect(rotation.pitch).toBeLessThanOrEqual(config.maxPitch);
    });

    it('should clamp pitch to min limit', () => {
      const config = service.getConfig();

      // Apply many downward rotations
      for (let i = 0; i < 1000; i++) {
        service.update(noMovement, { ...noRotation, down: true }, noJoystick, noJoystick);
      }

      const rotation = service.getRotation();
      expect(rotation.pitch).toBeGreaterThanOrEqual(config.minPitch);
    });
  });

  describe('movement input', () => {
    it('should move forward when forward is pressed', () => {
      const initialPosition = service.getPosition();

      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, forward: true }, noRotation, noJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      // Position should change (exact direction depends on yaw)
      const distanceMoved = initialPosition.distanceTo(newPosition);
      expect(distanceMoved).toBeGreaterThan(0);
    });

    it('should move backward when backward is pressed', () => {
      const initialPosition = service.getPosition();

      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, backward: true }, noRotation, noJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      const distanceMoved = initialPosition.distanceTo(newPosition);
      expect(distanceMoved).toBeGreaterThan(0);
    });

    it('should strafe left when left is pressed', () => {
      const initialPosition = service.getPosition();

      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, left: true }, noRotation, noJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      const distanceMoved = initialPosition.distanceTo(newPosition);
      expect(distanceMoved).toBeGreaterThan(0);
    });

    it('should strafe right when right is pressed', () => {
      const initialPosition = service.getPosition();

      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, right: true }, noRotation, noJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      const distanceMoved = initialPosition.distanceTo(newPosition);
      expect(distanceMoved).toBeGreaterThan(0);
    });

    it('should move up when up is pressed', () => {
      const initialPosition = service.getPosition();

      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, up: true }, noRotation, noJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      expect(newPosition.y).toBeGreaterThan(initialPosition.y);
    });

    it('should move down when down is pressed', () => {
      // First move up to have room to move down
      for (let i = 0; i < 50; i++) {
        service.update({ ...noMovement, up: true }, noRotation, noJoystick, noJoystick);
      }

      const initialPosition = service.getPosition();

      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, down: true }, noRotation, noJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      expect(newPosition.y).toBeLessThan(initialPosition.y);
    });

    it('should move faster when fast modifier is active', () => {
      // Move without fast
      service.reset();
      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, forward: true }, noRotation, noJoystick, noJoystick);
      }
      const normalDistance = service.getPosition().distanceTo(new THREE.Vector3(0, 35, 17.5));

      // Move with fast
      service.reset();
      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, forward: true, fast: true }, noRotation, noJoystick, noJoystick);
      }
      const fastDistance = service.getPosition().distanceTo(new THREE.Vector3(0, 35, 17.5));

      expect(fastDistance).toBeGreaterThan(normalDistance);
    });
  });

  describe('joystick input', () => {
    it('should move based on movement joystick', () => {
      const initialPosition = service.getPosition();

      const movementJoystick: JoystickInput = { active: true, x: 0, y: 1 }; // Full forward

      for (let i = 0; i < 20; i++) {
        service.update(noMovement, noRotation, movementJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      const distanceMoved = initialPosition.distanceTo(newPosition);
      expect(distanceMoved).toBeGreaterThan(0);
    });

    it('should rotate based on rotation joystick', () => {
      const initialRotation = service.getRotation();

      const rotationJoystick: JoystickInput = { active: true, x: 1, y: 0 }; // Rotate right

      for (let i = 0; i < 20; i++) {
        service.update(noMovement, noRotation, noJoystick, rotationJoystick);
      }

      const newRotation = service.getRotation();
      expect(newRotation.yaw).not.toBe(initialRotation.yaw);
    });

    it('should not move when joystick is inactive', () => {
      const initialPosition = service.getPosition();

      const inactiveJoystick: JoystickInput = { active: false, x: 1, y: 1 };

      for (let i = 0; i < 20; i++) {
        service.update(noMovement, noRotation, inactiveJoystick, noJoystick);
      }

      const newPosition = service.getPosition();
      // Position should be nearly the same (accounting for velocity decay)
      expect(newPosition.distanceTo(initialPosition)).toBeLessThan(0.1);
    });
  });

  describe('bounds', () => {
    it('should clamp X position within bounds', () => {
      // Move way to the right
      for (let i = 0; i < 1000; i++) {
        service.update({ ...noMovement, right: true }, noRotation, noJoystick, noJoystick);
      }

      const position = service.getPosition();
      expect(Math.abs(position.x)).toBeLessThanOrEqual(50);
    });

    it('should clamp Z position within bounds', () => {
      // Move way forward
      for (let i = 0; i < 1000; i++) {
        service.update({ ...noMovement, forward: true }, noRotation, noJoystick, noJoystick);
      }

      const position = service.getPosition();
      expect(Math.abs(position.z)).toBeLessThanOrEqual(50);
    });

    it('should clamp Y position to min height', () => {
      // Move way down
      for (let i = 0; i < 1000; i++) {
        service.update({ ...noMovement, down: true }, noRotation, noJoystick, noJoystick);
      }

      const position = service.getPosition();
      const config = service.getConfig();
      expect(position.y).toBeGreaterThanOrEqual(config.minHeight);
    });

    it('should clamp Y position to max height', () => {
      // Move way up
      for (let i = 0; i < 1000; i++) {
        service.update({ ...noMovement, up: true }, noRotation, noJoystick, noJoystick);
      }

      const position = service.getPosition();
      const config = service.getConfig();
      expect(position.y).toBeLessThanOrEqual(config.maxHeight);
    });
  });

  describe('applyToCamera', () => {
    it('should update camera position', () => {
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

      // Move the service position
      for (let i = 0; i < 20; i++) {
        service.update({ ...noMovement, forward: true }, noRotation, noJoystick, noJoystick);
      }

      service.applyToCamera(camera);

      const servicePosition = service.getPosition();
      expect(camera.position.x).toBe(servicePosition.x);
      expect(camera.position.y).toBe(servicePosition.y);
      expect(camera.position.z).toBe(servicePosition.z);
    });

    it('should update controls target if provided', () => {
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      const target = new THREE.Vector3();

      service.applyToCamera(camera, target);

      // Target should be set to a point in front of camera
      expect(target.x).toBeDefined();
      expect(target.y).toBeDefined();
      expect(target.z).toBeDefined();
    });
  });

  describe('getForwardDirection', () => {
    it('should return normalized forward vector', () => {
      const forward = service.getForwardDirection();

      expect(forward).toBeInstanceOf(THREE.Vector3);
      // Normalized vector should have length ~1
      expect(forward.length()).toBeCloseTo(1, 5);
    });

    it('should change based on yaw rotation', () => {
      const initialForward = service.getForwardDirection().clone();

      // Rotate
      for (let i = 0; i < 50; i++) {
        service.update(noMovement, { ...noRotation, left: true }, noJoystick, noJoystick);
      }

      const newForward = service.getForwardDirection();

      // Forward direction should have changed
      expect(newForward.x).not.toBeCloseTo(initialForward.x, 3);
    });
  });

  describe('configuration', () => {
    it('should allow updating config', () => {
      service.setConfig({ moveSpeed: 0.5, fastSpeed: 1.0 });

      const config = service.getConfig();
      expect(config.moveSpeed).toBe(0.5);
      expect(config.fastSpeed).toBe(1.0);
    });

    it('should preserve unmodified config values', () => {
      const originalAcceleration = service.getConfig().acceleration;

      service.setConfig({ moveSpeed: 0.5 });

      const config = service.getConfig();
      expect(config.acceleration).toBe(originalAcceleration);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Make some changes
      for (let i = 0; i < 100; i++) {
        service.update({ ...noMovement, forward: true, up: true }, { ...noRotation, left: true }, noJoystick, noJoystick);
      }

      service.reset();

      const position = service.getPosition();
      // Should be back to initial position
      expect(position.x).toBe(0);
      expect(position.y).toBe(35);
      expect(position.z).toBe(17.5);
    });
  });

  describe('smooth interpolation', () => {
    it('should smoothly interpolate rotation', () => {
      // Apply single rotation input
      service.update(noMovement, { ...noRotation, left: true }, noJoystick, noJoystick);
      const rotation1 = service.getRotation();

      // Continue updating without input - rotation should continue to smooth
      service.update(noMovement, noRotation, noJoystick, noJoystick);
      const rotation2 = service.getRotation();

      // Rotation should be different as it interpolates
      expect(rotation2.yaw).not.toBe(rotation1.yaw);
    });

    it('should smoothly decelerate movement', () => {
      // Build up velocity
      for (let i = 0; i < 10; i++) {
        service.update({ ...noMovement, forward: true }, noRotation, noJoystick, noJoystick);
      }

      const positionWithVelocity = service.getPosition().clone();

      // Stop input but continue updating - should coast
      service.update(noMovement, noRotation, noJoystick, noJoystick);
      const positionCoasting = service.getPosition();

      // Should have moved slightly due to remaining velocity
      expect(positionCoasting.distanceTo(positionWithVelocity)).toBeGreaterThan(0);
    });
  });
});
