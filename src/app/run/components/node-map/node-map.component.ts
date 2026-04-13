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
  /** Bottom padding below last node's edge (accounts for boss being larger than nodeRadius). */
  paddingBottom: 16,
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

  /** Inline SVG icon per node type (18×18 display, 24×24 viewBox). Pre-sanitized as SafeHtml. */
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
    const FILLED = 'xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"';
    const STROKE = 'xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

    this.nodeIcons = {
      // Crossed swords — two bold diagonal bars forming an X
      [NodeType.COMBAT]: s(
        '<svg ' + FILLED + '>' +
        '<rect x="3" y="10.5" width="18" height="3" rx="1" transform="rotate(45 12 12)"/>' +
        '<rect x="3" y="10.5" width="18" height="3" rx="1" transform="rotate(-45 12 12)"/>' +
        '</svg>',
      ),
      // Five-point star — elite/special encounter
      [NodeType.ELITE]: s(
        '<svg ' + FILLED + '>' +
        '<polygon points="12,2 14.6,8.4 21.5,8.9 16.3,13.4 17.9,20.1 12,16.5 6.1,20.1 7.7,13.4 2.5,8.9 9.4,8.4"/>' +
        '</svg>',
      ),
      // OSRS-style skull + crossbones — boss encounter (larger to match 56px boss node)
      // Skull sits high (y=1-18), crossbones cross low behind jaw (y=17), tips peek at sides
      [NodeType.BOSS]: s(
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<rect x="1" y="15.5" width="22" height="3" rx="1.5" transform="rotate(45 12 17)"/>' +
        '<rect x="1" y="15.5" width="22" height="3" rx="1.5" transform="rotate(-45 12 17)"/>' +
        '<path d="M12 1C17 1 19 4 19 8C19 12 17 14 15 14L15 18L9 18L9 14C7 14 5 12 5 8C5 4 7 1 12 1Z"/>' +
        '<rect x="6.5" y="4.5" width="4" height="4.5" rx="0.5" fill="#200808"/>' +
        '<rect x="13.5" y="4.5" width="4" height="4.5" rx="0.5" fill="#200808"/>' +
        '<polygon points="11,10.5 13,10.5 12,12.5" fill="#200808"/>' +
        '</svg>',
      ),
      // Campfire flame — rest site
      [NodeType.REST]: s(
        '<svg ' + FILLED + '>' +
        '<path d="M12 2C9 7 5 11 5 15.5C5 19.1 8.1 22 12 22C15.9 22 19 19.1 19 15.5C19 11 15 7 12 2Z"/>' +
        '</svg>',
      ),
      // Bold dollar sign — shop (no containing circle)
      [NodeType.SHOP]: s(
        '<svg ' + STROKE + ' stroke-width="2.5">' +
        '<line x1="12" y1="2" x2="12" y2="22"/>' +
        '<path d="M16.5 8C16 5.5 14.5 4.5 12 4.5C9.5 4.5 7.5 6 7.5 8C7.5 10.5 9.5 11 12 12C14.5 13 16.5 13.5 16.5 16C16.5 18.5 14.5 19.5 12 19.5C9.5 19.5 8 18.5 7.5 16"/>' +
        '</svg>',
      ),
      // Bold exclamation mark — event (no containing circle)
      [NodeType.EVENT]: s(
        '<svg ' + STROKE + ' stroke-width="3">' +
        '<line x1="12" y1="4" x2="12" y2="14"/>' +
        '<line x1="12" y1="19" x2="12.01" y2="19"/>' +
        '</svg>',
      ),
      // Bold question mark — unknown node (no containing circle)
      [NodeType.UNKNOWN]: s(
        '<svg ' + STROKE + ' stroke-width="3">' +
        '<path d="M8 8C8 5 9.5 3.5 12 3.5C14.5 3.5 16 5 16 7.5C16 10 14 11 12 13V15.5"/>' +
        '<line x1="12" y1="20" x2="12.01" y2="20"/>' +
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
