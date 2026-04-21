import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { PathfindingService } from './pathfinding.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { BlockType } from '../models/game-board-tile';
import {
  MutationOp,
  PathMutation,
  MutationResult,
  MutationRejectionReason,
  SerializablePathMutationState,
} from './path-mutation.types';

/**
 * Runtime tile mutation service for Cartographer archetype cards.
 *
 * Tracks an ordered journal of active mutations, handles expiry on turn-end,
 * and provides serialize/restore for the encounter checkpoint lifecycle.
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered in GameModule providers alongside GameBoardService.
 *
 * Circular DI note: EnemyService.repathAffectedEnemies is wired via a
 * pluggable callback (setRepathHook) rather than a direct constructor
 * injection, because CombatLoopService already injects EnemyService and
 * PathMutationService needs to be injected by CombatLoopService — injecting
 * EnemyService here would create a cycle.
 *
 * CombatLoopService.turnNumber is passed as a parameter to the apply methods
 * for the same reason.
 */
@Injectable()
export class PathMutationService {
  /** Ordered journal of all currently active mutations. */
  private journal: PathMutation[] = [];

  /** Monotonically-increasing ID counter (reset on restore). */
  private nextId = 0;

  /**
   * Pluggable repath hook — wired by GameBoardComponent in ngOnInit to avoid
   * a circular DI chain (PathMutationService → EnemyService → ... → back).
   * Called with (row, col) after each board mutation or expiry.
   */
  private repathHook: ((row: number, col: number) => void) | null = null;

  constructor(
    private readonly gameBoardService: GameBoardService,
    private readonly registry: BoardMeshRegistryService,
    private readonly pathfindingService: PathfindingService,
    private readonly terraformPool: TerraformMaterialPoolService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Pluggable hooks (wired by GameBoardComponent.ngOnInit)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Register the enemy repath callback.
   * GameBoardComponent calls this on ngOnInit:
   *   this.pathMutationService.setRepathHook((r, c) =>
   *     this.enemyService.repathAffectedEnemies(r, c));
   */
  setRepathHook(hook: (row: number, col: number) => void): void {
    this.repathHook = hook;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Apply — public API
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Build a path tile on (row, col): converts WALL → BASE (traversable).
   * Duration null = permanent; positive integer = expires on turn (currentTurn + duration).
   */
  build(
    row: number,
    col: number,
    duration: number | null,
    sourceId: string,
    currentTurn: number,
    scene: THREE.Scene,
    source: 'card' | 'relic' | 'boss' = 'card',
  ): MutationResult {
    return this.applyMutation(
      'build',
      row,
      col,
      BlockType.BASE,
      duration,
      sourceId,
      currentTurn,
      scene,
      source,
    );
  }

  /**
   * Block a path tile on (row, col): converts BASE → WALL (non-traversable).
   * Duration is required (block is always temporary from the API perspective).
   */
  block(
    row: number,
    col: number,
    duration: number,
    sourceId: string,
    currentTurn: number,
    scene: THREE.Scene,
    source: 'card' | 'relic' | 'boss' = 'card',
  ): MutationResult {
    return this.applyMutation(
      'block',
      row,
      col,
      BlockType.WALL,
      duration,
      sourceId,
      currentTurn,
      scene,
      source,
    );
  }

  /**
   * Destroy a path tile on (row, col): converts BASE → WALL permanently.
   * The calling card is responsible for applying damage to enemies on that tile.
   */
  destroy(
    row: number,
    col: number,
    sourceId: string,
    currentTurn: number,
    scene: THREE.Scene,
    source: 'card' | 'relic' | 'boss' = 'card',
  ): MutationResult {
    return this.applyMutation(
      'destroy',
      row,
      col,
      BlockType.WALL,
      null,
      sourceId,
      currentTurn,
      scene,
      source,
    );
  }

  /**
   * Bridgehead: converts a WALL tile to a non-traversable but tower-placeable
   * tile. Represented as WALL type with mutationOp = 'bridgehead' so the
   * shader/tower-placement logic can query it via the mutationOp side-channel.
   */
  bridgehead(
    row: number,
    col: number,
    duration: number,
    sourceId: string,
    currentTurn: number,
    scene: THREE.Scene,
    source: 'card' | 'relic' | 'boss' = 'card',
  ): MutationResult {
    return this.applyMutation(
      'bridgehead',
      row,
      col,
      BlockType.WALL,
      duration,
      sourceId,
      currentTurn,
      scene,
      source,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Query
  // ────────────────────────────────────────────────────────────────────────

  getActive(): readonly PathMutation[] {
    return this.journal;
  }

  /**
   * Returns true if any mutation was applied within the last `turns` turns
   * (inclusive) relative to `currentTurn`. E.g. wasMutatedInLastTurns(turn=10, turns=3)
   * is true if the most recent mutation was on turn 7, 8, 9, or 10.
   *
   * `currentTurn` is passed explicitly rather than read from CombatLoopService
   * to avoid a DI cycle — PathMutationService is injected by CombatLoopService.
   */
  wasMutatedInLastTurns(currentTurn: number, turns: number): boolean {
    const since = this.turnsSinceLastMutation(currentTurn);
    return since !== Infinity && since <= turns;
  }

  /**
   * Returns the number of turns since the most recent mutation was applied,
   * measured relative to `currentTurn`. Returns Infinity if no mutations exist
   * in the journal.
   *
   * `currentTurn` is required (not optional) — semantically "turns since" is
   * only meaningful with a reference point, and the prior optional signature
   * silently returned the absolute turn number when the arg was omitted,
   * which was load-bearing-ly incorrect for `wasMutatedInLastTurns`.
   */
  turnsSinceLastMutation(currentTurn: number): number {
    if (this.journal.length === 0) return Infinity;
    const latestTurn = Math.max(...this.journal.map(m => m.appliedOnTurn));
    const delta = currentTurn - latestTurn;
    // Sprint 24 red-team Finding 2: if a restored checkpoint has a journal
    // entry with an appliedOnTurn greater than the restored turnNumber
    // (shouldn't happen under clean flow, but could under wave-rewind or
    // clock inconsistency), a negative delta would satisfy `<= 3` in
    // `wasMutatedInLastTurns` and give VEINSEEKER a permanent speed buff.
    // Clamp at 0 so negative-delta states are treated as "mutated this turn".
    // A negative delta is still semantically "recently mutated" — the
    // clamping just avoids the unbounded-past overstatement.
    if (delta < 0) {
      console.warn(
        `PathMutationService: negative turn delta (${delta}) — latestTurn=${latestTurn}, currentTurn=${currentTurn}. ` +
        `Clamping to 0; expect a state-reset bug upstream.`,
      );
      return 0;
    }
    return delta;
  }

  isPlayerBuilt(row: number, col: number): boolean {
    return this.journal.some(m => m.row === row && m.col === col && m.op === 'build');
  }

  isPlayerBlocked(row: number, col: number): boolean {
    return this.journal.some(
      m => m.row === row && m.col === col && (m.op === 'block' || m.op === 'destroy'),
    );
  }

  isPlayerDestroyed(row: number, col: number): boolean {
    return this.journal.some(m => m.row === row && m.col === col && m.op === 'destroy');
  }

  // ────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Expire any mutations whose expiresOnTurn equals `currentTurn`.
   *
   * ORDERING: call at the TOP of CombatLoopService.resolveTurn(), immediately
   * after turnNumber++, BEFORE step 1 (spawn). This ensures all turn-N actions
   * (spawn, move, fire) observe the post-expire board state.
   *
   * Corrects the design doc §4 ordering note ("same slot as status tick") which
   * was wrong because enemy movement (step 2) precedes status tick (step 5b).
   */
  tickTurn(currentTurn: number, scene: THREE.Scene): void {
    const expiring = this.journal.filter(m => m.expiresOnTurn === currentTurn);

    for (const mutation of expiring) {
      this.revertMutation(mutation, scene);
    }

    // Remove expired entries from journal
    this.journal = this.journal.filter(m => m.expiresOnTurn !== currentTurn);
  }

  /** Full clear — called on encounter teardown / abandon / victory / defeat. */
  reset(): void {
    this.journal = [];
    this.nextId = 0;
    this.repathHook = null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Persistence
  // ────────────────────────────────────────────────────────────────────────

  serialize(): SerializablePathMutationState {
    return {
      mutations: [...this.journal],
      nextId: this.nextId,
    };
  }

  /**
   * Restore from a checkpoint snapshot. Does NOT replay mesh swaps —
   * GameBoardComponent.restoreFromCheckpoint() handles mesh restoration
   * in Step 3.5 after calling this method.
   */
  restore(snapshot: SerializablePathMutationState): void {
    this.journal = [...snapshot.mutations];
    this.nextId = snapshot.nextId;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Mesh lifecycle (used by callers on restore)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Perform the full mesh swap for a mutation — dispose old, create new, register.
   * Called by PathMutationService.applyMutation() and by GameBoardComponent on
   * checkpoint restore.
   *
   * @param mutationOp  When set, the new mesh uses the pooled material from
   *                    TerraformMaterialPoolService. When undefined (revert),
   *                    a fresh per-tile material is allocated.
   *
   * Disposal rule: pool materials are NEVER disposed on individual mesh swaps.
   * Only non-pool materials (original tile materials) are disposed here.
   * Pool materials are disposed exactly once by TerraformMaterialPoolService.dispose()
   * which GameSessionService.cleanupScene() calls at encounter teardown.
   */
  swapMesh(
    row: number,
    col: number,
    newType: BlockType,
    scene: THREE.Scene,
    mutationOp?: MutationOp,
  ): void {
    const key = `${row}-${col}`;
    const oldMesh = this.registry.tileMeshes.get(key);
    if (oldMesh) {
      scene.remove(oldMesh);
      // Always dispose per-tile geometry — it is never shared.
      oldMesh.geometry.dispose();
      // Only dispose the material if it is NOT a pooled material.
      // Pool materials must survive until pool.dispose() at teardown.
      const oldMat = oldMesh.material as THREE.Material;
      if (!this.terraformPool.isPoolMaterial(oldMat)) {
        oldMat.dispose();
      }
    }

    // Pass the current tile's elevation so a newly-swapped mesh is positioned at
    // the correct Y offset if the tile was elevated before the mutation (spike §14
    // failure mode: mesh-swap over elevated tile must preserve Y).
    const currentElevation = this.gameBoardService.getGameBoard()[row]?.[col]?.elevation ?? 0;
    const newMesh = this.gameBoardService.createTileMesh(row, col, newType, mutationOp, currentElevation);
    newMesh.userData = {
      row,
      col,
      tile: this.gameBoardService.getGameBoard()[row]?.[col],
    };
    scene.add(newMesh);
    this.registry.replaceTileMesh(row, col, newMesh);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────────────────────────────────

  private applyMutation(
    op: MutationOp,
    row: number,
    col: number,
    targetType: BlockType,
    duration: number | null,
    sourceId: string,
    currentTurn: number,
    scene: THREE.Scene,
    source: 'card' | 'relic' | 'boss',
  ): MutationResult {
    // ── Validation ──────────────────────────────────────────────────────────

    const rejection = this.validate(op, row, col, targetType, currentTurn);
    if (rejection) {
      return { ok: false, reason: rejection };
    }

    const board = this.gameBoardService.getGameBoard();
    const priorType = board[row][col].type;

    // ── Tile mutation ────────────────────────────────────────────────────────

    const newTile = this.gameBoardService.setTileType(row, col, targetType, op, priorType);
    if (!newTile) {
      // setTileType returned null — treat as spawner-or-exit (defensive)
      return { ok: false, reason: 'spawner-or-exit' };
    }

    // ── Mesh swap ────────────────────────────────────────────────────────────

    this.swapMesh(row, col, targetType, scene, op);

    // ── Pathfinding + enemy repath ────────────────────────────────────────────

    this.pathfindingService.invalidateCache();
    this.repathHook?.(row, col);

    // ── Journal entry ─────────────────────────────────────────────────────────

    const mutation: PathMutation = {
      id: String(this.nextId++),
      op,
      row,
      col,
      appliedOnTurn: currentTurn,
      expiresOnTurn: duration !== null ? currentTurn + duration : null,
      priorType,
      source,
      sourceId,
    };
    this.journal.push(mutation);

    return { ok: true, mutation };
  }

  private validate(
    op: MutationOp,
    row: number,
    col: number,
    targetType: BlockType,
    currentTurn: number,
  ): MutationRejectionReason | null {
    const boardHeight = this.gameBoardService.getBoardHeight();
    const boardWidth = this.gameBoardService.getBoardWidth();

    // Bounds
    if (row < 0 || row >= boardHeight || col < 0 || col >= boardWidth) {
      return 'out-of-bounds';
    }

    const board = this.gameBoardService.getGameBoard();
    const tile = board[row][col];

    // Spawner / exit immutability
    if (tile.type === BlockType.SPAWNER || tile.type === BlockType.EXIT) {
      return 'spawner-or-exit';
    }

    // Tower occupied
    if (tile.type === BlockType.TOWER) {
      return 'tower-occupied';
    }

    // Anti-spam: at most one mutation per (row, col) per turn
    const alreadyMutatedThisTurn = this.journal.some(
      m => m.row === row && m.col === col && m.appliedOnTurn === currentTurn,
    );
    if (alreadyMutatedThisTurn) {
      return 'already-mutated-this-turn';
    }

    // No-op: op would not change the tile type
    if (tile.type === targetType && op !== 'bridgehead') {
      return 'no-op';
    }

    // Connectivity: would the mutation block all spawner→exit paths?
    // Only applies to mutations that make a tile non-traversable (block/destroy/bridgehead).
    if (targetType === BlockType.WALL) {
      if (this.gameBoardService.wouldBlockPathIfSet(row, col, BlockType.WALL)) {
        return 'would-block-all-paths';
      }
    }

    return null;
  }

  private revertMutation(mutation: PathMutation, scene: THREE.Scene): void {
    // Safety: never revert spawner/exit (should never appear in journal, but defend)
    if (
      mutation.priorType === BlockType.SPAWNER ||
      mutation.priorType === BlockType.EXIT
    ) {
      console.warn(
        `PathMutationService: attempted to revert mutation ${mutation.id} ` +
        `whose priorType is ${mutation.priorType} — skipping.`,
      );
      return;
    }

    // Determine the revert op (inverse of original op)
    const revertOp: MutationOp =
      mutation.priorType === BlockType.BASE ? 'build' : 'block';

    const newTile = this.gameBoardService.setTileType(
      mutation.row,
      mutation.col,
      mutation.priorType,
      revertOp,
      mutation.priorType,
    );

    // Sprint 15 — setTileType returns null when the tile is now a TOWER
    // (most likely a tower was placed on an active BRIDGEHEAD before it
    // expired). The revert is a no-op for tile data; do NOT run the mesh
    // swap, cache invalidate, or enemy repath either — all three are
    // wrong/wasteful:
    //   - swapMesh would paint a stale WALL mesh under the tower's group
    //     (visually masked but leaves the registry desynced),
    //   - cache invalidate + repath are unnecessary because the tile's
    //     traversability did not change (TOWER remains non-traversable,
    //     same as the BRIDGEHEAD WALL it replaced).
    if (newTile === null) {
      return;
    }

    // Reverting to original tile type — no mutationOp, so per-tile material is used.
    this.swapMesh(mutation.row, mutation.col, mutation.priorType, scene, undefined);

    this.pathfindingService.invalidateCache();
    this.repathHook?.(mutation.row, mutation.col);
  }
}
