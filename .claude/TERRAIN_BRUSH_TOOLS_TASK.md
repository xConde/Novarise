# Terrain Editor: Advanced Brush & Drag Tools

## Task Objective
Implement intuitive terrain editing tools that allow designers to quickly paint and sculpt large areas with ease. Currently, users must click individual tiles - this should support drag-painting, brush sizes, and area tools for efficient terrain design.

## Current State

### Working Foundation
- **Branch**: `claude/novarise-terrain-editor-012MLNoKnApo9FP4pRv5GXeZ`
- **Latest Commit**: `1563b4f Fix WASD movement conflict with spawn mode`
- **Tech Stack**: Angular 15, Three.js, TypeScript
- **Core Files**:
  - `src/app/games/novarise/novarise.component.ts` (640 lines) - Main component with input handling
  - `src/app/games/novarise/features/terrain-editor/terrain-grid.class.ts` (318 lines) - Grid system
  - `src/app/games/novarise/features/ui-controls/edit-controls.component.*` - UI controls

### Existing Features
✅ Paint Mode (T key) - Click individual tiles to change terrain type
✅ Height Mode (H key) - Click individual tiles to adjust elevation
✅ Spawn/Exit Point placement (P/X keys)
✅ Mouse drag detection (already implemented with throttling at 50ms)
✅ Tile hover detection (raycasting working)
✅ WASD camera movement + arrow key rotation
✅ Mouse wheel zoom (10-80 units)
✅ Map save/load system (MapStorageService)

### Current Limitations (What Needs Improvement)
❌ **Single-tile editing only** - Users must click each tile individually
❌ **No brush sizes** - Can't paint multiple tiles at once
❌ **No drag-to-paint** - Mouse drag doesn't continuously paint
❌ **No area selection** - Can't fill rectangular regions
❌ **Slow workflow** - Takes too long to design large terrain features

## Requested Features

### 1. Drag-to-Paint (HIGH PRIORITY)
**User Story**: "When I click a terrain type and drag across the grid, it should paint all tiles I drag over"

**Implementation Details**:
- Mouse down + drag should continuously paint hovered tiles
- Should work for both Paint Mode and Height Mode
- Use existing `isMouseDown` flag and `applyEdit()` throttling (already at 50ms)
- Visual feedback: Show trail of painted tiles in real-time
- Should feel smooth and responsive (not jumpy)

**Technical Approach**:
```typescript
// In novarise.component.ts - onMouseMove()
if (this.isMouseDown && this.hoveredTile && this.editMode !== 'none') {
  const now = Date.now();
  if (now - this.lastEditTime >= this.editThrottleMs) {
    this.applyEdit(this.hoveredTile);  // Already exists!
    this.lastEditTime = now;
  }
}
```

**Edge Cases**:
- Don't interfere with OrbitControls when not in edit mode
- Respect throttling to avoid performance issues
- Clear hover state when mouse leaves canvas

### 2. Brush Size System (HIGH PRIORITY)
**User Story**: "I want to select a brush size (1x1, 3x3, 5x5) to paint multiple tiles at once"

**Implementation Details**:
- Add brush size selector to edit-controls UI: 1x1, 3x3, 5x5, 7x7
- Paint all tiles within brush radius from center
- Show brush preview (highlight affected tiles on hover)
- Keyboard shortcuts: 1, 3, 5, 7 keys for quick switching

**UI Design**:
```html
<div class="brush-size-selector">
  <span class="label">Brush Size</span>
  <button [class.active]="brushSize === 1">1x1</button>
  <button [class.active]="brushSize === 3">3x3</button>
  <button [class.active]="brushSize === 5">5x5</button>
  <button [class.active]="brushSize === 7">7x7</button>
</div>
```

**Technical Approach**:
```typescript
// Add to novarise.component.ts
private brushSize: number = 1;

private applyEdit(tile: { x: number, z: number }): void {
  const radius = Math.floor(this.brushSize / 2);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const targetX = tile.x + dx;
      const targetZ = tile.z + dz;

      if (this.editMode === 'paint') {
        this.terrainGrid.paintTile(targetX, targetZ, this.selectedTerrainType);
      } else if (this.editMode === 'height') {
        this.terrainGrid.adjustHeight(targetX, targetZ, this.heightAdjustment);
      }
    }
  }
}
```

**Visual Feedback**:
- Highlight all tiles within brush radius (not just center tile)
- Use semi-transparent overlay to show affected area
- Different color for brush preview vs actual hover

### 3. Fill Tool (MEDIUM PRIORITY)
**User Story**: "I want to flood-fill connected tiles of the same type with a new type (like paint bucket)"

**Implementation Details**:
- Add Fill mode (F key) to edit modes
- Click a tile to fill all connected tiles of same type
- Use flood-fill algorithm (BFS/DFS) with bounds checking
- Show confirmation for large fills (>100 tiles)

**Technical Approach**:
```typescript
// Add to terrain-grid.class.ts
public floodFill(startX: number, startZ: number, newType: TerrainType): void {
  if (!this.isValidPosition(startX, startZ)) return;

  const originalType = this.tiles[startX][startZ].type;
  if (originalType === newType) return;

  const queue: {x: number, z: number}[] = [{x: startX, z: startZ}];
  const visited = new Set<string>();
  let count = 0;

  while (queue.length > 0 && count < 1000) {
    const {x, z} = queue.shift()!;
    const key = `${x},${z}`;

    if (visited.has(key) || !this.isValidPosition(x, z)) continue;
    if (this.tiles[x][z].type !== originalType) continue;

    visited.add(key);
    this.paintTile(x, z, newType);
    count++;

    // Add neighbors
    queue.push({x: x+1, z}, {x: x-1, z}, {x, z: z+1}, {x, z: z-1});
  }
}
```

### 4. Rectangle Selection Tool (MEDIUM PRIORITY)
**User Story**: "I want to click-and-drag to select a rectangular area and fill it all at once"

**Implementation Details**:
- Add Select mode (R key for Rectangle)
- First click: Start corner
- Drag: Show selection rectangle preview
- Release: Fill entire selected area
- Visual feedback: Highlight selected tiles with animated border

**Technical Approach**:
```typescript
// Add to novarise.component.ts
private selectionStart: {x: number, z: number} | null = null;
private selectionEnd: {x: number, z: number} | null = null;

private fillRectangle(x1: number, z1: number, x2: number, z2: number): void {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      if (this.editMode === 'paint') {
        this.terrainGrid.paintTile(x, z, this.selectedTerrainType);
      }
    }
  }
}
```

### 5. Smooth Sculpting for Height Mode (LOW PRIORITY)
**User Story**: "When adjusting height, I want smooth hills/valleys instead of stepped terraces"

**Implementation Details**:
- Add "Smooth" toggle to height controls
- Apply gaussian blur to height values within brush
- Gradually blend heights at edges for natural terrain

**Technical Approach**:
```typescript
// Add to terrain-grid.class.ts
public smoothHeight(centerX: number, centerZ: number, radius: number): void {
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let z = centerZ - radius; z <= centerZ + radius; z++) {
      if (!this.isValidPosition(x, z)) continue;

      const distance = Math.sqrt((x - centerX)**2 + (z - centerZ)**2);
      if (distance > radius) continue;

      // Average height of neighbors
      let avgHeight = 0;
      let count = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (this.isValidPosition(x + dx, z + dz)) {
            avgHeight += this.heightMap[x + dx][z + dz];
            count++;
          }
        }
      }

      this.heightMap[x][z] = avgHeight / count;
    }
  }
}
```

## Design Inspiration

### Reference Games/Editors:
1. **Warcraft III World Editor** - Excellent brush system with circular brushes
2. **StarCraft II Editor** - Smooth terrain sculpting with falloff
3. **Cities: Skylines** - Intuitive drag-to-paint roads/zones
4. **Factorio** - Drag-to-place with ghost preview
5. **Photoshop** - Brush size controls, opacity, hardness

### Key UX Principles:
- **Immediate Feedback**: Show what will happen before it happens
- **Forgiving**: Easy undo (Ctrl+Z should work)
- **Efficient**: Minimize clicks/keystrokes for common operations
- **Discoverable**: Visual hints for available tools
- **Consistent**: Similar operations work the same way across modes

## Technical Considerations

### Performance
- Current throttling: 50ms (20fps) for drag operations - keep this!
- Brush size 7x7 = 49 tiles per operation - should be fine with throttling
- Fill tool: Limit to 1000 tiles max with confirmation dialog
- Rectangle selection: Show preview without actually painting until release

### Visual Feedback
- **Brush Preview**: Semi-transparent overlay on hovered tiles
- **Drag Trail**: Slight glow/pulse on recently painted tiles
- **Selection Box**: Animated dashed border (CSS animation)
- **Cursor Changes**: Different cursor for each tool mode

### State Management
- Brush size should persist across mode switches
- Add brush size to map save/load (optional, but nice)
- Remember last used settings per terrain type

### Compatibility
- Don't break existing keyboard shortcuts (WASD, arrow keys, T/H/P/X/G/L)
- Maintain purple color scheme (#6a4a8a, #9a8ab0)
- Keep "crisp" feel of current UI
- OrbitControls should still work when not in edit mode

## Files to Modify

### Primary Changes
1. **`src/app/games/novarise/novarise.component.ts`**
   - Add brush size property and methods
   - Implement drag-to-paint logic in onMouseMove
   - Add keyboard shortcuts for brush sizes (1/3/5/7 keys)
   - Add fill/rectangle mode handling
   - Update applyEdit() to handle brush radius

2. **`src/app/games/novarise/features/ui-controls/edit-controls.component.html`**
   - Add brush size selector UI
   - Add new tool buttons (Fill, Rectangle)
   - Show current brush size indicator

3. **`src/app/games/novarise/features/ui-controls/edit-controls.component.scss`**
   - Style brush size selector (match existing purple theme)
   - Add hover effects for brush buttons
   - Ensure compact layout

4. **`src/app/games/novarise/features/ui-controls/edit-controls.component.ts`**
   - Add brushSize input/output
   - Add events for brush size change
   - Add events for new tool modes

5. **`src/app/games/novarise/features/terrain-editor/terrain-grid.class.ts`**
   - Add floodFill() method
   - Add smoothHeight() method
   - Optimize for batch operations (if needed)

### Optional Enhancements
6. **`src/app/games/novarise/novarise.component.html`**
   - Update instructions panel with new shortcuts
   - Add brush size indicator near cursor (optional)

7. **Create new file: `src/app/games/novarise/features/terrain-editor/brush-preview.class.ts`**
   - Dedicated class for rendering brush preview overlay
   - Handles multi-tile highlight with falloff/gradient

## Success Criteria

### Must Have (MVP)
- ✅ Drag-to-paint works smoothly in both Paint and Height modes
- ✅ Brush sizes 1x1, 3x3, 5x5 selectable via UI buttons
- ✅ Keyboard shortcuts 1/3/5 keys work for brush size
- ✅ Brush preview shows which tiles will be affected
- ✅ No performance degradation (maintain 60fps during painting)
- ✅ UI matches existing purple theme and professional feel

### Nice to Have (Stretch Goals)
- ✅ Fill tool (F key) with flood-fill algorithm
- ✅ Rectangle selection tool (R key) with visual preview
- ✅ 7x7 brush size option
- ✅ Smooth sculpting option for height mode
- ✅ Cursor changes based on active tool
- ✅ Recent tile pulse/glow effect

### Quality Bar
- Code follows existing patterns (lerp, throttling, event-driven)
- No new bugs introduced (test all existing features)
- Git commits are descriptive and atomic
- Build succeeds with no warnings
- User can design a full terrain map in <5 minutes (vs current 20+ minutes)

## Testing Checklist

### Functional Tests
- [ ] Drag-to-paint works on first try without clicking
- [ ] Brush size changes apply immediately
- [ ] Keyboard shortcuts (1/3/5/7) change brush size correctly
- [ ] Brush preview highlights correct tiles
- [ ] Fill tool doesn't freeze on large fills
- [ ] Rectangle selection shows preview before applying
- [ ] Undo/Redo works with new tools (if implemented)
- [ ] Map save/load preserves terrain painted with new tools

### Integration Tests
- [ ] WASD movement still works while in paint mode
- [ ] Arrow key rotation doesn't conflict with new shortcuts
- [ ] Mouse wheel zoom works during editing
- [ ] OrbitControls don't interfere with painting
- [ ] Spawn/Exit point modes still work (P/X keys)
- [ ] Save/Load maps still works (G/L keys)

### Performance Tests
- [ ] Maintain 60fps with 7x7 brush during drag
- [ ] No lag when filling 500+ tiles
- [ ] No memory leaks after 10 minutes of editing
- [ ] Throttling prevents excessive operations

### UX Tests
- [ ] New user can discover brush size controls
- [ ] Tool changes feel immediate and responsive
- [ ] Visual feedback makes it clear what will happen
- [ ] Consistent behavior across Paint/Height modes
- [ ] Keyboard shortcuts are intuitive

## Implementation Strategy

### Phase 1: Foundation (Do First)
1. Add brush size property and UI selector
2. Implement brush preview (highlight multiple tiles)
3. Test keyboard shortcuts (1/3/5 keys)
4. Ensure existing functionality still works

### Phase 2: Drag-to-Paint (Core Feature)
1. Enable continuous painting in onMouseMove when mouse down
2. Respect existing 50ms throttling
3. Update applyEdit() to handle brush radius
4. Test with different brush sizes

### Phase 3: Advanced Tools (Stretch)
1. Implement fill tool with flood-fill algorithm
2. Add rectangle selection mode
3. Add smooth sculpting option
4. Polish visual feedback (glows, pulses, animations)

### Phase 4: Polish & Test
1. Run full testing checklist
2. Fix any bugs discovered
3. Ensure code quality (comments, types, patterns)
4. Update instructions panel
5. Final performance check

## Example Code Snippets

### Brush Size Selector (edit-controls.component.html)
```html
<div class="section brush-settings" *ngIf="editMode === 'paint' || editMode === 'height'">
  <div class="section-title">Brush Size</div>
  <div class="brush-size-buttons">
    <button class="brush-button"
            [class.active]="brushSize === 1"
            (click)="setBrushSize(1)">
      <span class="size">1x1</span>
      <span class="shortcut">(1)</span>
    </button>
    <button class="brush-button"
            [class.active]="brushSize === 3"
            (click)="setBrushSize(3)">
      <span class="size">3x3</span>
      <span class="shortcut">(3)</span>
    </button>
    <button class="brush-button"
            [class.active]="brushSize === 5"
            (click)="setBrushSize(5)">
      <span class="size">5x5</span>
      <span class="shortcut">(5)</span>
    </button>
    <button class="brush-button"
            [class.active]="brushSize === 7"
            (click)="setBrushSize(7)">
      <span class="size">7x7</span>
      <span class="shortcut">(7)</span>
    </button>
  </div>
</div>
```

### Brush Preview Rendering (novarise.component.ts)
```typescript
private updateBrushPreview(): void {
  if (!this.hoveredTile || this.editMode === 'none') {
    this.clearBrushPreview();
    return;
  }

  const radius = Math.floor(this.brushSize / 2);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const x = this.hoveredTile.x + dx;
      const z = this.hoveredTile.z + dz;

      const tile = this.terrainGrid.getTile(x, z);
      if (tile) {
        // Add semi-transparent overlay
        const material = tile.mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x9a8ab0); // Purple glow
        material.emissiveIntensity = 0.3;
      }
    }
  }
}
```

### Keyboard Shortcuts (novarise.component.ts)
```typescript
@HostListener('window:keydown', ['$event'])
private onKeyDown(event: KeyboardEvent): void {
  const key = event.key.toLowerCase();

  // Brush size shortcuts (only in edit modes)
  if (this.editMode === 'paint' || this.editMode === 'height') {
    switch(key) {
      case '1':
        this.brushSize = 1;
        break;
      case '3':
        this.brushSize = 3;
        break;
      case '5':
        this.brushSize = 5;
        break;
      case '7':
        this.brushSize = 7;
        break;
    }
  }

  // Existing shortcuts...
}
```

## Notes for Next Claude

### What's Already Working Well
- Drag detection and throttling (50ms) already implemented
- Raycasting and tile hover detection very solid
- Camera controls are buttery smooth (don't break these!)
- Performance optimizations already in place (mesh cache, skip redundant ops)
- Professional UI/UX foundation established

### What Needs Attention
- The user wants "stretch it out" - interpret as drag-to-paint with brush sizes
- "Really nice ease of access" - means fewer clicks, more efficient workflow
- Keep the "crisp" feel - existing UI has great polish, maintain that quality
- Purple theme (#6a4a8a, #9a8ab0) is sacred - user loves these colors

### User's Work Style
- Values efficiency and professional appearance
- Appreciates thorough work but wants practical features
- Will test actively and give specific feedback
- Expects commit + push when work is complete
- Likes when you explain what you did and why

### Branch Info
- **Branch**: `claude/novarise-terrain-editor-012MLNoKnApo9FP4pRv5GXeZ`
- **Push after completion**: `git push -u origin claude/novarise-terrain-editor-012MLNoKnApo9FP4pRv5GXeZ`
- Retry up to 4 times with exponential backoff if network issues

### Success Looks Like
User can click Paint mode, select 5x5 brush, and drag across the grid to quickly paint large terrain features. Map creation time drops from 20+ minutes to <5 minutes. Everything feels smooth, responsive, and professional.

---

**Good luck! The foundation is solid, now make terrain design feel like butter. 🎨**
