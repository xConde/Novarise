/**
 * SVG path data for the 6 card keyword icons.
 *
 * Each entry describes one keyword icon as a list of SVG element descriptors.
 * The consuming template iterates `paths` and renders each element using its
 * `tag` and `attrs`.
 *
 * Design language (shared across all 6):
 *   - viewBox: 0 0 24 24
 *   - strokeWidth: 1.5 (thin — these render at 12-16 px in card-hand badges)
 *   - stroke: currentColor (inherits from CSS context — rarity tint, state, etc.)
 *   - fill: none (line icons only; small filled circles used as node accents)
 *   - stroke-linecap / stroke-linejoin: round (set globally by IconComponent)
 *   - Visual weight centered in the 4-20 coordinate band
 *
 * Imported by icon-registry.ts in S35.
 */

export interface KeywordIconPath {
  readonly tag: 'path' | 'line' | 'polyline' | 'polygon' | 'circle' | 'rect' | 'ellipse';
  readonly attrs: Record<string, string>;
}

export interface KeywordIconDef {
  readonly viewBox: string;
  readonly paths: readonly KeywordIconPath[];
}

export const KEYWORD_ICON_PATHS = {

  /**
   * terraform — card mutates a tile (lay/block/raise/lower terrain).
   *
   * Visual: mountain peak (triangle outline) with a small upward-right arrow
   * indicating the morph/change. The peak reads "terrain"; the arrow reads
   * "change". Two elements.
   *
   * Legibility at 12 px: YES. Triangle peak + directional arrow are the two
   * most legible stroked primitives at small size. The peak sits in the lower
   * two-thirds; the arrow anchors top-right.
   */
  terraform: {
    viewBox: '0 0 24 24',
    paths: [
      {
        tag: 'polyline',
        attrs: { points: '4,19 12,7 20,19' },
      },
      {
        tag: 'polyline',
        attrs: { points: '15,9 18,6 21,9' },
      },
      {
        tag: 'line',
        attrs: { x1: '18', y1: '6', x2: '18', y2: '12' },
      },
    ],
  } satisfies KeywordIconDef,

  /**
   * link — towers form connected networks.
   *
   * Visual: two filled node circles connected by a straight line — the
   * universal "graph edge" metaphor. Three elements: line + 2 circles.
   *
   * Legibility at 12 px: YES. Two dots with a connecting stroke is the
   * smallest readable network metaphor. Filled circles ensure the dots don't
   * disappear at 12 px (open circles lose their shape below ~16 px).
   */
  link: {
    viewBox: '0 0 24 24',
    paths: [
      {
        tag: 'line',
        attrs: { x1: '7', y1: '12', x2: '17', y2: '12' },
      },
      {
        tag: 'circle',
        attrs: { cx: '6', cy: '12', r: '3', fill: 'currentColor', stroke: 'none' },
      },
      {
        tag: 'circle',
        attrs: { cx: '18', cy: '12', r: '3', fill: 'currentColor', stroke: 'none' },
      },
    ],
  } satisfies KeywordIconDef,

  /**
   * exhaust — card permanently removed from the deck after use.
   *
   * Visual: card rectangle with an X strike-through — "this card is spent."
   * Two elements: rect outline (card silhouette) + the X (two crossed lines).
   * Note: the existing 'exhaust' icon in ICON_REGISTRY is a flame for the
   * exhaust pile. This keyword icon uses the struck-card metaphor instead to
   * distinguish "pile" from "keyword."
   *
   * Legibility at 12 px: YES. Rect + X is the conventional UI pattern for
   * "deleted item" — universally understood.
   */
  exhaust: {
    viewBox: '0 0 24 24',
    paths: [
      {
        tag: 'rect',
        attrs: { x: '5', y: '4', width: '14', height: '16', rx: '2' },
      },
      {
        tag: 'line',
        attrs: { x1: '9', y1: '9', x2: '15', y2: '15' },
      },
      {
        tag: 'line',
        attrs: { x1: '15', y1: '9', x2: '9', y2: '15' },
      },
    ],
  } satisfies KeywordIconDef,

  /**
   * retain — card stays in hand at end of turn instead of discarding.
   *
   * Visual: card rectangle with a small closed padlock overlaid at the center
   * — "locked in hand." Two elements: card rect + padlock (arch + body).
   * The padlock arch is a polyline; the body is a small rect.
   *
   * Legibility at 12 px: MARGINAL. The padlock body (4×3 rect) and arch are
   * at the edge of visibility. However, the combined silhouette (card + lock
   * bump) is still distinctive from the exhaust icon. If the arch collapses,
   * the body rect alone reads as a "pin" which still conveys "held."
   * Acceptable risk given tooltip support in S37.
   */
  retain: {
    viewBox: '0 0 24 24',
    paths: [
      {
        tag: 'rect',
        attrs: { x: '5', y: '4', width: '14', height: '16', rx: '2' },
      },
      {
        tag: 'path',
        attrs: { d: 'M9.5 11 C9.5 8.5 14.5 8.5 14.5 11' },
      },
      {
        tag: 'rect',
        attrs: { x: '8.5', y: '11', width: '7', height: '4', rx: '1' },
      },
    ],
  } satisfies KeywordIconDef,

  /**
   * innate — card is guaranteed in the opening hand.
   *
   * Visual: five-point star — universally reads as "special," "guaranteed,"
   * "built-in." One element. The star is centered in the viewBox.
   *
   * Legibility at 12 px: YES. A star is the most recognizable single-element
   * icon at small sizes. The 5-point polygon is legible down to ~8 px.
   */
  innate: {
    viewBox: '0 0 24 24',
    paths: [
      {
        tag: 'polygon',
        attrs: { points: '12,3 14.6,9 21,9.5 16.2,13.8 17.8,20 12,16.5 6.2,20 7.8,13.8 3,9.5 9.4,9' },
      },
    ],
  } satisfies KeywordIconDef,

  /**
   * ethereal — card is exhausted if not played by end of turn.
   *
   * Visual: three short rising curved lines (ascending vapor/smoke), staggered
   * horizontally — the conventional "steam/vapor" glyph. Three elements.
   *
   * Legibility at 12 px: WEAK. At 12 px the three arcs compress into vertical
   * smears. The staggered heights (short-tall-short) preserve some distinction
   * from a plain triple-line pattern, but the vapor reading requires mental
   * mapping. Tooltip support (S37) is the true legibility fix. If the
   * rendering is indistinguishable from noise at 12 px in the browser smoke
   * test, fall back to a letter-glyph 'E' inside a circle for this one icon
   * only — see fallback note below.
   *
   * Fallback (if vapor fails): single 'E' inside circle — add a
   * <circle cx="12" cy="12" r="9"/> + <text> element or replace with a dashed
   * card-rect (card silhouette with stroke-dasharray="3 2").
   */
  ethereal: {
    viewBox: '0 0 24 24',
    paths: [
      {
        tag: 'path',
        attrs: { d: 'M9,18 C9,15 11,15 11,12 C11,9 9,9 9,6' },
      },
      {
        tag: 'path',
        attrs: { d: 'M12,19 C12,16 14,16 14,13 C14,10 12,10 12,7' },
      },
      {
        tag: 'path',
        attrs: { d: 'M15,18 C15,15 17,15 17,12 C17,9 15,9 15,6' },
      },
    ],
  } satisfies KeywordIconDef,

} as const;

export type KeywordIconName = keyof typeof KEYWORD_ICON_PATHS;
