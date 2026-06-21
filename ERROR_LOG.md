# Age of Shadows - Error Log & Learning Journal

**Purpose**: Track recurring bugs, performance issues, and lessons learned. Build institutional knowledge to improve code quality continuously.

## Error Patterns Found

### Pattern 1: Canvas Event Capture (CRITICAL - FIXED)
- **First Occurrence**: Session 2, Button clicks not working
- **Root Cause**: Three.js WebGLRenderer has `pointerEvents` enabled by default, capturing all clicks before reaching UI
- **Repeated Occurrences**: 0 (fixed first time)
- **Fix Applied**: Set `renderer.domElement.style.pointerEvents = 'none'` after canvas creation
- **Why It Worked**: Allows clicks to pass through canvas to DOM elements below
- **Lesson**: Always check canvas/renderer event handling when UI elements aren't responding
- **Prevention**: Add to initialization checklist - verify event propagation

### Pattern 2: BuildQueue Memory Loss (CRITICAL - FIXED)
- **First Occurrence**: Session 2, User lost 40 food on refresh
- **Root Cause**: BuildQueue only in memory, not persisted to database
- **Repeated Occurrences**: 0 (fixed comprehensively)
- **Fix Applied**: 
  1. Added `build_queue` JSONB column to PostgreSQL
  2. Updated savePlayerData() to include buildQueue
  3. Updated loadPlayerData() to restore buildQueue
  4. Modified auto-save to persist buildQueue every 30s
- **Why It Worked**: Database persistence survives disconnect/refresh
- **Lesson**: Any mutable game state that affects player must be persisted
- **Prevention**: Add to data model checklist - all resources/queues must be saved

### Pattern 3: Modal Close Button Not Working
- **First Occurrence**: Session 2, Close inventory button unresponsive
- **Root Cause**: Multiple attempts - inline onclick, addEventListener, event delegation all failed
- **Repeated Occurrences**: Still investigating
- **Attempts Made**: 
  1. `onclick = handler` - failed
  2. `addEventListener` - failed
  3. `event.stopPropagation()` - didn't help
  4. Backdrop click handler - didn't work
- **Current Status**: Need deeper investigation
- **Next Steps**: Check if modal content has pointer-events issues

### Pattern 4: Z-Index Layering Issues
- **First Occurrence**: Title behind inventory
- **Repeated Occurrences**: 1+ (similar issues)
- **Root Causes**:
  - Incorrect z-index hierarchy
  - Canvas rendering on top
  - Backdrop fullscreen coverage
- **Lesson**: Plan z-index strategy upfront: canvas (0), game UI (1000-2000), modals (9000+), toasts (10000+)
- **Prevention**: Use CSS variables for z-index values

## Performance Issues Identified

### Issue 1: Walk Animation Lag
- **Description**: Some characters move slowly or with stuttering
- **Potential Causes**: 
  - Animation speed calculation
  - Update frequency mismatch
  - Too many active animations
  - No animation frame rate limiting
- **Status**: Needs investigation
- **Investigation Date**: [TBD]

### Issue 2: Memory Leaks (Suspected)
- **Description**: Game might leak memory over time
- **Potential Causes**:
  - Event listeners not cleaned up
  - Three.js objects not properly disposed
  - Game loop accumulating references
  - DOM elements created but not removed
- **Status**: Needs profiling
- **Investigation Date**: [TBD]

### Issue 3: Inventory Modal Performance
- **Description**: Modal might cause frame drops when opened
- **Potential Causes**:
  - Large DOM tree creation
  - Backdrop animation
  - Event handler attachment
- **Status**: Monitor after fixes

## Audit Checklist (For Each Edit)

- [ ] Does this change introduce new event listener memory leaks?
- [ ] Are Three.js objects properly disposed?
- [ ] DOM elements properly removed on cleanup?
- [ ] Event propagation chain checked?
- [ ] Z-index hierarchy maintained?
- [ ] Performance impact measured?
- [ ] Does this fix repeat a previous error?
- [ ] Are there edge cases not handled?
- [ ] Is this change testable?
- [ ] Document the lesson learned

## Improvement Targets

### Performance Targets
- Walk animation: 60 FPS smooth
- Memory: < 150MB baseline
- Inventory open: < 16ms frame time
- No memory leak growth over 10 minutes

### Quality Targets
- Zero critical bugs repeat
- Every error gets root cause analysis
- 5-10 improvements per edit cycle
- Audit score improves per session
