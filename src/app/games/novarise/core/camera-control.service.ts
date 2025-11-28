import { Injectable } from '@angular/core';
import * as THREE from 'three';

export interface CameraState {
  position: THREE.Vector3;
  velocity: { x: number; y: number; z: number };
  targetVelocity: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  targetRotation: { yaw: number; pitch: number };
}

export interface CameraConfig {
  moveSpeed: number;
  fastSpeed: number;
  acceleration: number;
  rotationSpeed: number;
  rotationAcceleration: number;
  minDistance: number;
  maxDistance: number;
  minHeight: number;
  maxHeight: number;
  maxPitch: number;
  minPitch: number;
}

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fast: boolean;
}

export interface RotationInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface JoystickInput {
  active: boolean;
  x: number;
  y: number;
}

@Injectable({
  providedIn: 'root'
})
export class CameraControlService {
  private readonly defaultConfig: CameraConfig = {
    moveSpeed: 0.25,
    fastSpeed: 0.6,
    acceleration: 0.15,
    rotationSpeed: 0.005,
    rotationAcceleration: 0.15,
    minDistance: 10,
    maxDistance: 80,
    minHeight: 5,
    maxHeight: 60,
    maxPitch: Math.PI / 4,        // 45 degrees up
    minPitch: -Math.PI * 5 / 12   // 75 degrees down
  };

  private config: CameraConfig;
  private state: CameraState;

  constructor() {
    this.config = { ...this.defaultConfig };
    this.state = this.createInitialState();
  }

  private createInitialState(): CameraState {
    return {
      position: new THREE.Vector3(0, 35, 17.5),
      velocity: { x: 0, y: 0, z: 0 },
      targetVelocity: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      targetRotation: { yaw: 0, pitch: 0 }
    };
  }

  /**
   * Initialize camera rotation based on camera's position and look-at point
   */
  public initializeFromCamera(camera: THREE.PerspectiveCamera, lookAtPoint: THREE.Vector3 = new THREE.Vector3(0, 0, 0)): void {
    const direction = new THREE.Vector3().subVectors(lookAtPoint, camera.position);

    // Calculate yaw from X and Z components
    const initialYaw = Math.atan2(direction.x, direction.z);
    this.state.rotation.yaw = initialYaw;
    this.state.targetRotation.yaw = initialYaw;

    // Calculate pitch from Y component and horizontal distance
    const horizontalDistance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    const initialPitch = Math.atan2(direction.y, horizontalDistance);
    this.state.rotation.pitch = initialPitch;
    this.state.targetRotation.pitch = initialPitch;

    // Sync position
    this.state.position.copy(camera.position);
  }

  /**
   * Update camera state based on inputs
   */
  public update(
    movementInput: MovementInput,
    rotationInput: RotationInput,
    movementJoystick: JoystickInput,
    rotationJoystick: JoystickInput
  ): void {
    // Update rotation from arrow keys
    this.updateRotationFromInput(rotationInput);

    // Update rotation from joystick
    this.updateRotationFromJoystick(rotationJoystick);

    // Smooth interpolation of rotation
    this.interpolateRotation();

    // Calculate movement
    this.updateMovement(movementInput, movementJoystick);

    // Apply bounds
    this.applyBounds();
  }

  private updateRotationFromInput(input: RotationInput): void {
    if (input.left) {
      this.state.targetRotation.yaw += this.config.rotationSpeed;
    }
    if (input.right) {
      this.state.targetRotation.yaw -= this.config.rotationSpeed;
    }
    if (input.up) {
      this.state.targetRotation.pitch = Math.min(
        this.state.targetRotation.pitch + this.config.rotationSpeed,
        this.config.maxPitch
      );
    }
    if (input.down) {
      this.state.targetRotation.pitch = Math.max(
        this.state.targetRotation.pitch - this.config.rotationSpeed,
        this.config.minPitch
      );
    }
  }

  private updateRotationFromJoystick(joystick: JoystickInput): void {
    if (!joystick.active) return;

    const rotationJoystickSpeed = this.config.rotationSpeed * 1.5;

    // X axis controls yaw
    this.state.targetRotation.yaw -= joystick.x * rotationJoystickSpeed;

    // Y axis controls pitch
    const newPitch = this.state.targetRotation.pitch + joystick.y * rotationJoystickSpeed;
    this.state.targetRotation.pitch = Math.max(
      this.config.minPitch,
      Math.min(this.config.maxPitch, newPitch)
    );
  }

  private interpolateRotation(): void {
    this.state.rotation.yaw += (this.state.targetRotation.yaw - this.state.rotation.yaw) * this.config.rotationAcceleration;
    this.state.rotation.pitch += (this.state.targetRotation.pitch - this.state.rotation.pitch) * this.config.rotationAcceleration;
  }

  private updateMovement(input: MovementInput, joystick: JoystickInput): void {
    const currentSpeed = input.fast ? this.config.fastSpeed : this.config.moveSpeed;

    // Calculate direction vectors based on yaw
    const forward = new THREE.Vector3(
      Math.sin(this.state.rotation.yaw),
      0,
      Math.cos(this.state.rotation.yaw)
    ).normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // Reset target velocity
    this.state.targetVelocity.x = 0;
    this.state.targetVelocity.y = 0;
    this.state.targetVelocity.z = 0;

    // WASD movement
    if (input.forward) {
      this.state.targetVelocity.x += forward.x * currentSpeed;
      this.state.targetVelocity.z += forward.z * currentSpeed;
    }
    if (input.backward) {
      this.state.targetVelocity.x -= forward.x * currentSpeed;
      this.state.targetVelocity.z -= forward.z * currentSpeed;
    }
    if (input.left) {
      this.state.targetVelocity.x -= right.x * currentSpeed;
      this.state.targetVelocity.z -= right.z * currentSpeed;
    }
    if (input.right) {
      this.state.targetVelocity.x += right.x * currentSpeed;
      this.state.targetVelocity.z += right.z * currentSpeed;
    }

    // Joystick movement
    if (joystick.active) {
      this.state.targetVelocity.x += (forward.x * joystick.y + right.x * joystick.x) * currentSpeed;
      this.state.targetVelocity.z += (forward.z * joystick.y + right.z * joystick.x) * currentSpeed;
    }

    // Vertical movement (Q/E)
    if (input.down) {
      this.state.targetVelocity.y -= currentSpeed;
    }
    if (input.up) {
      this.state.targetVelocity.y += currentSpeed;
    }

    // Smooth acceleration/deceleration
    this.state.velocity.x += (this.state.targetVelocity.x - this.state.velocity.x) * this.config.acceleration;
    this.state.velocity.y += (this.state.targetVelocity.y - this.state.velocity.y) * this.config.acceleration;
    this.state.velocity.z += (this.state.targetVelocity.z - this.state.velocity.z) * this.config.acceleration;

    // Apply velocity to position
    this.state.position.x += this.state.velocity.x;
    this.state.position.y += this.state.velocity.y;
    this.state.position.z += this.state.velocity.z;
  }

  private applyBounds(): void {
    const maxDistance = 50;
    this.state.position.x = Math.max(-maxDistance, Math.min(maxDistance, this.state.position.x));
    this.state.position.z = Math.max(-maxDistance, Math.min(maxDistance, this.state.position.z));
    this.state.position.y = Math.max(this.config.minHeight, Math.min(this.config.maxHeight, this.state.position.y));
  }

  /**
   * Apply the current camera state to a Three.js camera and OrbitControls
   */
  public applyToCamera(camera: THREE.PerspectiveCamera, controlsTarget?: THREE.Vector3): void {
    camera.position.copy(this.state.position);

    // Calculate look-at target
    const forward = new THREE.Vector3(
      Math.sin(this.state.rotation.yaw),
      0,
      Math.cos(this.state.rotation.yaw)
    ).normalize();

    const lookAtDistance = 10;
    const targetX = this.state.position.x + forward.x * lookAtDistance;
    const targetY = this.state.position.y + Math.sin(this.state.rotation.pitch) * lookAtDistance - 5;
    const targetZ = this.state.position.z + forward.z * lookAtDistance;

    if (controlsTarget) {
      controlsTarget.set(targetX, targetY, targetZ);
    }
  }

  /**
   * Get current camera position
   */
  public getPosition(): THREE.Vector3 {
    return this.state.position.clone();
  }

  /**
   * Get current rotation
   */
  public getRotation(): { yaw: number; pitch: number } {
    return { ...this.state.rotation };
  }

  /**
   * Get forward direction vector
   */
  public getForwardDirection(): THREE.Vector3 {
    return new THREE.Vector3(
      Math.sin(this.state.rotation.yaw),
      0,
      Math.cos(this.state.rotation.yaw)
    ).normalize();
  }

  /**
   * Update configuration
   */
  public setConfig(config: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): CameraConfig {
    return { ...this.config };
  }

  /**
   * Reset camera to initial state
   */
  public reset(): void {
    this.state = this.createInitialState();
  }
}
