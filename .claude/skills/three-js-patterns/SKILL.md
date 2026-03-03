---
name: three-js-patterns
description: Three.js disposal, material handling, and rendering patterns for Novarise. Use when writing or reviewing code that creates Three.js objects, meshes, materials, or post-processing effects.
user-invocable: false
---

# Three.js Patterns — Novarise

## Disposal Protocol

Every Three.js resource that allocates GPU memory must be explicitly disposed. The garbage collector does NOT free GPU resources.

### What Must Be Disposed
| Resource | Method | Creates GPU allocation? |
|----------|--------|------------------------|
| `Geometry` | `.dispose()` | Yes — vertex buffers |
| `Material` | `.dispose()` | Yes — shader programs |
| `Texture` | `.dispose()` | Yes — GPU texture memory |
| `WebGLRenderer` | `.dispose()` | Yes — GL context |
| `RenderTarget` | `.dispose()` | Yes — framebuffers |
| `EffectComposer` | dispose passes + targets | Yes — via passes |
| `UnrealBloomPass` | `.dispose()` | Yes — internal framebuffers |
| `ShaderPass` | `.dispose()` | Yes — allocates framebuffers |
| `OrbitControls` | `.dispose()` | No — but removes listeners |

### Material Disposal Helper

Materials can be a single `Material` or `Material[]`. Always handle both:

```typescript
private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(m => m.dispose());
  } else {
    material.dispose();
  }
}
```

### Component Cleanup Pattern

```typescript
ngOnDestroy(): void {
  // 1. Stop the render loop
  if (this.animationFrameId) {
    cancelAnimationFrame(this.animationFrameId);
  }

  // 2. Unsubscribe RxJS
  this.stateSubscription?.unsubscribe();

  // 3. Remove DOM event listeners (must use named refs, not anonymous)
  this.canvas.removeEventListener('mousemove', this.onMouseMove);
  this.canvas.removeEventListener('click', this.onClick);
  window.removeEventListener('resize', this.onResize);
  window.removeEventListener('keydown', this.onKeyDown);

  // 4. Clean up game objects (shared with restartGame)
  this.cleanupGameObjects();

  // 5. Dispose post-processing
  if (this.composer) {
    this.composer.renderTarget1?.dispose();
    this.composer.renderTarget2?.dispose();
  }
  this.bloomPass?.dispose();
  this.vignettePass?.dispose();

  // 6. Dispose controls and renderer
  this.controls?.dispose();
  this.renderer?.dispose();
}
```

### Mesh Cleanup Pattern

When removing meshes from the scene:
```typescript
// Remove from scene FIRST, then dispose
this.scene.remove(mesh);
if (mesh instanceof THREE.Mesh) {
  mesh.geometry.dispose();
  this.disposeMaterial(mesh.material);
}

// For Groups (towers), traverse children
towerGroup.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    child.geometry.dispose();
    this.disposeMaterial(child.material);
  }
});
this.scene.remove(towerGroup);
```

### Null After Dispose
Set references to `null` after disposal to prevent accidental reuse:
```typescript
this.skyboxMesh?.geometry.dispose();
this.disposeMaterial(this.skyboxMesh!.material);
this.scene.remove(this.skyboxMesh!);
this.skyboxMesh = null;
```

## Event Listener Pattern

Canvas event listeners MUST be stored as named class properties. Anonymous arrow functions cannot be removed:

```typescript
// GOOD — removable
private onMouseMove = (event: MouseEvent) => { ... };
private onClick = (event: MouseEvent) => { ... };
// In ngOnInit:
this.canvas.addEventListener('mousemove', this.onMouseMove);
// In ngOnDestroy:
this.canvas.removeEventListener('mousemove', this.onMouseMove);

// BAD — leaks
this.canvas.addEventListener('mousemove', (e) => { ... }); // Can't remove!
```

## instanceof Checks

`THREE.Line` is the parent class of `THREE.LineSegments`. Check specifics first:
```typescript
// GOOD
if (child instanceof THREE.LineSegments) { ... }
else if (child instanceof THREE.Line) { ... }

// BAD — LineSegments would match the Line check
if (child instanceof THREE.Line) { ... }  // Catches LineSegments too!
```

## Raycasting Pattern

For mouse interaction with tile/tower meshes:
```typescript
// Convert mouse to normalized device coordinates
const mouse = new THREE.Vector2(
  (event.clientX / canvas.clientWidth) * 2 - 1,
  -(event.clientY / canvas.clientHeight) * 2 + 1
);

// Raycast against tile meshes
const raycaster = new THREE.Raycaster();
raycaster.setFromCamera(mouse, this.camera);
const intersects = raycaster.intersectObjects(this.tileMeshes);
```

## Post-Processing Setup

EffectComposer chain order matters:
```
RenderPass → UnrealBloomPass → ShaderPass (vignette) → output
```

Each pass allocates framebuffers. All must be disposed.

## Performance Guards

- Cap `deltaTime` at 100ms to prevent physics burst on tab switch
- Reuse geometries/materials when creating many identical objects
- Use `BufferGeometry` (not legacy `Geometry`)
- Limit shadow map resolution (2048x2048 max)
- Dispose path cache on board changes (`EnemyService.clearPathCache()`)
