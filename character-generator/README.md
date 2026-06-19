# Age of Shadows — Character Generator

A standalone, **fully offline** character creator for the game. It renders a
real-time 3D human you can customize with sliders and buttons — body, skin,
hair, beard, clothing, armor — and watch him **idle or walk** while holding
**nothing, a sword, an axe, or a mining pick**.

Three.js is vendored locally in `vendor/`, so this works with **no internet
connection** once you have the folder.

---

## Run it on Windows 10

You already have Node.js installed (the game uses it).

**Easiest way:** double-click **`start.bat`**. It starts the local server and
opens your browser to the generator.

**Or from a command prompt:**

```cmd
cd C:\Users\<you>\games\AgeOfShadows\character-generator
node serve.js
```

Then open your browser to:

```
http://localhost:8080
```

To use a different port: `node serve.js 3000`

Stop the server with **Ctrl+C** in the command window.

---

## Controls

**Camera (in the 3D view)**
- Left-drag: rotate around the character
- Right-drag: pan
- Mouse wheel: zoom

**Panel (right side)**
- **Pose & Equipment** — put a sword / axe / mining pick in his hand, switch
  between **Idle** and **Walking**, and set walk speed.
- **Body** — height, build/muscle, weight, shoulder width, head size, skin tone.
- **Hair & Face** — hair style + color, beard, eye color.
- **Clothing** — tunic / armor / bare top, colors for tunic, pants, boots,
  optional belt and cape.
- **Scene** — auto-rotate, ground grid, background color.

**Bottom buttons**
- **Reset** — back to defaults.
- **Copy Config** — copies the full character setup as JSON to your clipboard.
  Paste that to me and I'll bake the exact look into the game.
- **Snapshot** — saves a PNG of the current view.

---

## How this becomes the in-game character

This is a design tool. When the man looks the way you want:

1. Click **Copy Config** and paste the JSON back to me, **or** just tell me the
   sliders/toggles you set.
2. I'll translate that into the game's character module
   (`client/src/modules/Human.js`) so units in Age of Shadows match the look,
   including the held-tool poses (sword / axe / mining pick) and the walk cycle.

The generator is intentionally self-contained and separate from the game so you
can iterate on the look fast without touching the live build.

---

## Files

| File | What it is |
|------|------------|
| `index.html` | The whole generator (UI + 3D scene + rig + animation) |
| `serve.js` | Tiny zero-dependency local web server |
| `start.bat` | Windows one-click launcher |
| `vendor/three.module.js` | Three.js (vendored, offline) |
| `vendor/OrbitControls.js` | Camera controls (vendored, offline) |
