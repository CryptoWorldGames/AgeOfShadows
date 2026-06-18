# Age of Shadows — Bug Log

## ✅ Black Screen on Mobile (game canvas black, UI visible)
**Status:** FIX DEPLOYED — commit 007cf52

**Symptom:** UI panels (INFO/MENU/BUILD/ADMIN/CHAT/resources) render fine,
but the 3D game area is pure black — not even the sky-blue background shows.

**Root cause:** `renderer.render(scene, camera)` was the LAST statement in the
requestAnimationFrame loop. If ANY game-logic call before it threw (controls
update, units, animals, water, etc.), the frame aborted before painting. The
UI is built earlier in initializeGame(), so it stays visible while the canvas
never draws. Result: black screen + working UI.

**Fix pattern (REUSE THIS):**
- Never put render() behind un-guarded game logic.
- Wrap each per-frame subsystem in a try/catch (`safe(label, fn)`).
- ALWAYS call renderer.render() at the end of every frame.
- On first error, surface message+stack to an on-screen overlay for diagnosis.
- Guard one-time setup (createControls) the same way.

**Verify before pushing:** `cd client && npx vite build` must succeed.

---

## ✅ iPhone music mute not working — commit a38d579
Cause: iOS Safari doesn't reliably fire `click` on non-button divs.
Fix: add BOTH `click` and `touchend` listeners (addClickHandler helper).

## ✅ Units stop after 1 task — commit e4e8c3f
Cause: autoTask active but target became null with no re-search branch.
Fix: add else-if handlers to find next resource when target is null.

## ✅ Settings panel too small on mobile — commit 249fd86
Fix: width 95vw on mobile, max-height 90vh, overflow-y auto.

## ✅ Portrait UI overlap — commit cacf1c1 / Responsive.js
Fix: @media (orientation: portrait) reposition+scale panels; collapsible.

---

## ⚠ Lessons / Rules
- Deploy target is the `main` branch (Render watches main). Always push main.
- Before risky edits, the current main IS the backup. If broken, `git reset --hard <last-good>` and force-push.
- Verify `vite build` locally before pushing.
- Don't add CSS (e.g. overflow:auto) that can interfere with the full-screen WebGL canvas.
