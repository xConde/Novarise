import {
  getAvailableNodes,
  getNodeById,
  getNodeEdges,
  getSelectableNodes,
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

  describe('getSelectableNodes()', () => {
    const nodes = [
      makeNode('s1', 0, 0, ['m1', 'm2']),
      makeNode('s2', 0, 1, ['m2']),
      makeNode('m1', 1, 0, ['boss']),
      makeNode('m2', 1, 1, ['boss']),
      makeNode('boss', 2, 0, [], NodeType.BOSS),
    ];
    const map = makeMap(nodes);

    it('should return start nodes when currentNodeId is null', () => {
      const result = getSelectableNodes(map, null, []);
      const ids = result.map(n => n.id);
      expect(ids).toContain('s1');
      expect(ids).toContain('s2');
      expect(ids.length).toBe(2);
    });

    it('should return only the current node when it is not completed', () => {
      const result = getSelectableNodes(map, 's1', []);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('s1');
    });

    it('should return connections when current node IS completed', () => {
      const result = getSelectableNodes(map, 's1', ['s1']);
      const ids = result.map(n => n.id);
      expect(ids).toContain('m1');
      expect(ids).toContain('m2');
      expect(ids.length).toBe(2);
    });

    it('should return empty array when current node is not in the map', () => {
      const result = getSelectableNodes(map, 'nonexistent', []);
      expect(result).toEqual([]);
    });

    it('should not leak next-row nodes for uncompleted combat node (the skip bug)', () => {
      // Player selected s1 but exited combat without completing — must NOT see m1/m2
      const result = getSelectableNodes(map, 's1', []);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('s1');
      expect(result.some(n => n.id === 'm1')).toBeFalse();
      expect(result.some(n => n.id === 'm2')).toBeFalse();
    });

    it('should handle multi-node progression correctly', () => {
      // Complete s1, then select m1 (not yet completed)
      const afterS1 = getSelectableNodes(map, 'm1', ['s1']);
      expect(afterS1.length).toBe(1);
      expect(afterS1[0].id).toBe('m1');

      // Complete m1 — boss becomes available
      const afterM1 = getSelectableNodes(map, 'm1', ['s1', 'm1']);
      expect(afterM1.length).toBe(1);
      expect(afterM1[0].id).toBe('boss');
    });

    it('should return empty connections for completed boss (end of act)', () => {
      const result = getSelectableNodes(map, 'boss', ['s1', 'm1', 'boss']);
      expect(result).toEqual([]);
    });
  });
});
