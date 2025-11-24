# Novarise - Next Development Session Guide

## Pre-Work Research Checklist

Before making any changes, the next Claude should complete these research tasks:

### 1. Understand the Codebase Architecture
- [ ] Read `src/app/games/novarise/novarise.component.ts` - main game component
- [ ] Read `src/app/games/novarise/features/` directory structure
- [ ] Understand the terrain system in `features/terrain-editor/`
- [ ] Review the mobile controls in `features/mobile-controls/`
- [ ] Check `features/ui-controls/` for existing UI patterns

### 2. Understand Established Patterns

#### Touch/Mobile Detection Pattern
- [ ] Study `TouchDetectionService` in `features/mobile-controls/services/`
- [ ] Note: Uses actual touch capability detection, NOT just screen size
- [ ] Observable-based for reactive updates on resize/orientation change
- [ ] Key method: `hasTouchSupport()` checks `ontouchstart`, `maxTouchPoints`

#### Responsive Component Pattern
- [ ] Study `VirtualJoystickComponent` for dynamic sizing example
- [ ] Sizes defined in `joystick.types.ts` with `as const` for type safety
- [ ] Service emits DeviceInfo, component subscribes and updates sizes
- [ ] CSS uses `env(safe-area-inset-*)` for notched devices

#### Feature Module Pattern
- [ ] Study `MobileControlsModule` structure
- [ ] Barrel exports via `index.ts`
- [ ] Self-contained with own models, services, components
- [ ] Imported in `app.module.ts`

#### Memory Management Pattern
- [ ] All event listeners stored as class properties
- [ ] Cleaned up in `ngOnDestroy()`
- [ ] Components handle their own cleanup (no parent responsibility)

### 3. Understand the Game State

#### Current Terrain Editor Features
- [ ] Paint mode (terrain types: BEDROCK, CRYSTAL, MOSS, ABYSS)
- [ ] Height mode (raises terrain - **lowering not yet implemented**)
- [ ] Spawn/Exit point placement
- [ ] Brush tools: brush, fill, rectangle
- [ ] Brush sizes: 1, 3, 5, 7

#### Current Camera Controls
- [ ] WASD: Movement (relative to camera direction)
- [ ] Arrow keys: Camera rotation (yaw/pitch)
- [ ] Q/E: Vertical movement
- [ ] Shift: Fast movement
- [ ] Mouse wheel: Zoom
- [ ] Mobile: Dual joysticks (left=move, right=rotate)

#### Map Storage
- [ ] Uses `MapStorageService` for localStorage persistence
- [ ] Supports multiple named maps
- [ ] Auto-loads last map on startup

### 4. Review Test Coverage
- [ ] Read `novarise.component.spec.ts` for existing test patterns
- [ ] Uses Jasmine (NOT Jest) - different syntax
- [ ] 28 existing tests for joystick functionality
- [ ] Mock patterns for ElementRef and touch events

### 5. Check Build Configuration
- [ ] Angular 15.2.0
- [ ] Three.js 0.170.0
- [ ] Karma/Jasmine for testing
- [ ] Budget warnings exist for bundle size (730KB) - be mindful

---

## Planned Features (Priority Order)

### High Priority
1. **Height Reduction Mode**
   - Currently height mode only raises terrain
   - Need: Toggle or modifier key to lower instead
   - Consider: Shift+click to lower, or separate mode

2. **Tower Placement Spots**
   - Designate valid tower locations on map
   - Visual indicator (different from spawn/exit markers)
   - Store in map state, persist with save/load

3. **Controls Menu Reorganization**
   - Current: All shortcuts visible at once (overwhelming)
   - Goal: Contextual controls based on current mode
   - Consider: Collapsible sections or mode-specific panels

### Medium Priority
4. **Touch-Friendly Terrain Editing**
   - Current brush/fill optimized for mouse
   - Need: Larger touch targets, gesture support
   - Consider: Pinch-to-zoom, two-finger pan

5. **Undo/Redo System**
   - Track terrain state history
   - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
   - Limit history depth for memory

### Lower Priority
6. **Haptic Feedback**
   - Vibration on joystick activation
   - Use `navigator.vibrate()` where supported
   - Respect user preferences

7. **Performance Optimization**
   - Bundle size currently 730KB (over 500KB budget)
   - Consider lazy loading for features
   - Tree-shake unused Three.js modules

---

## UX Guidelines Established

### Mobile/Touch
- Detect capability, not screen size
- Support both portrait and landscape
- Account for safe areas (notch, home indicator)
- Responsive sizing (not just hiding/showing)

### Visual Feedback
- Immediate feedback on all interactions
- Flash animations on terrain edits
- Brush indicator follows cursor/touch
- Mode-specific cursor changes

### Consistency
- Purple theme for movement controls
- Orange/brown theme for rotation controls
- Same interaction patterns across device types

---

## Files Quick Reference

```
src/app/games/novarise/
├── novarise.component.ts          # Main game logic (1500 lines)
├── novarise.component.html        # Template with canvas + UI
├── novarise.component.scss        # Styles (now minimal for joysticks)
├── novarise.component.spec.ts     # Unit tests
├── core/
│   └── map-storage.service.ts     # LocalStorage persistence
├── models/
│   └── terrain-types.enum.ts      # Terrain type definitions
└── features/
    ├── terrain-editor/
    │   └── terrain-grid.class.ts  # Grid management
    ├── mobile-controls/
    │   ├── index.ts               # Barrel exports
    │   ├── mobile-controls.module.ts
    │   ├── models/joystick.types.ts
    │   ├── services/touch-detection.service.ts
    │   └── components/virtual-joystick/
    └── ui-controls/
        └── edit-controls.component.*
```

---

## Git Branch
Current feature branch: `claude/add-mobile-dual-stick-01W6EV1363ta54QxEcyC3DoK`

All dual-stick and modularization work is on this branch, ready for merge to main after final QA.
