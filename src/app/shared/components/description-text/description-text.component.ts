import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-registry';

/** Keyword names recognized by the inline-icon parser. */
export type KeywordIconName = 'terraform' | 'link' | 'exhaust' | 'retain' | 'innate' | 'ethereal';

const VALID_KEYWORDS = new Set<KeywordIconName>([
  'terraform', 'link', 'exhaust', 'retain', 'innate', 'ethereal',
]);

/** A plain text run between (or surrounding) keyword tokens. */
export interface TextSegment { type: 'text'; value: string; }
/** A recognized keyword icon token — renders as an inline icon. */
export interface IconSegment { type: 'icon'; name: KeywordIconName; label: string; }
export type DescriptionSegment = TextSegment | IconSegment;

/** Regex for `{kw-<name>}` tokens. */
const TOKEN_RE = /\{kw-([a-z]+)\}/g;

/**
 * Parses a card description string into an ordered array of text and icon
 * segments. Unknown `{kw-*}` tokens are passed through as plain text so a
 * typo never silently eats content.
 *
 * Performance: linear scan via String.split on the token regex — <1ms for
 * any realistic card description (<200 chars).
 */
export function parseDescription(description: string): DescriptionSegment[] {
  if (!description) return [];

  const segments: DescriptionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(description)) !== null) {
    const before = description.slice(lastIndex, match.index);
    if (before) segments.push({ type: 'text', value: before });

    const kwName = match[1] as KeywordIconName;
    if (VALID_KEYWORDS.has(kwName)) {
      const label = kwName.charAt(0).toUpperCase() + kwName.slice(1);
      segments.push({ type: 'icon', name: kwName, label });
    } else {
      // Unknown keyword — pass through as literal text (graceful degradation).
      segments.push({ type: 'text', value: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  const tail = description.slice(lastIndex);
  if (tail) segments.push({ type: 'text', value: tail });

  return segments;
}

/**
 * DescriptionTextComponent — renders a card description string with inline
 * keyword icons for recognized `{kw-<name>}` tokens.
 *
 * Strings without tokens pass through as plain text (no-op). The component
 * is standalone so it can be imported directly into any NgModule or
 * standalone component without a shared barrel.
 */
@Component({
  selector: 'app-description-text',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './description-text.component.html',
  styleUrls: ['./description-text.component.scss'],
})
export class DescriptionTextComponent implements OnChanges {
  @Input() description = '';
  @Input() iconSize = 14;

  segments: DescriptionSegment[] = [];

  ngOnChanges(): void {
    this.segments = parseDescription(this.description);
  }

  isIcon(seg: DescriptionSegment): seg is IconSegment {
    return seg.type === 'icon';
  }

  /** Returns the text value for a text segment; empty string for icon segments (never called for icons). */
  textValue(seg: DescriptionSegment): string {
    return seg.type === 'text' ? seg.value : '';
  }

  /** Returns the IconName for an icon segment (e.g. 'kw-terraform'). */
  iconName(seg: IconSegment): IconName {
    return `kw-${seg.name}` as IconName;
  }
}
