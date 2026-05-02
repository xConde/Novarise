/**
 * SVG path data for the 11 non-tower-card effect glyphs.
 *
 * Mirrors the structure of `keyword-icon-paths.ts` — these entries are the
 * authoritative spec for the fx-* glyphs rendered in `icon.component.html`.
 * The icon component inlines the same primitives in its template; this file
 * exists so a spec can verify the vocabulary is complete + structurally sound.
 *
 * Design language (shared with keyword + archetype icons):
 *   - viewBox: 0 0 24 24
 *   - strokeWidth: 1.5
 *   - stroke: currentColor (CSS context drives tint per card type)
 *   - fill: none (line icons; small filled accents allowed for impact dots)
 *   - stroke-linecap / stroke-linejoin: round (set globally by IconComponent)
 *
 * Card mapping lives in `CardDefinition.effectGlyph` (string or 2-tuple).
 * When a card's primary effect IS its keyword (terraform on Lay Tile, link
 * on Handshake), the keyword icon is reused as the hero glyph and the small
 * keyword badge is suppressed to avoid visual duplication.
 */

export interface EffectIconPath {
  readonly tag: 'path' | 'line' | 'polyline' | 'polygon' | 'circle' | 'rect' | 'ellipse';
  readonly attrs: Record<string, string>;
}

export interface EffectIconDef {
  readonly viewBox: string;
  readonly paths: readonly EffectIconPath[];
}

export const EFFECT_ICON_PATHS = {

  /**
   * damage — direct damage spell or damage modifier on a tower.
   *
   * Visual: filled center impact dot + 8-point asterisk burst (4 cardinal
   * spikes + 4 diagonal spikes radiating outward from center). Reads as
   * "explosion / impact burst from a single point" — clearer "strike"
   * silhouette than the prior 4-corner tick design which scanned as
   * disconnected marks at hero scale.
   */
  damage: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '2.5', fill: 'currentColor', stroke: 'none' } },
      { tag: 'line',   attrs: { x1: '12', y1: '4',  x2: '12', y2: '8'  } },
      { tag: 'line',   attrs: { x1: '12', y1: '16', x2: '12', y2: '20' } },
      { tag: 'line',   attrs: { x1: '4',  y1: '12', x2: '8',  y2: '12' } },
      { tag: 'line',   attrs: { x1: '16', y1: '12', x2: '20', y2: '12' } },
      { tag: 'line',   attrs: { x1: '5',  y1: '5',  x2: '8.5', y2: '8.5' } },
      { tag: 'line',   attrs: { x1: '19', y1: '5',  x2: '15.5', y2: '8.5' } },
      { tag: 'line',   attrs: { x1: '5',  y1: '19', x2: '8.5', y2: '15.5' } },
      { tag: 'line',   attrs: { x1: '19', y1: '19', x2: '15.5', y2: '15.5' } },
    ],
  } satisfies EffectIconDef,

  /**
   * burn — flame status / fire-based damage.
   *
   * Visual: stylized teardrop flame with an inner curl. The outer silhouette
   * carries the read; the inner curve adds depth at hero size.
   */
  burn: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'path', attrs: { d: 'M12 3 C 8 8, 6 12, 9 17 C 11 15, 13 15, 15 17 C 18 12, 16 8, 12 3 Z' } },
      { tag: 'path', attrs: { d: 'M12 9 C 11 11, 11 13, 12 14 C 13 13, 13 11, 12 9 Z' } },
    ],
  } satisfies EffectIconDef,

  /**
   * poison — toxic / poison status applied to enemies.
   *
   * Visual: water-drop teardrop. Universal "poison/toxic" iconography — the
   * pointed-top, rounded-bottom silhouette is unambiguous at any size.
   */
  poison: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'path', attrs: { d: 'M12 3 L 18 13 A 6 6 0 1 1 6 13 Z' } },
    ],
  } satisfies EffectIconDef,

  /**
   * slow — slow / freeze status / fog debuff.
   *
   * Visual: 6-arm snowflake. 3 lines through center + arrow chevrons at the
   * ends so the silhouette doesn't read as "compass rose" at small sizes.
   */
  slow: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'line', attrs: { x1: '12', y1: '3',  x2: '12', y2: '21' } },
      { tag: 'line', attrs: { x1: '4',  y1: '7',  x2: '20', y2: '17' } },
      { tag: 'line', attrs: { x1: '4',  y1: '17', x2: '20', y2: '7'  } },
      { tag: 'polyline', attrs: { points: '9,5 12,3 15,5' } },
      { tag: 'polyline', attrs: { points: '9,19 12,21 15,19' } },
    ],
  } satisfies EffectIconDef,

  /**
   * heal — restore lives / shield / repair walls.
   *
   * Visual: shield silhouette with a plus cross inside. The shield reads as
   * "defense"; the plus reads as "restore." The combination disambiguates
   * from buff/damage glyphs.
   */
  heal: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'path', attrs: { d: 'M12 3 L 4 6 L 4 12 C 4 17, 8 20, 12 21 C 16 20, 20 17, 20 12 L 20 6 Z' } },
      { tag: 'line', attrs: { x1: '12', y1: '9',  x2: '12', y2: '15' } },
      { tag: 'line', attrs: { x1: '9',  y1: '12', x2: '15', y2: '12' } },
    ],
  } satisfies EffectIconDef,

  /**
   * gold — coin spells / gold-from-kills modifiers.
   *
   * Visual: 3 stacked horizontal ellipses (coins seen edge-on). Distinct
   * from the existing 'coin' icon (single circle with $ glyph) so the two
   * never collide visually in adjacent surfaces.
   */
  gold: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'ellipse', attrs: { cx: '12', cy: '7',  rx: '7', ry: '2.5' } },
      { tag: 'ellipse', attrs: { cx: '12', cy: '12', rx: '7', ry: '2.5' } },
      { tag: 'ellipse', attrs: { cx: '12', cy: '17', rx: '7', ry: '2.5' } },
    ],
  } satisfies EffectIconDef,

  /**
   * draw — card-draw utility (Quick Draw, Emergency Orders, Opening Gambit).
   *
   * Visual: card rectangle with a downward arrow above it, pointing IN.
   * Reads as "card coming into hand."
   */
  draw: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'rect', attrs: { x: '6', y: '11', width: '12', height: '10', rx: '1.5' } },
      { tag: 'line', attrs: { x1: '12', y1: '3', x2: '12', y2: '9' } },
      { tag: 'polyline', attrs: { points: '9,6 12,9 15,6' } },
    ],
  } satisfies EffectIconDef,

  /**
   * energy — energy gain / cost-reduction utilities (Energy Surge, Stockpile).
   *
   * Visual: vertical battery capsule with a bolt zigzag inside. The capsule
   * outline differentiates from the existing 'bolt' (raw lightning) and the
   * type-corner spell-bolt chip.
   */
  energy: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'rect', attrs: { x: '7', y: '5', width: '10', height: '15', rx: '2' } },
      { tag: 'line', attrs: { x1: '10', y1: '3', x2: '14', y2: '3' } },
      { tag: 'polyline', attrs: { points: '13,8 10,13 14,13 11,18' } },
    ],
  } satisfies EffectIconDef,

  /**
   * buff — generic boost (damage / range / fire-rate / upgrade modifiers).
   *
   * Visual: double chevron pointing up over a horizontal baseline. Reads as
   * "raise / boost / level up." Composes with other glyphs (e.g., gold+buff
   * for Bounty Orders, energy+buff for Overload).
   */
  buff: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'polyline', attrs: { points: '5,11 12,4 19,11' } },
      { tag: 'polyline', attrs: { points: '5,17 12,10 19,17' } },
      { tag: 'line',     attrs: { x1: '5', y1: '21', x2: '19', y2: '21' } },
    ],
  } satisfies EffectIconDef,

  /**
   * scout — wave-preview / reveal spells (Scout Ahead, Scout Elite).
   *
   * Visual: stylized eye (almond outline + circular pupil). Reads as
   * "see / reveal" — the universal "view" iconography.
   */
  scout: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'path',   attrs: { d: 'M2 12 C 5 7, 9 5, 12 5 C 15 5, 19 7, 22 12 C 19 17, 15 19, 12 19 C 9 19, 5 17, 2 12 Z' } },
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' } },
    ],
  } satisfies EffectIconDef,

  /**
   * recycle — return-to-hand / salvage utilities (Recycle, Salvage).
   *
   * Visual: two curved arrows forming a closed loop (clockwise). Reads as
   * "circulate back" — the universal recycling iconography, simplified.
   */
  recycle: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'path',     attrs: { d: 'M5 9 A 8 8 0 0 1 19 9' } },
      { tag: 'polyline', attrs: { points: '15,5 19,9 15,11' } },
      { tag: 'path',     attrs: { d: 'M19 15 A 8 8 0 0 1 5 15' } },
      { tag: 'polyline', attrs: { points: '9,19 5,15 9,13' } },
    ],
  } satisfies EffectIconDef,

  /**
   * link — Conduit-archetype hero glyph (link modifiers + Conduit Bridge).
   *
   * Visual: central hub node with 4 cardinal satellite nodes connected by
   * short stroke segments. Reads as "tower with 4 neighbors" — directly
   * matches the link archetype's adjacency mechanic.
   *
   * Distinct from `kw-link` (2-node dumbbell, designed for 14px keyword
   * badges) and `arch-conduit` (3-node triangle archetype glyph). Both
   * `kw-link` (badges) and `fx-link` (hero) coexist: the keyword icon stays
   * tight at small scale, the hero icon fills the 64px art zone.
   */
  link: {
    viewBox: '0 0 24 24',
    paths: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3', fill: 'currentColor', stroke: 'none' } },
      { tag: 'circle', attrs: { cx: '12', cy: '4',  r: '2', fill: 'currentColor', stroke: 'none' } },
      { tag: 'circle', attrs: { cx: '12', cy: '20', r: '2', fill: 'currentColor', stroke: 'none' } },
      { tag: 'circle', attrs: { cx: '4',  cy: '12', r: '2', fill: 'currentColor', stroke: 'none' } },
      { tag: 'circle', attrs: { cx: '20', cy: '12', r: '2', fill: 'currentColor', stroke: 'none' } },
      { tag: 'line',   attrs: { x1: '12', y1: '9',  x2: '12', y2: '6'  } },
      { tag: 'line',   attrs: { x1: '12', y1: '15', x2: '12', y2: '18' } },
      { tag: 'line',   attrs: { x1: '9',  y1: '12', x2: '6',  y2: '12' } },
      { tag: 'line',   attrs: { x1: '15', y1: '12', x2: '18', y2: '12' } },
    ],
  } satisfies EffectIconDef,

} as const;

export type EffectIconName = keyof typeof EFFECT_ICON_PATHS;
