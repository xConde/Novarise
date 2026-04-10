import { Component, Input, HostListener } from '@angular/core';
import { RelicDefinition, RelicRarity } from '../../models/relic.model';

/** Color per rarity for badge backgrounds. */
const RARITY_COLOR: Record<RelicRarity, string> = {
  [RelicRarity.COMMON]: 'rgba(170, 170, 170, 0.2)',
  [RelicRarity.UNCOMMON]: 'rgba(52, 152, 219, 0.25)',
  [RelicRarity.RARE]: 'rgba(241, 196, 15, 0.25)',
};

/** Border/glow color per rarity. */
const RARITY_BORDER: Record<RelicRarity, string> = {
  [RelicRarity.COMMON]: '#aaaaaa',
  [RelicRarity.UNCOMMON]: '#3498db',
  [RelicRarity.RARE]: '#f1c40f',
};

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
export class RelicInventoryComponent {
  @Input() relics: RelicDefinition[] = [];

  hoveredRelic: RelicDefinition | null = null;
  tooltipX = 0;
  tooltipY = 0;

  /** CSS class suffix based on rarity. */
  getRarityClass(rarity: RelicRarity): string {
    return `relic--${rarity}`;
  }

  /** Background color for a relic badge. */
  getBadgeBg(rarity: RelicRarity): string {
    return RARITY_COLOR[rarity] ?? RARITY_COLOR[RelicRarity.COMMON];
  }

  /** Border color for a relic badge. */
  getBadgeBorder(rarity: RelicRarity): string {
    return RARITY_BORDER[rarity] ?? RARITY_BORDER[RelicRarity.COMMON];
  }

  showTooltip(relic: RelicDefinition, event: MouseEvent): void {
    this.hoveredRelic = relic;
    this.updateTooltipPosition(event.clientX, event.clientY);
  }

  hideTooltip(): void {
    this.hoveredRelic = null;
  }

  @HostListener('window:scroll')
  onScroll(): void {
    // Hide tooltip on scroll to avoid stale positions
    this.hoveredRelic = null;
  }

  private updateTooltipPosition(clientX: number, clientY: number): void {
    // Position tooltip above the cursor, clamped within the viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = clientX - TOOLTIP_MAX_WIDTH / 2;
    let y = clientY - TOOLTIP_Y_OFFSET;

    // Clamp horizontally
    x = Math.max(TOOLTIP_VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_MAX_WIDTH - TOOLTIP_VIEWPORT_MARGIN));
    // Clamp vertically (flip below cursor if near top)
    if (y < TOOLTIP_VIEWPORT_MARGIN) {
      y = clientY + TOOLTIP_Y_OFFSET + TOOLTIP_FLIP_CLEARANCE; // below cursor
    }
    y = Math.min(y, vh - TOOLTIP_VIEWPORT_MARGIN);

    this.tooltipX = x;
    this.tooltipY = y;
  }
}
