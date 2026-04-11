import {
  getAvailableNodes,
  getNodeById,
  getNodeEdges,
  MapNode,
  NodeMap,
  NodeType,
} from './node-map.model';

// ── Test helpers ──────────────────────────────────────────────

function makeNode(id: string, row: number, column: number, connections: string[], type: NodeType = NodeType.COMBAT): MapNode {
  return { id, type, row, column, connections, campaignMapId: 'campaign_01', visited: false };
}

function makeMap(nodes: MapNode[]): NodeMap {
  const startNodeIds = nodes.filter(n => n.row === 0).map(n => n.id);
  const bossNode = nodes.find(n => n.type === NodeType.BOSS);
  return {
    actIndex: 0,
    nodes,
    startNodeIds,
    bossNodeId: bossNode?.id ?? '',
    rows: 12,
  };
}

// ── Specs ─────────────────────────────────────────────────────

describe('NodeMap Model', () => {
  describe('getNodeEdges()', () => {
    it('should return an empty array for a map with no connections', () => {
      const nodes = [makeNode('a', 0, 0, []), makeNode('b', 1, 0, [])];
      const map = makeMap(nodes);
      expect(getNodeEdges(map)).toEqual([]);
    });

    it('should return one edge per connection', () => {
      const nodes = [
        makeNode('a', 0, 0, ['b', 'c']),
        makeNode('b', 1, 0, []),
        makeNode('c', 1, 1, []),
      ];
      const map = makeMap(nodes);
      const edges = getNodeEdges(map);
      expect(edges.length).toBe(2);
    });

    it('should set fromId and toId correctly', () => {
      const nodes = [
        makeNode('a', 0, 0, ['b']),
        makeNode('b', 1, 0, []),
      ];
      const map = makeMap(nodes);
      const edges = getNodeEdges(map);
      expect(edges[0].fromId).toBe('a');
      expect(edges[0].toId).toBe('b');
    });

    it('should aggregate edges from multiple source nodes', () => {
      const nodes = [
        makeNode('a', 0, 0, ['c']),
        makeNode('b', 0, 1, ['c', 'd']),
        makeNode('c', 1, 0, []),
        makeNode('d', 1, 1, []),
      ];
      const map = makeMap(nodes);
      const edges = getNodeEdges(map);
      expect(edges.length).toBe(3);
    });
  });

  describe('getAvailableNodes()', () => {
    it('should return nodes connected from the current node', () => {
      const nodes = [
        makeNode('a', 0, 0, ['b', 'c']),
        makeNode('b', 1, 0, []),
        makeNode('c', 1, 1, []),
      ];
      const map = makeMap(nodes);
      const available = getAvailableNodes(map, 'a');
      expect(available.length).toBe(2);
      const ids = available.map(n => n.id);
      expect(ids).toContain('b');
      expect(ids).toContain('c');
    });

    it('should return empty array for a boss node with no connections', () => {
      const bossNode = makeNode('boss', 11, 0, [], NodeType.BOSS);
      const map = makeMap([makeNode('a', 0, 0, ['boss']), bossNode]);
      const available = getAvailableNodes(map, 'boss');
      expect(available).toEqual([]);
    });

    it('should return empty array when currentNodeId is not in the map', () => {
      const nodes = [makeNode('a', 0, 0, ['b']), makeNode('b', 1, 0, [])];
      const map = makeMap(nodes);
      expect(getAvailableNodes(map, 'nonexistent')).toEqual([]);
    });

    it('should return nodes with correct types', () => {
      const nodes = [
        makeNode('a', 0, 0, ['shop', 'rest']),
        makeNode('shop', 1, 0, [], NodeType.SHOP),
        makeNode('rest', 1, 1, [], NodeType.REST),
      ];
      const map = makeMap(nodes);
      const available = getAvailableNodes(map, 'a');
      const types = available.map(n => n.type);
      expect(types).toContain(NodeType.SHOP);
      expect(types).toContain(NodeType.REST);
    });

    it('should ignore connection targets that do not exist as nodes', () => {
      const nodes = [
        makeNode('a', 0, 0, ['b', 'missing']),
        makeNode('b', 1, 0, []),
      ];
      const map = makeMap(nodes);
      const available = getAvailableNodes(map, 'a');
      expect(available.length).toBe(1);
      expect(available[0].id).toBe('b');
    });
  });

  describe('getNodeById()', () => {
    it('should return the correct node by id', () => {
      const nodes = [makeNode('a', 0, 0, []), makeNode('b', 1, 0, [])];
      const map = makeMap(nodes);
      const found = getNodeById(map, 'b');
      expect(found).toBeDefined();
      expect(found!.id).toBe('b');
      expect(found!.row).toBe(1);
    });

    it('should return undefined when id is not found', () => {
      const nodes = [makeNode('a', 0, 0, [])];
      const map = makeMap(nodes);
      expect(getNodeById(map, 'nonexistent')).toBeUndefined();
    });

    it('should return node with correct column', () => {
      const nodes = [makeNode('a', 0, 2, [])];
      const map = makeMap(nodes);
      const found = getNodeById(map, 'a');
      expect(found!.column).toBe(2);
    });
  });
});
