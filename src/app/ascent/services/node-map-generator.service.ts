import { Injectable } from '@angular/core';
import { MapNode, NodeMap, NodeType } from '../models/node-map.model';
import {
  CAMPAIGN_MAP_TIERS,
  NODE_MAP_CONFIG,
  createSeededRng,
  getMapTierForNode,
} from '../constants/ascent.constants';

/**
 * Generates a deterministic StS-style branching node map for one act.
 *
 * Layout rules:
 * - Row 0: all COMBAT nodes (first encounter is always combat)
 * - Boss row (rowsPerAct): exactly 1 BOSS node, connects to nothing
 * - Row guaranteedShop (5): at least one SHOP
 * - Row guaranteedRest (8): at least one REST
 * - Elite nodes only in rows [eliteMinRow, eliteMaxRow]
 * - Every non-boss node has at least 1 outgoing connection
 * - Every non-row-0 node has at least 1 incoming connection
 */
@Injectable({ providedIn: 'root' })
export class NodeMapGeneratorService {

  /**
   * Generate a full act node map deterministically from `seed`.
   * `actIndex` is 0-based (act 1 = 0, act 2 = 1).
   */
  generateActMap(actIndex: number, seed: number): NodeMap {
    const rng = createSeededRng(seed);
    const totalRows = NODE_MAP_CONFIG.rowsPerAct; // 11 content rows + 1 boss row

    // ── Step 1: Build rows with node counts ─────────────────
    // rows[0..totalRows] where rows[totalRows] is the boss row
    const rowNodeCounts = this.buildRowNodeCounts(rng, totalRows);

    // ── Step 2: Assign node types ────────────────────────────
    const typeGrid = this.buildTypeGrid(rng, rowNodeCounts, totalRows, actIndex);

    // ── Step 3: Assign campaign map IDs ─────────────────────
    const mapIdGrid = this.buildMapIdGrid(rng, rowNodeCounts, totalRows, actIndex);

    // ── Step 4: Build node list (without connections yet) ────
    const nodes: MapNode[] = [];
    for (let row = 0; row <= totalRows; row++) {
      for (let col = 0; col < rowNodeCounts[row]; col++) {
        nodes.push({
          id: buildNodeId(actIndex, row, col),
          type: typeGrid[row][col],
          row,
          column: col,
          connections: [],
          campaignMapId: mapIdGrid[row][col],
          visited: false,
        });
      }
    }

    // ── Step 5: Build connections ────────────────────────────
    const nodesWithConnections = this.buildConnections(rng, nodes, rowNodeCounts, totalRows, actIndex);

    // ── Step 6: Assemble NodeMap ─────────────────────────────
    const startNodeIds = nodesWithConnections
      .filter(n => n.row === 0)
      .map(n => n.id);

    const bossNode = nodesWithConnections.find(n => n.type === NodeType.BOSS);
    const bossNodeId = bossNode?.id ?? buildNodeId(actIndex, totalRows, 0);

    return {
      actIndex,
      nodes: nodesWithConnections,
      startNodeIds,
      bossNodeId,
      rows: totalRows + 1,
    };
  }

  // ── Private helpers ───────────────────────────────────────

  /** Returns an array of node counts per row (index 0..totalRows). */
  private buildRowNodeCounts(rng: () => number, totalRows: number): number[] {
    const counts: number[] = [];
    for (let row = 0; row <= totalRows; row++) {
      if (row === totalRows) {
        // Boss row: always exactly 1
        counts.push(1);
      } else {
        const range = NODE_MAP_CONFIG.maxNodesPerRow - NODE_MAP_CONFIG.minNodesPerRow;
        counts.push(NODE_MAP_CONFIG.minNodesPerRow + Math.floor(rng() * (range + 1)));
      }
    }
    return counts;
  }

  /** Assigns NodeType to every cell in the grid. */
  private buildTypeGrid(
    rng: () => number,
    rowNodeCounts: number[],
    totalRows: number,
    actIndex: number,
  ): NodeType[][] {
    const grid: NodeType[][] = [];

    for (let row = 0; row <= totalRows; row++) {
      const count = rowNodeCounts[row];
      const rowTypes: NodeType[] = [];

      if (row === totalRows) {
        // Boss row
        rowTypes.push(NodeType.BOSS);
      } else if (row === 0) {
        // First row: all COMBAT
        for (let col = 0; col < count; col++) {
          rowTypes.push(NodeType.COMBAT);
        }
      } else {
        // Assign weighted random types, then enforce guarantees
        for (let col = 0; col < count; col++) {
          rowTypes.push(this.pickNodeType(rng, row, actIndex, totalRows));
        }

        // Guarantee SHOP at row 5
        if (row === NODE_MAP_CONFIG.guaranteedShop && !rowTypes.includes(NodeType.SHOP)) {
          const shopIdx = Math.floor(rng() * count);
          rowTypes[shopIdx] = NodeType.SHOP;
        }

        // Guarantee REST at row 8
        if (row === NODE_MAP_CONFIG.guaranteedRest && !rowTypes.includes(NodeType.REST)) {
          const restIdx = Math.floor(rng() * count);
          rowTypes[restIdx] = NodeType.REST;
        }
      }

      grid.push(rowTypes);
    }

    return grid;
  }

  /** Picks a weighted random NodeType for a given row, respecting elite row bounds. */
  private pickNodeType(rng: () => number, row: number, _actIndex: number, totalRows: number): NodeType {
    const w = NODE_MAP_CONFIG.nodeTypeWeights;

    // Build weight table — suppress elite outside [eliteMinRow, eliteMaxRow]
    const eliteAllowed = row >= NODE_MAP_CONFIG.eliteMinRow && row <= NODE_MAP_CONFIG.eliteMaxRow;
    const eliteWeight = eliteAllowed ? w.elite : 0;

    // Redistribute elite weight to combat when suppressed
    const combatWeight = w.combat + (eliteAllowed ? 0 : w.elite);

    const weights: [NodeType, number][] = [
      [NodeType.COMBAT, combatWeight],
      [NodeType.ELITE, eliteWeight],
      [NodeType.REST, w.rest],
      [NodeType.SHOP, w.shop],
      [NodeType.EVENT, w.event],
      [NodeType.UNKNOWN, w.unknown],
    ];

    // Suppress REST/SHOP on last content row (row = totalRows - 1) to avoid
    // doubling up with guaranteed positions
    if (row === totalRows - 1) {
      // Just pick combat/elite/event/unknown in the late stretch
    }

    const roll = rng();
    let cumulative = 0;
    for (const [type, weight] of weights) {
      cumulative += weight;
      if (roll < cumulative) return type;
    }
    return NodeType.COMBAT;
  }

  /** Assigns a campaign map ID to every cell. */
  private buildMapIdGrid(
    rng: () => number,
    rowNodeCounts: number[],
    totalRows: number,
    actIndex: number,
  ): string[][] {
    const grid: string[][] = [];
    for (let row = 0; row <= totalRows; row++) {
      const rowMaps: string[] = [];
      const count = rowNodeCounts[row];
      for (let col = 0; col < count; col++) {
        const tierKey = getMapTierForNode(actIndex, row, totalRows);
        const pool = CAMPAIGN_MAP_TIERS[tierKey] ?? CAMPAIGN_MAP_TIERS['act1_early'];
        rowMaps.push(pool[Math.floor(rng() * pool.length)]);
      }
      grid.push(rowMaps);
    }
    return grid;
  }

  /**
   * Wires up node connections and returns a new node list with immutable MapNode objects.
   *
   * Algorithm:
   * 1. For each node in row R, pick 1-3 target columns in row R+1.
   * 2. Use a "no crossing" heuristic: prefer connecting to adjacent columns
   *    and avoid creating crossing edges (skip if a middle column is already
   *    claimed by a different source column).
   * 3. After assignment, ensure every node in row R+1 has at least 1 incoming
   *    connection — assign orphans to the nearest node in row R.
   */
  private buildConnections(
    rng: () => number,
    nodes: MapNode[],
    rowNodeCounts: number[],
    totalRows: number,
    actIndex: number,
  ): MapNode[] {
    // Build a mutable connection map: nodeId → Set<targetId>
    const connectionMap = new Map<string, Set<string>>();
    for (const node of nodes) {
      connectionMap.set(node.id, new Set());
    }

    for (let row = 0; row < totalRows; row++) {
      const sourceCount = rowNodeCounts[row];
      const targetCount = rowNodeCounts[row + 1];

      // Track which target columns have been claimed (for crossing detection)
      const targetClaimed = new Map<number, number>(); // targetCol → sourceCol that first claimed it

      for (let srcCol = 0; srcCol < sourceCount; srcCol++) {
        const srcId = buildNodeId(actIndex, row, srcCol);

        // Determine candidate target columns
        const candidates = this.getCandidateTargets(srcCol, sourceCount, targetCount, rng);

        // Filter crossing candidates
        const validTargets = candidates.filter(tgtCol => {
          // Allow if not claimed OR claimed by same src (already own it)
          const claimer = targetClaimed.get(tgtCol);
          if (claimer === undefined || claimer === srcCol) return true;

          // Check crossing: a crossing occurs when srcCol < claimer and tgtCol < srcCol,
          // or srcCol > claimer and tgtCol > srcCol — simplified: skip if another source
          // "on the other side" already owns an adjacent column in between.
          // Simplified rule: allow if columns are adjacent (|srcCol - tgtCol| <= 1) or
          // no intermediate column is cross-claimed.
          const min = Math.min(srcCol, claimer);
          const max = Math.max(srcCol, claimer);
          for (let mid = min + 1; mid < max; mid++) {
            if (targetClaimed.has(mid)) return false; // crossing detected
          }
          return true;
        });

        const targets = validTargets.length > 0 ? validTargets : candidates;
        const picked = targets.slice(0, NODE_MAP_CONFIG.maxConnectionsPerNode);

        for (const tgtCol of picked) {
          const tgtId = buildNodeId(actIndex, row + 1, tgtCol);
          connectionMap.get(srcId)!.add(tgtId);
          if (!targetClaimed.has(tgtCol)) {
            targetClaimed.set(tgtCol, srcCol);
          }
        }
      }

      // Ensure every target node has at least 1 incoming connection
      for (let tgtCol = 0; tgtCol < targetCount; tgtCol++) {
        const tgtId = buildNodeId(actIndex, row + 1, tgtCol);
        const hasIncoming = [...connectionMap.values()].some(set => set.has(tgtId));
        if (!hasIncoming) {
          // Connect nearest source column
          const nearestSrc = Math.min(Math.max(Math.round(tgtCol * (sourceCount / targetCount)), 0), sourceCount - 1);
          const srcId = buildNodeId(actIndex, row, nearestSrc);
          connectionMap.get(srcId)!.add(tgtId);
        }
      }
    }

    // Rebuild immutable MapNode list with connections
    return nodes.map(node => ({
      ...node,
      connections: [...(connectionMap.get(node.id) ?? new Set())],
    }));
  }

  /**
   * Returns 1-3 target column indices for a source column.
   * Biased toward the corresponding column in the next row (scaled proportionally).
   */
  private getCandidateTargets(
    srcCol: number,
    sourceCount: number,
    targetCount: number,
    rng: () => number,
  ): number[] {
    // Map src column to corresponding target column (proportional)
    const scaledCol = (srcCol / Math.max(sourceCount - 1, 1)) * (targetCount - 1);
    const primaryCol = Math.round(scaledCol);
    const clampedPrimary = Math.min(Math.max(primaryCol, 0), targetCount - 1);

    const connectionCount = NODE_MAP_CONFIG.minConnectionsPerNode +
      Math.floor(rng() * (NODE_MAP_CONFIG.maxConnectionsPerNode - NODE_MAP_CONFIG.minConnectionsPerNode + 1));

    const candidates = new Set<number>([clampedPrimary]);

    // Add adjacent columns up to connectionCount
    const neighbors = [clampedPrimary - 1, clampedPrimary + 1].filter(c => c >= 0 && c < targetCount);
    for (const neighbor of neighbors) {
      if (candidates.size >= connectionCount) break;
      if (rng() < 0.5) candidates.add(neighbor);
    }

    // Ensure at least 1 candidate
    if (candidates.size === 0) candidates.add(clampedPrimary);

    return [...candidates];
  }
}

/** Formats a node ID string from its act/row/column coordinates. */
function buildNodeId(actIndex: number, row: number, column: number): string {
  return `act${actIndex}_r${row}_c${column}`;
}
