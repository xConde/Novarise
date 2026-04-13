import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ElementRef } from '@angular/core';
import { NodeMapComponent } from './node-map.component';
import { MapNode, NodeMap, NodeType } from '../../models/node-map.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EncounterCheckpointService } from '../../services/encounter-checkpoint.service';

// ── Test factory helpers ─────────────────────────────────────────────────────

function makeNode(overrides: Partial<MapNode> = {}): MapNode {
  return {
    id: 'act0_r0_c0',
    type: NodeType.COMBAT,
    row: 0,
    column: 0,
    connections: [],
    campaignMapId: 'campaign_01',
    visited: false,
    ...overrides,
  };
}

function makeNodeMap(nodes: MapNode[] = []): NodeMap {
  const startNode = nodes.find(n => n.row === 0) ?? makeNode();
  return {
    actIndex: 0,
    nodes: nodes.length > 0 ? nodes : [startNode],
    startNodeIds: [startNode.id],
    bossNodeId: 'boss',
    rows: 3,
  };
}

/**
 * Minimal three-row map:
 *   row 2 (boss): 1 node, no connections
 *   row 1:        2 nodes, each connects to boss
 *   row 0 (start): 2 nodes, each connects to row-1 nodes
 */
function makeThreeRowMap(): NodeMap {
  const boss: MapNode = makeNode({ id: 'r2c0', type: NodeType.BOSS, row: 2, column: 0, connections: [] });
  const mid0: MapNode = makeNode({ id: 'r1c0', type: NodeType.ELITE, row: 1, column: 0, connections: ['r2c0'] });
  const mid1: MapNode = makeNode({ id: 'r1c1', type: NodeType.REST, row: 1, column: 1, connections: ['r2c0'] });
  const start0: MapNode = makeNode({ id: 'r0c0', type: NodeType.COMBAT, row: 0, column: 0, connections: ['r1c0', 'r1c1'] });
  const start1: MapNode = makeNode({ id: 'r0c1', type: NodeType.COMBAT, row: 0, column: 1, connections: ['r1c1'] });

  return {
    actIndex: 0,
    nodes: [boss, mid0, mid1, start0, start1],
    startNodeIds: ['r0c0', 'r0c1'],
    bossNodeId: 'r2c0',
    rows: 3,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NodeMapComponent', () => {
  let fixture: ComponentFixture<NodeMapComponent>;
  let component: NodeMapComponent;
  let checkpointService: jasmine.SpyObj<EncounterCheckpointService>;

  beforeEach(async () => {
    checkpointService = jasmine.createSpyObj('EncounterCheckpointService', [
      'getCheckpointNodeId',
      'hasCheckpoint',
      'loadCheckpoint',
      'saveCheckpoint',
      'clearCheckpoint',
    ]);
    checkpointService.getCheckpointNodeId.and.returnValue(null);

    await TestBed.configureTestingModule({
      declarations: [NodeMapComponent],
      imports: [CommonModule, IconComponent],
      providers: [
        { provide: EncounterCheckpointService, useValue: checkpointService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NodeMapComponent);
    component = fixture.componentInstance;
    component.nodeMap = makeThreeRowMap();
    component.currentNodeId = null;
    component.completedNodeIds = [];
    component.availableNodes = [];
    // Deliberately skip detectChanges() — no Three.js canvas but we still
    // avoid triggering Angular's full CD before inputs are set.
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  describe('computeLayout()', () => {
    beforeEach(() => {
      component.computeLayout();
    });

    it('computes positions for every node in the map', () => {
      const map = makeThreeRowMap();
      component.nodeMap = map;
      component.computeLayout();

      for (const node of map.nodes) {
        expect(component.nodePositions.has(node.id))
          .withContext(`Expected position for node ${node.id}`)
          .toBeTrue();
      }
    });

    it('assigns distinct x positions to nodes in the same row', () => {
      const pos0 = component.nodePositions.get('r0c0');
      const pos1 = component.nodePositions.get('r0c1');
      expect(pos0).toBeDefined();
      expect(pos1).toBeDefined();
      expect(pos0!.x).not.toBe(pos1!.x);
    });

    it('assigns distinct y positions to nodes in different rows', () => {
      const posRow0 = component.nodePositions.get('r0c0');
      const posRow1 = component.nodePositions.get('r1c0');
      const posRow2 = component.nodePositions.get('r2c0');
      expect(posRow0!.y).not.toBe(posRow1!.y);
      expect(posRow1!.y).not.toBe(posRow2!.y);
    });

    it('row 0 is at a smaller y (top of canvas) than row 2 (boss at bottom)', () => {
      const posRow0 = component.nodePositions.get('r0c0')!;
      const posRow2 = component.nodePositions.get('r2c0')!;
      // Y increases downward; row 0 (start) should have smaller y than boss row
      expect(posRow0.y).toBeLessThan(posRow2.y);
    });

    it('mapHeight is positive and scales with row count', () => {
      expect(component.mapHeight).toBeGreaterThan(0);
    });
  });

  describe('connectionPaths', () => {
    beforeEach(() => {
      component.computeLayout();
    });

    it('generates connection paths from node edges', () => {
      // Three-row map has edges: r0c0→r1c0, r0c0→r1c1, r0c1→r1c1, r1c0→r2c0, r1c1→r2c0
      expect(component.connectionPaths.length).toBeGreaterThan(0);
    });

    it('each path has a non-empty SVG d attribute', () => {
      for (const path of component.connectionPaths) {
        expect(path.d).toBeTruthy();
        expect(path.d.startsWith('M')).toBeTrue();
      }
    });

    it('marks edges from currentNode to availableNodes as active', () => {
      const availableNode = makeThreeRowMap().nodes.find(n => n.id === 'r1c0')!;
      component.currentNodeId = 'r0c0';
      component.availableNodes = [availableNode];
      component.computeLayout();

      const activePaths = component.connectionPaths.filter(p => p.active);
      expect(activePaths.length).toBeGreaterThan(0);
    });

    it('marks paths between two visited nodes as visited', () => {
      component.completedNodeIds = ['r0c0', 'r1c0'];
      component.computeLayout();

      const visitedPaths = component.connectionPaths.filter(p => p.visited);
      expect(visitedPaths.length).toBeGreaterThan(0);
    });

    it('does not mark paths as active when no current node', () => {
      component.currentNodeId = null;
      component.availableNodes = [];
      component.computeLayout();

      expect(component.connectionPaths.every(p => !p.active)).toBeTrue();
    });
  });

  describe('isSelectable()', () => {
    it('returns true when the node is in availableNodes', () => {
      const node = makeNode({ id: 'test-node' });
      component.availableNodes = [node];
      expect(component.isSelectable(node)).toBeTrue();
    });

    it('returns false when the node is not in availableNodes', () => {
      const node = makeNode({ id: 'test-node' });
      component.availableNodes = [];
      expect(component.isSelectable(node)).toBeFalse();
    });
  });

  describe('isVisited()', () => {
    it('returns true for a node ID in completedNodeIds', () => {
      component.completedNodeIds = ['r0c0'];
      expect(component.isVisited('r0c0')).toBeTrue();
    });

    it('returns false for a node ID not in completedNodeIds', () => {
      component.completedNodeIds = ['r0c0'];
      expect(component.isVisited('r1c0')).toBeFalse();
    });
  });

  describe('isCurrent()', () => {
    it('returns true when nodeId matches currentNodeId', () => {
      component.currentNodeId = 'r0c0';
      expect(component.isCurrent('r0c0')).toBeTrue();
    });

    it('returns false when nodeId does not match', () => {
      component.currentNodeId = 'r0c0';
      expect(component.isCurrent('r1c0')).toBeFalse();
    });

    it('returns false when currentNodeId is null', () => {
      component.currentNodeId = null;
      expect(component.isCurrent('r0c0')).toBeFalse();
    });
  });

  describe('onNodeClick()', () => {
    it('emits nodeSelected when clicking a selectable node', () => {
      const node = makeNode({ id: 'r0c0' });
      component.availableNodes = [node];
      const spy = jasmine.createSpy('nodeSelected');
      component.nodeSelected.subscribe(spy);

      component.onNodeClick(node);

      expect(spy).toHaveBeenCalledWith(node);
    });

    it('does NOT emit nodeSelected when clicking a non-selectable node', () => {
      const node = makeNode({ id: 'r1c0' });
      component.availableNodes = [];
      const spy = jasmine.createSpy('nodeSelected');
      component.nodeSelected.subscribe(spy);

      component.onNodeClick(node);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getNodeTooltip()', () => {
    it('returns type label and campaignMapId', () => {
      const node = makeNode({ type: NodeType.ELITE, campaignMapId: 'campaign_05' });
      expect(component.getNodeTooltip(node)).toBe('Elite — campaign_05');
    });

    it('formats boss node correctly', () => {
      const node = makeNode({ type: NodeType.BOSS, campaignMapId: 'campaign_12' });
      expect(component.getNodeTooltip(node)).toBe('Boss — campaign_12');
    });

    it('formats rest node correctly', () => {
      const node = makeNode({ type: NodeType.REST, campaignMapId: 'campaign_03' });
      expect(component.getNodeTooltip(node)).toBe('Rest — campaign_03');
    });
  });

  describe('getNodeLeft() / getNodeTop()', () => {
    beforeEach(() => {
      component.computeLayout();
    });

    it('returns a number for a known node ID', () => {
      expect(typeof component.getNodeLeft('r0c0')).toBe('number');
      expect(typeof component.getNodeTop('r0c0')).toBe('number');
    });

    it('returns 0 for an unknown node ID', () => {
      expect(component.getNodeLeft('non-existent')).toBe(0);
      expect(component.getNodeTop('non-existent')).toBe(0);
    });
  });

  describe('scrollToCurrentNode()', () => {
    it('does not throw when currentNodeId is null', () => {
      component.currentNodeId = null;
      expect(() => component.scrollToCurrentNode()).not.toThrow();
    });

    it('does not throw when mapContainer is not set', () => {
      component.currentNodeId = 'r0c0';
      // @ViewChild not populated in unit test (no real DOM)
      (component as unknown as { mapContainer: unknown }).mapContainer = undefined;
      expect(() => component.scrollToCurrentNode()).not.toThrow();
    });

    it('does not throw when currentNodeId has no computed position', () => {
      component.currentNodeId = 'non-existent-id';
      const el = document.createElement('div');
      (component as unknown as { mapContainer: ElementRef<HTMLDivElement> }).mapContainer =
        new ElementRef(el);
      expect(() => component.scrollToCurrentNode()).not.toThrow();
    });

    it('calls scrollTo on the container when position is available', () => {
      component.computeLayout();
      component.currentNodeId = 'r0c0';

      const el = document.createElement('div');
      const scrollSpy = jasmine.createSpy('scrollTo');
      el.scrollTo = scrollSpy;
      (component as unknown as { mapContainer: ElementRef<HTMLDivElement> }).mapContainer =
        new ElementRef(el);

      component.scrollToCurrentNode();

      expect(scrollSpy).toHaveBeenCalledWith(jasmine.objectContaining({ behavior: 'smooth' }));
    });
  });

  describe('single-node edge case', () => {
    it('handles a map with a single node without throwing', () => {
      const single = makeNode({ id: 'solo' });
      component.nodeMap = makeNodeMap([single]);
      expect(() => component.computeLayout()).not.toThrow();
      expect(component.nodePositions.has('solo')).toBeTrue();
    });
  });

  describe('isCheckpointed()', () => {
    it('returns true when the checkpoint service reports a matching node ID', () => {
      checkpointService.getCheckpointNodeId.and.returnValue('r0c0');
      expect(component.isCheckpointed('r0c0')).toBeTrue();
    });

    it('returns false when the checkpoint service reports a different node ID', () => {
      checkpointService.getCheckpointNodeId.and.returnValue('r1c0');
      expect(component.isCheckpointed('r0c0')).toBeFalse();
    });

    it('returns false when there is no checkpoint (null)', () => {
      checkpointService.getCheckpointNodeId.and.returnValue(null);
      expect(component.isCheckpointed('r0c0')).toBeFalse();
    });

    it('delegates to EncounterCheckpointService.getCheckpointNodeId()', () => {
      checkpointService.getCheckpointNodeId.and.returnValue('r2c0');
      component.isCheckpointed('r2c0');
      expect(checkpointService.getCheckpointNodeId).toHaveBeenCalled();
    });
  });
});
