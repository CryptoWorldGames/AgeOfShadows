## BUG: Character not clickable / box-select missing him (FIXED 2026-06-13)
**Symptom:** Clicking the character only worked sometimes. Box-select drew the green box but rarely selected him. Got worse when zoomed far out.

**Root cause:** Coordinate system mismatch. The code used `window.innerWidth/innerHeight` to convert mouse position to 3D space, but the canvas was NOT the full window size (devtools docked, sidebars, etc). So the projected character position (e.g. screenX=558) didn't match where he actually was on canvas (~165). Every hit-test compared wrong numbers.

**Fix (Controls.js):**
1. Added `getRect()` using `renderer.domElement.getBoundingClientRect()` — gets the canvas's REAL position and size.
2. All mouse→3D conversion now uses `rect.left/top/width/height` instead of `window.innerWidth/height`.
3. Character projection now adds `rect.left/top` so screen coords match `clientX/clientY`.
4. Single click now does BOTH: raycast the body mesh (click anywhere on him) AND a 35px center-radius fallback (for far away when the mesh is tiny).
5. Box-select projects character center using the same corrected rect math.

**Lesson:** NEVER use `window.innerWidth/innerHeight` for raycasting. ALWAYS use the canvas's `getBoundingClientRect()`.