# Angular Upgrade Plan: 15 → 17

> Audit date: 2026-04-05 | Current: Angular 15.2, TypeScript 4.9.5, zone.js 0.13, RxJS 7.8

---

## Current State Summary

| Item | Count / Value |
|---|---|
| NgModules | 9 total (AppModule, AppRoutingModule, GameModule, EditorModule, CampaignModule, LandingModule, ProfileModule, MapSelectModule, MobileControlsModule) |
| Components | 15 |
| Services | 56 |
| `providedIn: 'root'` services | 13 |
| Module-scoped services (EditorModule) | 8 |
| Component-scoped services (GameBoardComponent) | 28 |
| Standalone components | 0 (none exist yet) |
| Guards | 2 — already functional (`CanActivateFn`, `CanDeactivateFn`) |
| `ViewEncapsulation.None` components | 4 (GameHud, GameSetupPanel, TowerInfoPanel, GameResultsOverlay) |
| `*ngIf` usages | 123 |
| `*ngFor` usages | 36 |
| `*ngSwitch` usages | 0 |
| Manual `Subscription` fields | 6 (all in GameBoardComponent + NovariseComponent + VirtualJoystick) |
| `async` pipe usages | 0 |
| Builder | `@angular-devkit/build-angular:browser` (legacy webpack) |

---

## Phase 1: Angular 15 → 16

**Risk: LOW** — mostly additive. No breaking changes that affect this codebase.

### Required: TypeScript 4.9 → 5.0+

Angular 16 requires TypeScript ≥ 5.0.

**Change in `package.json`:**
```
"typescript": "~5.0.4"   // was: "4.9.5"
```

**TypeScript 5.0 strict-mode impact to check:**

1. `useDefineForClassFields: false` in `tsconfig.json` — keep this. Angular decorators
   (`@Component`, `@Injectable`) depend on legacy class field semantics. Removing this breaks
   dependency injection. Angular 17 handles it differently; leave it until then.

2. `experimentalDecorators: true` — keep this through Angular 16. Angular 17 can use the TC39
   decorator standard but migration is optional and non-trivial.

3. `downlevelIteration: true` — can be removed once you confirm `target: "ES2022"` is the
   floor for all supported browsers. With ES2022 target, native iterators are used. Leave it
   for now as low-risk dead config.

**Action:** Run `npm test` after TypeScript bump; watch for strict inference tightening around
generics. The codebase already uses `strict: true` so new errors are unlikely but possible in
service constructors or component templates.

---

### New Angular 16 APIs (Optional but Recommended)

#### `DestroyRef` + `takeUntilDestroyed` for subscription cleanup

Angular 16 introduces `DestroyRef` as a first-class way to handle cleanup.

**Current pattern (GameBoardComponent, NovariseComponent, VirtualJoystickComponent):**
```typescript
private stateSubscription: Subscription | null = null;

ngOnInit() {
  this.stateSubscription = this.stateService.state$.subscribe(...);
}

ngOnDestroy() {
  this.stateSubscription?.unsubscribe();
}
```

**Angular 16+ pattern:**
```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

// In constructor or field initializer:
private destroyRef = inject(DestroyRef);

ngOnInit() {
  this.stateService.state$
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(...);
}
// ngOnDestroy not needed for subscriptions
```

**Files to update (6 total):**
- `src/app/game/game-board/game-board.component.ts` — 4 Subscription fields
- `src/app/games/novarise/novarise.component.ts` — 1 Subscription field
- `src/app/games/novarise/features/mobile-controls/components/virtual-joystick/virtual-joystick.component.ts` — 1 Subscription field
- `src/app/game/game-board/components/game-hud/game-hud.component.ts` — check for subscriptions
- `src/app/game/game-board/components/game-results-overlay/game-results-overlay.component.ts` — check for subscriptions

**Note:** Components that have `ngOnDestroy` for Three.js cleanup must keep `ngOnDestroy`. The
subscription cleanup is additive — replace the Subscription field pattern but keep the method.

**Risk: LOW** — purely additive. Old pattern continues to work.

---

#### Guards: Already Compliant

Both guards already use the functional form introduced in Angular 14.2:
- `gameGuard: CanActivateFn` (uses `inject()`)
- `gameLeaveGuard: CanDeactivateFn<GameBoardComponent>`

No changes needed.

---

#### Signals (Optional, Angular 16+)

Angular 16 introduces `signal()`, `computed()`, and `effect()` as an opt-in reactive primitive.
They are NOT zone-aware by default — mutations inside signals do not trigger zone-based change
detection unless you call `markForCheck()` or use `ChangeDetectionStrategy.OnPush`.

**This codebase uses BehaviorSubject throughout.** Signals are a future direction, not a
required migration step. Introducing them now while still on zone.js / `Default` change
detection would create two competing reactivity systems with no benefit.

**Decision: Skip signals migration for now.** Revisit when migrating to zoneless (Angular 18+).

---

### Angular 16 Breaking Changes to Verify

| Change | Impact on This Codebase |
|---|---|
| `RouterModule` default title strategy changed | Not affected — no route titles configured |
| `ReflectiveInjector` removed | Not affected — not used anywhere |
| Karma deprecated (still works in 16) | Tests continue to pass; plan Jest migration separately |
| `ngcc` (Ivy compatibility compiler) removed | Not affected — already on Ivy |
| `BrowserModule.withServerTransition()` removed | Not affected — no SSR |

---

## Phase 2: Angular 16 → 17

**Risk: MEDIUM** — new control flow syntax migration is mechanical but touches all templates.
Builder migration is required.

### Required: Builder Migration

Angular 17 deprecates `@angular-devkit/build-angular:browser` in favor of the esbuild-based
`application` builder.

**`angular.json` change (build architect):**
```json
"builder": "@angular-devkit/build-angular:application"
```

The new builder does not support all legacy options. Check for:
- `buildOptimizer` — removed (esbuild handles this automatically, remove the key)
- `vendorChunk`, `commonChunk` — removed
- `aot: true` — default now, remove if present

**Gotcha for this project:** GameBoardComponent has 28 component-level providers. The
`application` builder tree-shakes more aggressively. Verify the providers array is fully
expressed at build time (it is — all imports are static).

**Risk: MEDIUM** — build output changes. Run `npm run build && npm test` and compare bundle
sizes. Esbuild is typically 2-5× faster and produces smaller bundles.

---

### New Control Flow Syntax (`@if`, `@for`, `@switch`)

Angular 17 ships a built-in control flow that replaces `*ngIf`, `*ngFor`, and `*ngSwitch`.
The old structural directives continue to work in 17; this is an optional migration.

**Scope:** 159 structural directive usages across 15 component templates.

**Migration tool (automated, non-destructive):**
```bash
npx ng generate @angular/core:control-flow
```

This is a schematic that rewrites templates in place. Run it per module, review diffs before
committing.

**Before (Angular 15 style):**
```html
<div *ngIf="isVisible">...</div>
<li *ngFor="let item of items; trackBy: trackById">...</li>
```

**After (Angular 17 style):**
```html
@if (isVisible) {
  <div>...</div>
}
@for (item of items; track item.id) {
  <li>...</li>
}
```

**Important:** `@for` requires a `track` expression — no optional like `trackBy`. The schematic
adds `track $index` as the default, which is safe but not optimal. After migration, manually
audit `*ngFor` loops over enemy arrays, tower arrays, and wave definitions and provide a
meaningful track key (e.g., `track tower.id`).

**ViewEncapsulation.None warning:** The 4 child components (GameHud, GameSetupPanel,
TowerInfoPanel, GameResultsOverlay) use `ViewEncapsulation.None`. Control flow migration does
not affect encapsulation, but verify styles still apply correctly after the template rewrite
since the schematic modifies indentation.

**Risk: LOW once automated.** Manual review needed for `track` expressions.

---

### `@defer` Blocks

Angular 17's `@defer` enables lazy loading of template sections. This is relevant for:
- The encyclopedia panel (large, not shown on load)
- The wave preview badges
- The campaign map list

This is **optional** and orthogonal to the upgrade itself. Skip for the initial migration.

---

### Standalone Components Migration

Angular 17 makes standalone the default for newly generated components. Existing module-based
components are not broken.

**Recommended approach: incremental, leaf-first.**

Do not attempt to convert all 9 modules at once. Start with leaf modules that have no
downstream consumers.

#### Migration Priority Order

| Module | Declarations | Providers | Complexity | Recommended Order |
|---|---|---|---|---|
| `LandingModule` | `LandingComponent` | none | Trivial | 1st |
| `ProfileModule` | `ProfileComponent` | none | Trivial | 2nd |
| `CampaignModule` | `CampaignComponent` | none | Trivial | 3rd |
| `MapSelectModule` | `MapSelectComponent` | none | Low | 4th |
| `MobileControlsModule` | `VirtualJoystickComponent` | `TouchDetectionService` | Low (has exports) | 5th |
| `EditorModule` | `NovariseComponent`, `EditControlsComponent` | 8 services | Medium | 6th |
| `GameModule` | 7 components | `GameBoardService`, `CombatVFXService` | Medium | 7th |
| `AppRoutingModule` | — | — | Collapse into AppModule | 8th |
| `AppModule` | `AppComponent` | `GlobalErrorHandler` | High (bootstrap) | Last |

#### Per-Module Conversion Steps

For each module (example: `LandingModule`):

1. Add `standalone: true` to `LandingComponent`'s `@Component` decorator.
2. Add the imports the component needs directly to `@Component.imports` (e.g., `CommonModule`
   or individual directives like `NgIf`, `NgFor` — or use the new control flow and drop them).
3. Delete `landing.module.ts`.
4. Update the route in `app-routing.module.ts`:
   ```typescript
   // Before:
   loadChildren: () => import('./landing/landing.module').then(m => m.LandingModule)
   // After:
   loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent)
   ```
5. Run `npm test` — confirm landing specs still pass.

#### AppModule (Bootstrap) — Last Step

After all feature modules are standalone, convert the bootstrap:

```typescript
// main.ts — replace platformBrowserDynamic().bootstrapModule(AppModule)
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
});
```

`AppRoutingModule` and `AppModule` are deleted at this point.

#### GameBoardComponent — Special Case

`GameBoardComponent` already has 28 component-level providers in its `@Component.providers`
array. When converting to standalone, add `standalone: true` and move `CommonModule`/
`RouterModule` into `@Component.imports`. The providers array remains exactly as-is — this is
valid in standalone components.

The `GameModule` wrapper becomes redundant once `GameBoardComponent` is standalone and the
route uses `loadComponent`. `GameBoardService` and `CombatVFXService` currently live in
`GameModule.providers` — move them into `GameBoardComponent.providers` before deleting the
module.

#### EditorModule — Special Case

8 services are provided at `EditorModule` scope to maintain singleton lifetime across the
editor session. When converting to standalone:
- `NovariseComponent` becomes standalone
- The 8 editor services move to `NovariseComponent.providers` (preserves component-scoped
  singleton behavior)
- Alternatively, use `EnvironmentProviders` with a route-level `providers` array in
  `app-routing.ts` for the `/edit` route if you need the services accessible to child routes

**Risk: HIGH** — module deletion is irreversible. Use a feature branch. Test each module
conversion in isolation before proceeding to the next.

---

## Test Strategy

### Per-Upgrade-Step Verification

At each step (15→16 and 16→17), run the full suite before moving on:
```bash
npm test -- --no-watch
```

**Current baseline: 4024 passing, 0 failures.**

### Tests Most Likely to Break

| Risk | Reason | Files |
|---|---|---|
| High | GameBoardComponent — WebGL init triggered by `detectChanges()`. Already guarded (specs skip `detectChanges()`), but builder changes can affect how test.ts initializes. | `game-board.component.spec.ts` |
| Medium | Module-scoped service injection — when EditorModule is deleted, specs that use `TestBed` with the old module providers need updating | `novarise.component.spec.ts`, editor service specs |
| Medium | `ViewEncapsulation.None` components — style assertions in tests that check computed CSS may behave differently with esbuild | `game-hud.component.spec.ts` etc. |
| Low | TypeScript 5.0 stricter generics — some inferred types may widen or narrow; `strict: true` is already on so surprises are unlikely | Any file with complex generics |
| Low | Karma + Angular 17 — Karma is deprecated but still supported; tests will still run | All spec files |

### After Builder Migration (Angular 17)

Run a build and serve locally to verify:
1. Three.js loads correctly (WebGL context, canvas creation)
2. Game launches and a wave completes (smoke test)
3. No `MIME type` errors for lazy-loaded chunks
4. PWA manifest still served (`manifest.webmanifest`)

---

## Deferred Work (Out of Scope for This Migration)

| Item | Angular Version | Notes |
|---|---|---|
| Zoneless change detection | Angular 18+ | Requires `OnPush` or signals throughout; major refactor |
| Signals-based state (replace BehaviorSubject) | Angular 17+ | Optional but enables future perf improvements |
| Jest migration (replace Karma) | Any | Independent; Karma deprecated but not removed until Angular 18 |
| SSR / hydration | Angular 17+ | Not planned; no server-rendering requirement |

---

## Upgrade Command Sequence (When Ready)

```bash
# Step 1: Angular 15 → 16
npm install @angular/core@16 @angular/common@16 @angular/router@16 \
  @angular/compiler@16 @angular/compiler-cli@16 @angular/forms@16 \
  @angular/platform-browser@16 @angular/platform-browser-dynamic@16 \
  @angular/animations@16 @angular/cli@16 \
  @angular-devkit/build-angular@16 \
  typescript@~5.0.4 zone.js@~0.13.0
npm test -- --no-watch

# Step 2: Angular 16 → 17
npm install @angular/core@17 @angular/common@17 @angular/router@17 \
  @angular/compiler@17 @angular/compiler-cli@17 @angular/forms@17 \
  @angular/platform-browser@17 @angular/platform-browser-dynamic@17 \
  @angular/animations@17 @angular/cli@17 \
  @angular-devkit/build-angular@17 \
  typescript@~5.2.2 zone.js@~0.14.0
# Update angular.json builder to @angular-devkit/build-angular:application
npm run build
npm test -- --no-watch

# Step 3: Control flow migration (optional, run interactively)
npx ng generate @angular/core:control-flow
# Review diffs, fix track expressions, commit

# Step 4: Standalone migration (one module at a time, see order above)
```

---

## Required vs Optional Summary

| Change | Required | Version |
|---|---|---|
| TypeScript 4.9 → 5.0 | YES | 15→16 |
| TypeScript 5.0 → 5.2 | YES | 16→17 |
| zone.js 0.13 → 0.14 | YES | 16→17 |
| Builder: browser → application | YES | 16→17 |
| DestroyRef + takeUntilDestroyed | NO (recommended) | 16 |
| @if/@for control flow | NO (recommended) | 17 |
| Standalone components | NO (incremental) | 17 |
| Signals | NO | 17 |
| @defer | NO | 17 |
| Zoneless | NO | 18+ |
