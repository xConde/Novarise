# Enemy System Testing Guide

## Manual Testing Instructions

### Prerequisites
```bash
npm install
npm start
```

Navigate to `http://localhost:4200`

---

## Test Suite 1: Basic Enemy Spawning

### Test 1.1: Spawn Basic Enemy
**Steps:**
1. Press `E` or `1` key
2. Observe enemy appears at cyan spawner tile (corner)
3. Enemy should be a RED sphere

**Expected:**
- ✅ Enemy spawns immediately
- ✅ Enemy appears at corner spawner
- ✅ Enemy is red colored
- ✅ No console errors

### Test 1.2: Spawn All Enemy Types
**Steps:**
1. Press `1` - BASIC (Red, medium speed)
2. Press `2` - FAST (Yellow, fast speed)
3. Press `3` - HEAVY (Blue, slow speed, large)
4. Press `4` - FLYING (Cyan, fast speed)
5. Press `5` - BOSS (Magenta, very slow, very large)

**Expected:**
- ✅ All 5 enemy types spawn
- ✅ Each has distinct color
- ✅ Sizes vary (BOSS > HEAVY > BASIC)
- ✅ No console errors

---

## Test Suite 2: Pathfinding

### Test 2.1: Path to Exit
**Steps:**
1. Spawn any enemy type
2. Observe movement path

**Expected:**
- ✅ Enemy moves from spawner toward center exit tiles (magenta)
- ✅ Movement is smooth (no teleporting)
- ✅ Enemy follows grid lines (no diagonal movement)
- ✅ Enemy disappears when reaching exit

### Test 2.2: Path Around Towers
**Steps:**
1. Place several towers to block direct path
2. Spawn enemy
3. Observe pathfinding

**Expected:**
- ✅ Enemy finds alternate route around towers
- ✅ Enemy doesn't move through towers
- ✅ Path updates when new tower placed
- ✅ Enemy still reaches exit

### Test 2.3: Completely Blocked Path
**Steps:**
1. Surround exit tiles completely with towers
2. Try to spawn enemy

**Expected:**
- ✅ Enemy spawn fails gracefully (or doesn't spawn)
- ✅ No crash or infinite loop
- ✅ Warning in console: "No valid path found"

---

## Test Suite 3: Enemy Movement

### Test 3.1: Speed Differences
**Steps:**
1. Spawn HEAVY enemy (press `3`)
2. Wait 1 second
3. Spawn FAST enemy (press `2`)
4. Compare movement speeds

**Expected:**
- ✅ FAST enemy catches up to HEAVY enemy
- ✅ FAST enemy overtakes HEAVY enemy
- ✅ Speed difference is visually obvious

### Test 3.2: Smooth Movement
**Steps:**
1. Spawn any enemy
2. Watch movement closely
3. Check animation frame rate

**Expected:**
- ✅ Enemy moves smoothly (no stuttering)
- ✅ No sudden jumps or teleports
- ✅ Movement looks natural
- ✅ Frame rate stays at ~60 FPS

### Test 3.3: Grid Alignment
**Steps:**
1. Spawn enemy
2. Observe path alignment with grid

**Expected:**
- ✅ Enemy follows grid lines
- ✅ Enemy centers on tiles as it passes
- ✅ No diagonal movement
- ✅ 4-directional movement only

---

## Test Suite 4: Multiple Enemies

### Test 4.1: 5 Enemies Simultaneously
**Steps:**
1. Rapidly press `E` key 5 times
2. Observe all enemies

**Expected:**
- ✅ All 5 enemies spawn
- ✅ All move independently
- ✅ No collision/interference
- ✅ All reach exit eventually
- ✅ Performance stays good

### Test 4.2: 20+ Enemies Performance
**Steps:**
1. Rapidly press `E` key 20+ times
2. Monitor performance
3. Check browser FPS counter (F12 -> Performance)

**Expected:**
- ✅ All enemies spawn successfully
- ✅ Frame rate stays above 30 FPS (ideally 60 FPS)
- ✅ No memory leaks
- ✅ No browser lag or freeze
- ✅ All enemies pathfind correctly

### Test 4.3: Mixed Enemy Types
**Steps:**
1. Spawn 3 BASIC, 3 FAST, 3 HEAVY enemies
2. Observe movement patterns

**Expected:**
- ✅ Different types move at different speeds
- ✅ FAST enemies reach exit first
- ✅ HEAVY enemies reach exit last
- ✅ All enemies eventually reach exit

---

## Test Suite 5: Edge Cases

### Test 5.1: Spam Spawning
**Steps:**
1. Hold down `E` key for 5 seconds
2. Observe behavior

**Expected:**
- ✅ Multiple enemies spawn rapidly
- ✅ No crashes or errors
- ✅ Performance degrades gracefully
- ✅ All enemies are tracked correctly

### Test 5.2: Tower Placement During Movement
**Steps:**
1. Spawn enemy
2. While enemy is moving, place tower on its current path
3. Observe behavior

**Expected:**
- ⚠️ Enemy continues on cached path (will pass through tower)
- ✅ Next spawned enemy will path around tower
- ✅ No crashes

**Note:** This is a known limitation. Future update should invalidate enemy paths when towers placed.

### Test 5.3: Exit Reached
**Steps:**
1. Spawn enemy
2. Wait for enemy to reach magenta exit tile
3. Observe cleanup

**Expected:**
- ✅ Enemy disappears at exit
- ✅ Enemy mesh removed from scene
- ✅ No memory leak (check with multiple spawns)
- ✅ No console errors

---

## Test Suite 6: Integration Tests

### Test 6.1: Tower + Enemy Interaction
**Steps:**
1. Place 3 towers in various locations
2. Spawn 5 enemies
3. Observe pathfinding

**Expected:**
- ✅ Enemies path around towers
- ✅ Different spawners may use different paths
- ✅ All enemies reach exit
- ✅ No enemies pass through towers

### Test 6.2: Camera Movement with Enemies
**Steps:**
1. Spawn 10 enemies
2. Use mouse to rotate/zoom camera
3. Observe rendering

**Expected:**
- ✅ Enemies remain visible during camera movement
- ✅ Enemies continue moving during camera manipulation
- ✅ No rendering artifacts
- ✅ Smooth camera controls

---

## Performance Benchmarks

### Benchmark 1: Pathfinding Speed
**Target:** Path calculation < 5ms per enemy

**Test:**
1. Open browser console (F12)
2. Clear cache (path cache)
3. Spawn enemy
4. Check console for timing (if logged)

### Benchmark 2: 20 Enemy Update
**Target:** 60 FPS with 20 enemies

**Test:**
1. Open Performance monitor (F12 -> Performance)
2. Start recording
3. Spawn 20 enemies
4. Wait for all to reach exit
5. Stop recording
6. Check FPS graph

**Expected:**
- ✅ FPS stays above 30 throughout
- ✅ Ideally maintains 60 FPS
- ✅ No frame drops below 30

### Benchmark 3: Memory Usage
**Target:** No memory leaks

**Test:**
1. Open Memory profiler (F12 -> Memory)
2. Take heap snapshot
3. Spawn and despawn 50 enemies
4. Force garbage collection
5. Take another heap snapshot
6. Compare

**Expected:**
- ✅ Memory returns to baseline after cleanup
- ✅ No retained enemy objects
- ✅ No leaked THREE.js meshes

---

## Automated Test Execution

### Run Unit Tests
```bash
npm test
```

**Expected Output:**
```
✔ Enemy Model tests: 25 passed
✔ Enemy Service tests: 45 passed
```

### Run Build
```bash
npm run build
```

**Expected:**
- ✅ Build succeeds
- ✅ No TypeScript errors
- ✅ No compilation warnings (except bundle size)

---

## Known Issues & Limitations

### Issue 1: Path Cache Not Invalidated
**Description:** When tower is placed, enemies already spawned continue on cached path

**Impact:** Medium - enemies may appear to pass through newly placed towers

**Workaround:** Only affects already-spawned enemies, new enemies path correctly

**Fix:** Planned - invalidate individual enemy paths when tower blocks their route

### Issue 2: Flying Enemies Same as Ground
**Description:** FLYING enemies respect tile traversability like ground units

**Impact:** Low - visual only, gameplay not affected yet

**Workaround:** None needed currently

**Fix:** Planned - flying enemies should ignore tower tiles

### Issue 3: All Enemies Spawn from Same Spawner
**Description:** Random spawner selection may repeatedly use same corner

**Impact:** Low - enemies still spawn and path correctly

**Workaround:** Manually varies with RNG

**Fix:** Future - round-robin spawner selection option

---

## Bug Reporting Template

If you find an issue, report using this template:

```markdown
### Bug: [Short Description]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**


**Actual Behavior:**


**Browser:** [Chrome/Firefox/Safari]
**Version:** [Browser version]
**Console Errors:** [Copy any errors]
**Screenshots:** [If applicable]
```

---

## Test Completion Checklist

- [ ] All Test Suite 1 tests passed
- [ ] All Test Suite 2 tests passed
- [ ] All Test Suite 3 tests passed
- [ ] All Test Suite 4 tests passed
- [ ] All Test Suite 5 tests passed
- [ ] All Test Suite 6 tests passed
- [ ] All Performance Benchmarks met
- [ ] Unit tests run successfully
- [ ] Build completes successfully
- [ ] No critical bugs found

**Tester Signature:** _________________
**Date:** _________________
