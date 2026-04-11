/**
 * M2 S10: Shrunk to the only fields still in use.
 *
 * After the Phase 4 turn-based engine swap and M2 dead-code sweep, the game
 * loop no longer uses fixedTimestep / maxStepsPerFrame / elapsedTimeFlushIntervalS
 * — those were physics-accumulator values for the deleted CombatLoopService.tick.
 * The only live field is `maxDeltaTime`, which game-board.animate() uses to cap
 * raw RAF deltas before passing them to the cosmetic visual update path.
 *
 * PROJECTILE_POOL_CONFIG also deleted (projectile.service.ts removed in M2 S5).
 */
export interface PhysicsConfig {
  /** Maximum raw delta before capping (prevents burst after tab switch) */
  readonly maxDeltaTime: number;
}

export const PHYSICS_CONFIG: PhysicsConfig = {
  maxDeltaTime: 0.1,
} as const;
