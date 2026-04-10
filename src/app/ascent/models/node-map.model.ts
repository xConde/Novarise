/**
 * Node map model for Ascent Mode.
 *
 * A node map is a StS-style branching graph of encounters per act.
 * Rows run vertically (0 = first encounter, N = boss).
 * Within each row, 2-4 nodes offer lateral path choice.
 */

export enum NodeType {
  COMBAT = 'combat',
  ELITE = 'elite',
  REST = 'rest',
  SHOP = 'shop',
  EVENT = 'event',
  BOSS = 'boss',
  UNKNOWN = 'unknown',
}

export interface MapNode {
  readonly id: string;
  readonly type: NodeType;
  readonly row: number;
  readonly column: number;
  readonly connections: string[];
  readonly campaignMapId: string;
  readonly visited: boolean;
}

export interface NodeMap {
  readonly actIndex: number;
  readonly nodes: ReadonlyArray<MapNode>;
  readonly startNodeIds: string[];
  readonly bossNodeId: string;
  readonly rows: number;
}

/** Visual position for rendering the node map UI. */
export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

/** Edge between two nodes for rendering connections. */
export interface NodeEdge {
  readonly fromId: string;
  readonly toId: string;
}

/**
 * Build a flat list of all edges from a node map.
 * Each edge goes from a node to one of its connections (downward/forward).
 */
export function getNodeEdges(map: NodeMap): NodeEdge[] {
  const edges: NodeEdge[] = [];
  for (const node of map.nodes) {
    for (const targetId of node.connections) {
      edges.push({ fromId: node.id, toId: targetId });
    }
  }
  return edges;
}

/**
 * Find nodes reachable from the current position (one step forward).
 * Returns empty if the current node has no connections (boss reached).
 */
export function getAvailableNodes(map: NodeMap, currentNodeId: string): MapNode[] {
  const current = map.nodes.find(n => n.id === currentNodeId);
  if (!current) return [];
  return current.connections
    .map(id => map.nodes.find(n => n.id === id))
    .filter((n): n is MapNode => n !== undefined);
}

/**
 * Returns the node by ID, or undefined if not found.
 */
export function getNodeById(map: NodeMap, nodeId: string): MapNode | undefined {
  return map.nodes.find(n => n.id === nodeId);
}
