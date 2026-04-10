import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { MapNode, NodeMap, NodeType, getNodeEdges } from '../../models/node-map.model';

/** Pixel dimensions for the SVG map canvas. */
const NODE_MAP_LAYOUT = {
  /** Width of the SVG canvas in px. */
  width: 500,
  /** Vertical spacing between rows in px. */
  rowSpacing: 90,
  /** Horizontal padding on each side of the canvas in px. */
  paddingX: 50,
  /** Top/bottom padding in px. */
  paddingY: 60,
  /** Node button diameter in px — WCAG minimum (2.75rem = 44px). */
  nodeSize: 44,
  /** Radius of the node circle for SVG path anchoring. */
  nodeRadius: 22,
} as const;

/** Bezier curve control point vertical offset relative to mid-point. */
const BEZIER_CTRL_OFFSET = 30;

export interface ConnectionPath {
  readonly d: string;
  /** True if this edge leads from the current node to an available next node. */
  readonly active: boolean;
  /** True if both endpoints have been visited. */
  readonly visited: boolean;
}

@Component({
  selector: 'app-node-map',
  templateUrl: './node-map.component.html',
  styleUrls: ['./node-map.component.scss'],
})
export class NodeMapComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() nodeMap!: NodeMap;
  @Input() currentNodeId: string | null = null;
  @Input() completedNodeIds: string[] = [];
  @Input() availableNodes: MapNode[] = [];
  @Output() nodeSelected = new EventEmitter<MapNode>();

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  /** Computed (x, y) pixel positions for each node, keyed by node ID. */
  nodePositions = new Map<string, { x: number; y: number }>();

  /** SVG cubic-bezier path data for each connection edge. */
  connectionPaths: ConnectionPath[] = [];

  /** Total pixel height of the SVG canvas (derived from row count). */
  mapHeight = NODE_MAP_LAYOUT.rowSpacing * 12 + NODE_MAP_LAYOUT.paddingY * 2;

  readonly mapWidth = NODE_MAP_LAYOUT.width;
  readonly nodeSize = NODE_MAP_LAYOUT.nodeSize;

  readonly NodeType = NodeType;

  /** Unicode / HTML-entity icon per node type. */
  readonly nodeIcons: Record<string, string> = {
    [NodeType.COMBAT]: '\u2694',    // ⚔
    [NodeType.ELITE]: '\u26A1',     // ⚡
    [NodeType.BOSS]: '\u2620',      // ☠
    [NodeType.REST]: '\u2615',      // ☕
    [NodeType.SHOP]: '\u25A0',      // ■ (coin-like square)
    [NodeType.EVENT]: '?',
    [NodeType.UNKNOWN]: '?',
  };

  readonly nodeLabels: Record<string, string> = {
    [NodeType.COMBAT]: 'Combat',
    [NodeType.ELITE]: 'Elite',
    [NodeType.BOSS]: 'Boss',
    [NodeType.REST]: 'Rest',
    [NodeType.SHOP]: 'Shop',
    [NodeType.EVENT]: 'Event',
    [NodeType.UNKNOWN]: 'Unknown',
  };

  ngOnInit(): void {
    this.computeLayout();
  }

  ngOnChanges(): void {
    this.computeLayout();
  }

  ngAfterViewInit(): void {
    this.scrollToCurrentNode();
  }

  /**
   * Computes pixel positions for every node and builds SVG bezier paths.
   *
   * Visual coordinate system:
   * - Row 0 (start) is rendered at the BOTTOM of the canvas.
   * - Boss row is rendered at the TOP.
   * - Within each row, nodes are evenly distributed horizontally.
   */
  computeLayout(): void {
    if (!this.nodeMap) return;

    const totalRows = this.nodeMap.rows; // includes boss row
    this.mapHeight = totalRows * NODE_MAP_LAYOUT.rowSpacing + NODE_MAP_LAYOUT.paddingY * 2;

    // Group nodes by row
    const nodesByRow = new Map<number, MapNode[]>();
    for (const node of this.nodeMap.nodes) {
      if (!nodesByRow.has(node.row)) {
        nodesByRow.set(node.row, []);
      }
      nodesByRow.get(node.row)!.push(node);
    }

    // Sort each row's nodes by column for stable left-to-right ordering
    nodesByRow.forEach(nodes => nodes.sort((a, b) => a.column - b.column));

    this.nodePositions.clear();

    for (const [row, rowNodes] of nodesByRow.entries()) {
      const count = rowNodes.length;
      // Flip Y: row 0 is at bottom
      const y = this.mapHeight - NODE_MAP_LAYOUT.paddingY - row * NODE_MAP_LAYOUT.rowSpacing;

      for (let i = 0; i < count; i++) {
        const usableWidth = this.mapWidth - NODE_MAP_LAYOUT.paddingX * 2;
        const x = count === 1
          ? this.mapWidth / 2
          : NODE_MAP_LAYOUT.paddingX + (usableWidth / (count - 1)) * i;

        this.nodePositions.set(rowNodes[i].id, { x, y });
      }
    }

    this.buildConnectionPaths();
  }

  private buildConnectionPaths(): void {
    if (!this.nodeMap) {
      this.connectionPaths = [];
      return;
    }

    const edges = getNodeEdges(this.nodeMap);
    const completedSet = new Set(this.completedNodeIds);
    const availableSet = new Set(this.availableNodes.map(n => n.id));

    this.connectionPaths = edges
      .filter(edge => this.nodePositions.has(edge.fromId) && this.nodePositions.has(edge.toId))
      .map(edge => {
        const from = this.nodePositions.get(edge.fromId)!;
        const to = this.nodePositions.get(edge.toId)!;

        // Anchor at top/bottom of the node circle
        const x1 = from.x;
        const y1 = from.y - NODE_MAP_LAYOUT.nodeRadius;
        const x2 = to.x;
        const y2 = to.y + NODE_MAP_LAYOUT.nodeRadius;

        // Cubic bezier control points for a smooth S-curve
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY - BEZIER_CTRL_OFFSET}, ${x2} ${midY + BEZIER_CTRL_OFFSET}, ${x2} ${y2}`;

        const fromVisited = completedSet.has(edge.fromId);
        const toVisited = completedSet.has(edge.toId);
        const active = edge.fromId === this.currentNodeId && availableSet.has(edge.toId);

        return { d, active, visited: fromVisited && toVisited };
      });
  }

  /** After view init, scroll so the current node row is centered in the viewport. */
  scrollToCurrentNode(): void {
    if (!this.currentNodeId || !this.mapContainer) return;
    const pos = this.nodePositions.get(this.currentNodeId);
    if (!pos) return;

    const container = this.mapContainer.nativeElement;
    const containerHeight = container.clientHeight;
    const scrollTarget = pos.y - containerHeight / 2;
    container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }

  isSelectable(node: MapNode): boolean {
    return this.availableNodes.some(n => n.id === node.id);
  }

  isVisited(nodeId: string): boolean {
    return this.completedNodeIds.includes(nodeId);
  }

  isCurrent(nodeId: string): boolean {
    return nodeId === this.currentNodeId;
  }

  onNodeClick(node: MapNode): void {
    if (this.isSelectable(node)) {
      this.nodeSelected.emit(node);
    }
  }

  getNodeTooltip(node: MapNode): string {
    const label = this.nodeLabels[node.type] ?? node.type;
    return `${label} — ${node.campaignMapId}`;
  }

  /** Returns left offset in px, accounting for node size so node center aligns to position. */
  getNodeLeft(nodeId: string): number {
    const pos = this.nodePositions.get(nodeId);
    return pos ? pos.x - NODE_MAP_LAYOUT.nodeRadius : 0;
  }

  /** Returns top offset in px, accounting for node size so node center aligns to position. */
  getNodeTop(nodeId: string): number {
    const pos = this.nodePositions.get(nodeId);
    return pos ? pos.y - NODE_MAP_LAYOUT.nodeRadius : 0;
  }
}
