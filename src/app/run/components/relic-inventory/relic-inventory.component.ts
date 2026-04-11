import { Component, Input, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { RelicDefinition, RelicRarity } from '../../models/relic.model';

/** Viewport margin so tooltips never clip off-screen edges (px). */
const TOOLTIP_VIEWPORT_MARGIN = 8;
/** Tooltip offset above/below the cursor (px). */
const TOOLTIP_Y_OFFSET = 12;
/** Maximum tooltip width matches the CSS max-width (px). */
const TOOLTIP_MAX_WIDTH = 240;
/**
 * Approximate tooltip height used when flipping below the cursor near the top of the viewport (px).
 * Allows the tooltip to clear the cursor when it must render below instead of above.
 */
const TOOLTIP_FLIP_CLEARANCE = 24;

@Component({
  selector: 'app-relic-inventory',
  templateUrl: './relic-inventory.component.html',
  styleUrls: ['./relic-inventory.component.scss'],
})
export class RelicInventoryComponent implements OnInit, OnDestroy {
  @Input() relics: RelicDefinition[] = [];

  hoveredRelic: RelicDefinition | null = null;
  tooltipX = 0;
  tooltipY = 0;

  private scrollUnlisten: (() => void) | null = null;

  constructor(private renderer: Renderer2) {}

  ngOnInit(): void {
    this.scrollUnlisten = this.renderer.listen('window', 'scroll', () => {
      this.hoveredRelic = null;
    });
  }

  ngOnDestroy(): void {
    if (this.scrollUnlisten) {
      this.scrollUnlisten();
      this.scrollUnlisten = null;
    }
  }

  /** CSS class suffix based on rarity. */
  getRarityClass(rarity: RelicRarity): string {
    return `relic--${rarity}`;
  }

  /** Background color for a relic badge (inline style — replaced by CSS vars in restyle). */
  getBadgeBg(rarity: RelicRarity): string {
    switch (rarity) {
      case RelicRarity.COMMON: return 'rgba(170, 170, 170, 0.2)';
      case RelicRarity.UNCOMMON: return 'rgba(52, 152, 219, 0.25)';
      case RelicRarity.RARE: return 'rgba(241, 196, 15, 0.25)';
    }
  }

  /** Border color for a relic badge (inline style — replaced by CSS vars in restyle). */
  getBadgeBorder(rarity: RelicRarity): string {
    switch (rarity) {
      case RelicRarity.COMMON: return '#aaaaaa';
      case RelicRarity.UNCOMMON: return '#3498db';
      case RelicRarity.RARE: return '#f1c40f';
    }
  }

  showTooltip(relic: RelicDefinition, event: MouseEvent | FocusEvent): void {
    this.hoveredRelic = relic;
    if (event instanceof MouseEvent) {
      this.updateTooltipPosition(event.clientX, event.clientY);
    } else {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      this.updateTooltipPosition(rect.left + rect.width / 2, rect.top);
    }
  }

  hideTooltip(): void {
    this.hoveredRelic = null;
  }

  private updateTooltipPosition(clientX: number, clientY: number): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = clientX - TOOLTIP_MAX_WIDTH / 2;
    let y = clientY - TOOLTIP_Y_OFFSET;

    // Clamp horizontally
    x = Math.max(TOOLTIP_VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_MAX_WIDTH - TOOLTIP_VIEWPORT_MARGIN));
    // Clamp vertically (flip below cursor if near top)
    if (y < TOOLTIP_VIEWPORT_MARGIN) {
      y = clientY + TOOLTIP_Y_OFFSET + TOOLTIP_FLIP_CLEARANCE;
    }
    y = Math.min(y, vh - TOOLTIP_VIEWPORT_MARGIN);

    this.tooltipX = x;
    this.tooltipY = y;
  }
}
