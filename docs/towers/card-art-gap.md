# Card-Art Alignment — Phase H Investigation

## Where tower card icons are rendered

File: `src/app/game/game-board/components/card-hand/card-hand.component.html`

```html
<span class="card__type-icon" aria-hidden="true">
  <app-icon *ngIf="card.definition.type === CardType.TOWER" name="crosshair" [size]="20"></app-icon>
  <app-icon *ngIf="card.definition.type === CardType.SPELL"    name="bolt"       [size]="20"></app-icon>
  <app-icon *ngIf="card.definition.type === CardType.MODIFIER" name="shield"     [size]="20"></app-icon>
  <app-icon *ngIf="card.definition.type === CardType.UTILITY"  name="gear"       [size]="20"></app-icon>
</span>
```

The icon shown for a TOWER card is a **crosshair SVG**, regardless of which
tower type the card places. There are no per-tower-type icons — the card system
uses a card-type icon (crosshair / bolt / shield / gear), not a tower-type icon.

Icon source: `src/app/shared/components/icon/icon-registry.ts`
Icon component: `src/app/shared/components/icon/icon.component.ts`

## Does the redesign break the card-art contract?

**No.** The tower card icon is an abstract "crosshair" representing the card TYPE
(TOWER card = place something), not the specific tower silhouette. Cards are
differentiated by:

- Card name in the card title area
- Per-type accent color via `--card-tower-accent` CSS variable
- Description text

None of these reference the tower geometry that was redesigned in Phases B–G.

## Verdict

**No card-art update required.** The icon vocabulary is deliberately abstract
(crosshair = place a tower), not silhouette-specific. The redesign makes the
placed towers more distinctive, which strengthens the card-art contract: once
placed, the tower looks like something worth having, not a bland cone.

## Potential future improvement (not in scope for this PR)

If the design ever wants per-tower-type icons on cards (e.g., a small rifle
silhouette for BASIC, a coil silhouette for CHAIN), that requires:
1. New SVG paths in `icon-registry.ts` per `TowerType`
2. Update `card-hand.component.html` to resolve icon by `card.definition.towerType`
3. Art review pass to ensure the 20×20 px icon reads the new silhouettes clearly

This is a separate art-pass sprint, not tower-polish scope.
