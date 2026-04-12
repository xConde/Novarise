import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MapNode, NodeMap, NodeType, getNodeEdges } from '../../models/node-map.model';

/** Pixel dimensions for the SVG map canvas. */
const NODE_MAP_LAYOUT = {
  /** Width of the SVG canvas in px. */
  width: 500,
  /** Vertical spacing between rows in px. */
  rowSpacing: 90,
  /** Horizontal padding on each side of the canvas in px. */
  paddingX: 50,
  /** Top padding in px. */
  paddingY: 40,
  /** Bottom padding below last node's edge. */
  paddingBottom: 8,
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
export class NodeMapComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
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
  mapHeight = 11 * NODE_MAP_LAYOUT.rowSpacing + NODE_MAP_LAYOUT.paddingY + NODE_MAP_LAYOUT.nodeRadius + NODE_MAP_LAYOUT.paddingBottom;

  mapWidth: number = NODE_MAP_LAYOUT.width;
  readonly nodeSize = NODE_MAP_LAYOUT.nodeSize;

  readonly NodeType = NodeType;

  /** Inline SVG icon per node type (16×16 display, 24×24 viewBox, stroke-based). Pre-sanitized as SafeHtml. */
  readonly nodeIcons: Record<string, SafeHtml>;

  readonly nodeLabels: Record<string, string> = {
    [NodeType.COMBAT]: 'Combat',
    [NodeType.ELITE]: 'Elite',
    [NodeType.BOSS]: 'Boss',
    [NodeType.REST]: 'Rest',
    [NodeType.SHOP]: 'Shop',
    [NodeType.EVENT]: 'Event',
    [NodeType.UNKNOWN]: 'Unknown',
  };

  constructor(private sanitizer: DomSanitizer) {
    const s = (html: string): SafeHtml => this.sanitizer.bypassSecurityTrustHtml(html);
    this.nodeIcons = {
      [NodeType.COMBAT]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="18" y1="6" x2="6" y2="18"/>' +
        '<line x1="6" y1="6" x2="18" y2="18"/>' +
        '<line x1="6" y1="2" x2="6" y2="10"/>' +
        '<line x1="18" y1="14" x2="18" y2="22"/>' +
        '</svg>',
      ),
      [NodeType.ELITE]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 2 C10 6 7 8 7 12 C7 16 9.5 19 12 20 C14.5 19 17 16 17 12 C17 8 14 6 12 2Z"/>' +
        '<line x1="12" y1="20" x2="12" y2="22"/>' +
        '</svg>',
      ),
      [NodeType.BOSS]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="10" r="7"/>' +
        '<path d="M9 9 L9.5 11 M15 9 L14.5 11"/>' +
        '<path d="M9 14 Q12 16 15 14"/>' +
        '</svg>',
      ),
      [NodeType.REST]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>' +
        '</svg>',
      ),
      [NodeType.SHOP]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="8"/>' +
        '<line x1="12" y1="7" x2="12" y2="17"/>' +
        '<path d="M9 10 Q9 8 12 8 Q15 8 15 10 Q15 12 12 12 Q9 12 9 14 Q9 16 12 16 Q15 16 15 14"/>' +
        '</svg>',
      ),
      [NodeType.EVENT]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/>' +
        '<line x1="12" y1="8" x2="12" y2="13"/>' +
        '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
        '</svg>',
      ),
      [NodeType.UNKNOWN]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/>' +
        '<path d="M9.5 9 C9.5 7 14.5 7 14.5 10 C14.5 12 12 12 12 14"/>' +
        '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
        '</svg>',
      ),
    };
  }

  ngOnInit(): void {
    this.computeLayout();
  }

  ngOnChanges(): void {
    this.computeLayout();
  }

  ngAfterViewInit(): void {
    // Delay to ensure layout is complete before measuring
    setTimeout(() => {
      this.fitToContainer();
      this.scrollToCurrentNode();
    });
  }

  ngOnDestroy(): void {
    // HostListener handles cleanup automatically
  }

  @HostListener('window:resize')
  onResize(): void {
    this.fitToContainer();
  }

  /** Resize map width to fit container, capped at the default max. */
  private fitToContainer(): void {
    if (!this.mapContainer) return;
    const containerWidth = this.mapContainer.nativeElement.clientWidth;
    if (containerWidth > 0) {
      this.mapWidth = Math.min(containerWidth, NODE_MAP_LAYOUT.width);
      this.computeLayout();
    }
  }

  /**
   * Computes pixel positions for every node and builds SVG bezier paths.
   *
   * Visual coordinate system:
   * - Row 0 (start) is rendered at the TOP of the canvas (smallest y).
   * - Boss row is rendered at the BOTTOM (largest y).
   * - Within each row, nodes are evenly distributed horizontally.
   * - Player reads top-to-bottom and progresses downward.
   */
  computeLayout(): void {
    if (!this.nodeMap) return;

    const totalRows = this.nodeMap.rows; // includes boss row
    this.mapHeight = (totalRows - 1) * NODE_MAP_LAYOUT.rowSpacing + NODE_MAP_LAYOUT.paddingY + NODE_MAP_LAYOUT.nodeRadius + NODE_MAP_LAYOUT.paddingBottom;

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
      // Natural Y: row 0 at top, boss at bottom
      const y = NODE_MAP_LAYOUT.paddingY + row * NODE_MAP_LAYOUT.rowSpacing;

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

        // Anchor at bottom of source node and top of target node
        // (row 0 is at top, so connections flow downward)
        const x1 = from.x;
        const y1 = from.y + NODE_MAP_LAYOUT.nodeRadius;
        const x2 = to.x;
        const y2 = to.y - NODE_MAP_LAYOUT.nodeRadius;

        // Cubic bezier control points for a smooth S-curve
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY - BEZIER_CTRL_OFFSET}, ${x2} ${midY + BEZIER_CTRL_OFFSET}, ${x2} ${y2}`;

        const fromVisited = completedSet.has(edge.fromId);
        const toVisited = completedSet.has(edge.toId);
        const active = edge.fromId === this.currentNodeId && availableSet.has(edge.toId);

        return { d, active, visited: fromVisited && toVisited };
      });
  }

  /**
   * Scrolls the map container so the current node is visible.
   * Row 0 (start nodes) is at the top, so no scroll is needed at run start.
   * Only scrolls when the current node is below the visible fold.
   */
  scrollToCurrentNode(): void {
    if (!this.currentNodeId || !this.mapContainer) return;
    const pos = this.nodePositions.get(this.currentNodeId);
    if (!pos) return;

    const container = this.mapContainer.nativeElement;
    const containerHeight = container.clientHeight;
    const nodeBottom = pos.y + NODE_MAP_LAYOUT.nodeRadius;
    const visibleBottom = container.scrollTop + containerHeight;

    if (nodeBottom > visibleBottom) {
      // Node is below the fold — scroll to center it
      const scrollTarget = pos.y - containerHeight / 2;
      container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    }
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
