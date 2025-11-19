# Mobile Support for Novarise Terrain Editor

## Objective
Make the terrain editor look impressive and navigable on mobile devices. The user wants to show this to their girlfriend - **visual quality and smooth navigation are top priority**. Full editing capabilities can be simplified, but the experience must feel professional and polished.

## Current Mobile Issues

### What Breaks on Mobile
- **Camera controls**: WASD and arrow keys don't exist on mobile
- **Edit shortcuts**: All keyboard shortcuts (T/H/P/X/G/L/1/3/5/7) unavailable
- **UI layout**: 280px right panel + instructions panel take up too much screen space
- **Touch events**: No touch handlers implemented
- **Responsive design**: No media queries, fixed sizes
- **Title size**: 3rem title too large on small screens

### What Already Works
- Three.js rendering (works fine on mobile)
- OrbitControls (has touch support built-in)
- Raycasting (can detect touch instead of mouse)
- Purple theme and visual effects

## Mobile Implementation Strategy

### **Priority 1: Visual Navigation (MUST HAVE)**
The view needs to look amazing and be smoothly navigable.

**Touch Camera Controls:**
- Enable OrbitControls touch support (currently disabled)
- One finger drag = Rotate camera around terrain
- Two finger pinch = Zoom in/out
- Two finger pan = Pan camera laterally (optional)
- Add damping back for smooth, natural feel on mobile

**Code Changes (novarise.component.ts):**
```typescript
// Detect if mobile
private isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

private initControls(): void {
  this.controls = new OrbitControls(this.camera, this.renderer.domElement);

  if (this.isMobile()) {
    // Mobile: Enable touch controls with damping for smooth feel
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08; // Smooth, natural feel
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
  } else {
    // Desktop: Disabled controls (WASD/arrow keys handle movement)
    this.controls.enableRotate = false;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = false;
  }
}
```

### **Priority 2: Responsive UI (MUST HAVE)**
UI must adapt to mobile screens without blocking the gorgeous terrain view.

**Responsive Layout:**
- Title: 3rem → 1.5rem on mobile
- Edit controls panel: Collapse or move to bottom drawer
- Instructions panel: Hide on mobile (show with "?" button if needed)
- Game container border: 4px → 2px on mobile
- Touch-friendly button sizes: minimum 44px tap targets

**CSS Media Queries (novarise.component.scss):**
```scss
// Mobile breakpoint
@media (max-width: 768px) {
  .game-container {
    border: 2px solid #6a4a8a; // Thinner border
    padding: 4px;
    height: 100vh;
    width: 100vw;

    .title .letter {
      font-size: 1.5rem; // Smaller title
      margin: 0 0.1rem;
    }
  }

  .shortcuts-hint {
    display: none; // Hide keyboard shortcuts on mobile
  }
}
```

**Edit Controls Responsive (edit-controls.component.scss):**
```scss
@media (max-width: 768px) {
  .edit-controls-panel {
    // Move to bottom, make horizontal
    top: auto;
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    border-radius: 12px 12px 0 0;
    max-height: 40vh;
    overflow-y: auto;

    // Or collapse to FAB (floating action button) that expands on tap
    &.collapsed {
      height: 60px;
      padding: 10px;

      .panel-section {
        display: none;
      }
    }
  }

  .mode-button,
  .terrain-button {
    min-height: 44px; // iOS touch target minimum
    min-width: 44px;
  }
}
```

### **Priority 3: Simplified Touch Editing (NICE TO HAVE)**
If editing is needed on mobile, keep it simple.

**Touch-to-Paint:**
- Tap tile to paint with selected terrain type
- Long-press to open quick-select menu (radial menu with terrain types)
- No brush size options on mobile (always 1x1)
- No height editing on mobile (too fiddly)

**Touch Event Handlers:**
```typescript
@HostListener('touchstart', ['$event'])
private onTouchStart(event: TouchEvent): void {
  if (!this.isMobile()) return;

  event.preventDefault(); // Prevent page scroll
  const touch = event.touches[0];

  // Convert touch to mouse coordinates for raycasting
  const rect = this.renderer.domElement.getBoundingClientRect();
  this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
  this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

  this.isMouseDown = true;
  this.detectTileHover();

  // Start long-press timer for quick-select
  this.longPressTimer = setTimeout(() => {
    this.showQuickSelectMenu(this.hoveredTile);
  }, 500);
}

@HostListener('touchend', ['$event'])
private onTouchEnd(event: TouchEvent): void {
  if (!this.isMobile()) return;

  clearTimeout(this.longPressTimer);

  if (this.editMode === 'paint' && this.hoveredTile) {
    this.applyEdit(this.hoveredTile); // Simple tap-to-paint
  }

  this.isMouseDown = false;
}
```

### **Priority 4: Performance Optimization (MUST HAVE)**
Mobile devices have less power - optimize rendering.

**Optimizations:**
- Reduce particle count on mobile (1000 → 300)
- Lower bloom intensity (save GPU)
- Disable shadows if performance issues
- Throttle render loop if battery low

**Code Changes:**
```typescript
private createParticles(): void {
  const particleCount = this.isMobile() ? 300 : 1000;
  // ... rest of particle creation
}

private initPostProcessing(): void {
  // ... existing code

  // Lighter bloom on mobile
  const bloomStrength = this.isMobile() ? 0.5 : 0.8;
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomStrength,
    0.4,
    0.85
  );
}
```

## Mobile UX Design Principles

### **Visual Hierarchy**
1. **Terrain view** - Takes up 100% of screen, impressive and immersive
2. **Title** - Smaller but still visible, doesn't dominate
3. **Controls** - Collapsible, out of the way until needed
4. **Instructions** - Hidden, accessible via help button if needed

### **Touch Interactions**
- **One finger drag on terrain** = Rotate camera (most common action)
- **Pinch** = Zoom (intuitive, familiar gesture)
- **Tap tile** = Paint with selected type (simple, direct)
- **Tap UI button** = Select tool/terrain type (clear feedback)
- **Long-press tile** = Quick-select menu (power user feature)

### **Visual Feedback**
- Larger touch targets (44px minimum)
- Clear active states (easier to see on small screens)
- Haptic feedback if available (navigator.vibrate)
- Smooth transitions (looks professional)

## Implementation Phases

### **Phase 1: Make It Viewable (Do This First)**
Goal: Look impressive, navigate smoothly, no editing needed yet

1. Add `isMobile()` detection
2. Enable OrbitControls touch support on mobile
3. Add responsive CSS media queries
4. Smaller title on mobile
5. Hide keyboard instructions on mobile
6. Test on actual mobile device

**Success Criteria:**
- Can rotate terrain smoothly with one finger
- Can zoom in/out with pinch
- Title and borders look proportional
- No UI blocking the view
- Feels smooth and professional

### **Phase 2: Responsive UI**
Goal: Controls adapt to mobile without being intrusive

1. Move edit panel to bottom drawer (or FAB)
2. Make buttons touch-friendly (44px minimum)
3. Add expand/collapse functionality
4. Optimize layout for portrait orientation
5. Test on various screen sizes (phone, tablet)

**Success Criteria:**
- Can access all terrain types on mobile
- UI doesn't cover more than 40% of screen
- Buttons easy to tap accurately
- Looks clean and professional

### **Phase 3: Touch Editing (Optional)**
Goal: Basic editing works on mobile if needed

1. Add touch event handlers (touchstart, touchmove, touchend)
2. Implement tap-to-paint
3. Add long-press quick-select menu
4. Disable complex features (brush sizes, height editing)
5. Add visual feedback for touch interactions

**Success Criteria:**
- Can paint tiles by tapping
- No accidental edits while navigating
- Clear which tile will be painted
- Feels responsive and direct

## Testing Checklist

### Visual Quality
- [ ] Terrain renders correctly on mobile browsers (Chrome, Safari)
- [ ] Purple glow effects look good (not too heavy)
- [ ] Particle effects perform well
- [ ] Title is readable but not overwhelming
- [ ] Border and shadows look proportional

### Navigation
- [ ] One finger drag rotates smoothly
- [ ] Pinch zoom feels natural
- [ ] No lag or stuttering during rotation
- [ ] Camera doesn't get stuck or flip
- [ ] Zoom range is appropriate (10-80 units)

### UI/UX
- [ ] All buttons are easily tappable (44px minimum)
- [ ] Active states are clearly visible
- [ ] UI doesn't block terrain view unnecessarily
- [ ] Can collapse/expand controls easily
- [ ] No horizontal scrolling (unless intended)

### Performance
- [ ] Maintains 30fps minimum on mid-range phones
- [ ] No excessive battery drain
- [ ] Particle effects don't cause lag
- [ ] Render loop doesn't slow down over time

### Compatibility
- [ ] Works on iOS Safari (iPhone)
- [ ] Works on Chrome Android
- [ ] Works on iPad
- [ ] Landscape and portrait both work
- [ ] Different screen sizes (small phone to tablet)

## Important Notes

### Don't Break Desktop
- Use `isMobile()` checks to branch behavior
- Desktop should work exactly as it does now
- Mobile-specific code should be isolated
- Test both desktop and mobile after changes

### Keep It Professional
- No janky animations or transitions
- Smooth, natural camera movement
- Clean, uncluttered UI
- Purple theme maintained
- "Crisp" feel on touch interactions

### User's Goal
"Show off this view and impress my girlfriend"

This means:
- **Visual quality is paramount** - terrain must look stunning
- **Smooth navigation** - no lag, no jank, feels polished
- **Easy to use** - girlfriend can navigate without instruction
- **Professional appearance** - looks like a real game engine tool
- **Impressive** - "wow" factor when terrain rotates and glows

### What Success Looks Like
User hands phone to girlfriend. She:
1. Sees beautiful purple-glowing terrain grid with particles
2. Touches screen and terrain rotates smoothly
3. Pinches to zoom, explores the 3D space
4. Says "This is really cool, you made this?"
5. User feels proud and impressive

## Code Examples

### Mobile Detection Utility
```typescript
// Add to novarise.component.ts
private isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

private isTouch(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
```

### Viewport Meta Tag
Make sure this exists in `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

### Prevent iOS Bounce/Pull-to-Refresh
```scss
// Add to global styles
body {
  overscroll-behavior: none;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}

canvas {
  touch-action: none; // Prevent default touch behaviors on canvas
}
```

### FAB (Floating Action Button) Pattern
```html
<!-- Mobile collapsed control panel -->
<div class="edit-controls-panel" [class.mobile]="isMobile" [class.expanded]="mobileMenuExpanded">
  <button class="fab-toggle" (click)="toggleMobileMenu()" *ngIf="isMobile && !mobileMenuExpanded">
    <span class="icon">✎</span>
  </button>

  <div class="panel-content" *ngIf="!isMobile || mobileMenuExpanded">
    <!-- Existing edit controls -->
  </div>
</div>
```

```scss
// FAB styling
.fab-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #6a4a8a;
  border: 2px solid #9a8ab0;
  color: #e0d0f0;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1001;

  &:active {
    transform: scale(0.95);
  }
}
```

## Final Checklist Before Showing to Girlfriend

- [ ] Test on actual phone (not just Chrome DevTools)
- [ ] Terrain looks impressive (purple glow, particles visible)
- [ ] Navigation is smooth (no stuttering)
- [ ] UI doesn't block the view
- [ ] Works in both portrait and landscape
- [ ] Battery doesn't drain too fast
- [ ] No console errors in mobile browser
- [ ] Can easily rotate, zoom, explore the terrain
- [ ] Load time is reasonable (<3 seconds)
- [ ] Feels professional and polished

---

**Bottom Line**: Make the 3D terrain look absolutely stunning on mobile with butter-smooth touch navigation. Editing is secondary - this is about showing off impressive work. If she says "wow, this is cool" - you've succeeded.
