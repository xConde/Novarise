export interface PhysicsConfig {
  /** Fixed timestep in seconds (60 Hz simulation) */
  readonly fixedTimestep: number;
  /** Maximum steps per frame to prevent spiral of death */
  readonly maxStepsPerFrame: number;
  /** Maximum raw delta before capping (prevents burst after tab switch) */
  readonly maxDeltaTime: number;
}

export const PHYSICS_CONFIG: PhysicsConfig = {
  fixedTimestep: 1 / 60,
  maxStepsPerFrame: 5,
  maxDeltaTime: 0.1,
} as const;
