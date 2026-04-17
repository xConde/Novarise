import { TestBed } from '@angular/core/testing';
import { NodeMapGeneratorService } from './node-map-generator.service';
import { NodeType } from '../models/node-map.model';
import { NODE_MAP_CONFIG } from '../constants/run.constants';

describe('NodeMapGeneratorService', () => {
  let service: NodeMapGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NodeMapGeneratorService],
    });
    service = TestBed.inject(NodeMapGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateActMap() — structural invariants', () => {
    it('should produce a map with rowsPerAct + 1 rows (12 total)', () => {
      const map = service.generateActMap(0, 42);
      expect(map.rows).toBe(NODE_MAP_CONFIG.rowsPerAct + 1);
    });

    it('should set actIndex on the returned map', () => {
      const map = service.generateActMap(0, 42);
      expect(map.actIndex).toBe(0);
    });

    it('should produce all COMBAT nodes in row 0', () => {
      const map = service.generateActMap(0, 42);
      const row0Nodes = map.nodes.filter(n => n.row === 0);
      expect(row0Nodes.length).toBeGreaterThan(0);
      row0Nodes.forEach(n => expect(n.type).toBe(NodeType.COMBAT));
    });

    it('should produce exactly one BOSS node in the last row', () => {
      const map = service.generateActMap(0, 42);
      const bossNodes = map.nodes.filter(n => n.type === NodeType.BOSS);
      expect(bossNodes.length).toBe(1);
      expect(bossNodes[0].row).toBe(NODE_MAP_CONFIG.rowsPerAct);
    });

    it('should have at least one SHOP node in row 5', () => {
      const map = service.generateActMap(0, 42);
      const row5Shops = map.nodes.filter(n => n.row === NODE_MAP_CONFIG.guaranteedShop && n.type === NodeType.SHOP);
      expect(row5Shops.length).toBeGreaterThanOrEqual(1);
    });

    it('should have at least one REST node in row 8', () => {
      const map = service.generateActMap(0, 42);
      const row8Rests = map.nodes.filter(n => n.row === NODE_MAP_CONFIG.guaranteedRest && n.type === NodeType.REST);
      expect(row8Rests.length).toBeGreaterThanOrEqual(1);
    });

    it('should place no ELITE nodes outside rows 3-9', () => {
      const map = service.generateActMap(0, 42);
      const eliteNodes = map.nodes.filter(n => n.type === NodeType.ELITE);
      eliteNodes.forEach(n => {
        expect(n.row).toBeGreaterThanOrEqual(NODE_MAP_CONFIG.eliteMinRow);
        expect(n.row).toBeLessThanOrEqual(NODE_MAP_CONFIG.eliteMaxRow);
      });
    });

    it('every non-boss node should have at least 1 outgoing connection', () => {
      const map = service.generateActMap(0, 42);
      const nonBossNodes = map.nodes.filter(n => n.type !== NodeType.BOSS);
      nonBossNodes.forEach(n => {
        expect(n.connections.length).toBeGreaterThanOrEqual(1, `node ${n.id} has no outgoing connections`);
      });
    });

    it('every non-row-0 node should have at least 1 incoming connection', () => {
      const map = service.generateActMap(0, 42);
      const nonRow0Nodes = map.nodes.filter(n => n.row > 0);
      const allConnections = new Set<string>();
      map.nodes.forEach(n => n.connections.forEach(c => allConnections.add(c)));
      nonRow0Nodes.forEach(n => {
        expect(allConnections.has(n.id)).withContext(`node ${n.id} has no incoming connection`).toBeTrue();
      });
    });

    it('startNodeIds should all be from row 0', () => {
      const map = service.generateActMap(0, 42);
      const row0Ids = new Set(map.nodes.filter(n => n.row === 0).map(n => n.id));
      map.startNodeIds.forEach(id => {
        expect(row0Ids.has(id)).withContext(`startNodeId ${id} is not in row 0`).toBeTrue();
      });
    });

    it('bossNodeId should match the BOSS node', () => {
      const map = service.generateActMap(0, 42);
      const bossNode = map.nodes.find(n => n.type === NodeType.BOSS);
      expect(map.bossNodeId).toBe(bossNode!.id);
    });

    it('all nodes should have a non-empty campaignMapId', () => {
      const map = service.generateActMap(0, 42);
      map.nodes.forEach(n => {
        expect(n.campaignMapId.length).toBeGreaterThan(0, `node ${n.id} has empty campaignMapId`);
      });
    });
  });

  describe('generateActMap() — determinism', () => {
    it('same seed should produce identical maps', () => {
      const map1 = service.generateActMap(0, 99);
      const map2 = service.generateActMap(0, 99);
      expect(map1.nodes.length).toBe(map2.nodes.length);
      map1.nodes.forEach((n, i) => {
        expect(n.id).toBe(map2.nodes[i].id);
        expect(n.type).toBe(map2.nodes[i].type);
        expect(n.connections).toEqual(map2.nodes[i].connections);
      });
    });

    it('different seeds should produce different maps', () => {
      const map1 = service.generateActMap(0, 42);
      const map2 = service.generateActMap(0, 100);
      // Node counts or types must differ somewhere
      const nodesMatch = map1.nodes.every((n, i) => n.type === map2.nodes[i]?.type);
      const countsMatch = map1.nodes.length === map2.nodes.length;
      expect(!nodesMatch || !countsMatch).toBeTrue();
    });

    it('act 0 and act 1 with the same seed should produce maps with different node IDs', () => {
      const map1 = service.generateActMap(0, 42);
      const map2 = service.generateActMap(1, 42);
      // Node IDs embed actIndex, so they must differ
      expect(map1.nodes[0].id).not.toBe(map2.nodes[0].id);
    });
  });
});
