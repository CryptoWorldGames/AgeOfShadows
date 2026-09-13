# Cycloidal Knee Actuator — parametric FreeCAD generator

Single-stage cycloidal reducer in a 100 mm × 80 mm can, for a 6 ft / ~100 lb
humanoid. One per knee.

## Run it (Windows)

1. Copy `cycloidal_knee_actuator.FCMacro` to
   `%APPDATA%\FreeCAD\Macro\`
2. FreeCAD → **Macro → Macros…** → select it → **Execute**.

It builds the model, prints a spec + warning block to the Report view, then
walks the camera through **top → front → side → isometric → bottom**, holding
`view_pause` seconds on each. PNGs land in `Documents\knee_actuator_out\`.

Or paste into the FreeCAD Python console:

```
exec(open(r"C:\Users\<you>\AppData\Roaming\FreeCAD\Macro\cycloidal_knee_actuator.FCMacro").read())
```

## Parameters

Everything lives in the `P` dict at the top of the macro. Edit, re-run — the
document is closed and rebuilt from scratch each time.

| Key | Default | Notes |
|---|---|---|
| `housing_od` / `housing_h` | 100 / 80 | the envelope |
| `lobes` | 50 | reduction ratio = `lobes`:1; ring pins = `lobes` + 1 |
| `ecc` | 0.6 | eccentricity — see the warning below |
| `bore_r` | 40 | ring pin circle radius |
| `pin_r` | 1.6 | ring pin radius |
| `out_pins` / `out_pin_r` | 6 / 3.0 | 6 mm roller bearings |
| `out_shaft_r` | 3.0 | 6 mm output shaft |
| `mount_bolts` / `mount_bcd_r` | 4 / 44 | M4 clearance holes in the base flange |
| `export_stl` | False | set True to dump per-part STLs |
| `view_pause` | 1.6 | seconds per camera angle |

## Stackup (z from the bottom of the base flange)

```
 0.0 – 5.0   base flange, 4× M4 + cable pass-through
 5.0 – 45.0  motor bay (2212-class 1000KV, 28 mm can)
45.0 – 48.0  gearbox floor plate + input bearing seat
48.0 – 61.0  two cycloid discs, 6 mm each, 180° apart
62.0 – 70.0  output plate + 6 roller pins
70.0 – 98.0  6 mm output shaft (18 mm proud of the 80 mm rim)
```

## Read this before printing

**50:1 in one stage at this diameter is at the edge of what FDM PLA can hold.**
The macro prints this as a warning. With `lobes = 50` on a 40 mm pin circle:

- eccentricity is **0.6 mm** — smaller than typical FDM dimensional error, so
  backlash and tolerance stack will dominate the mesh;
- ring pins land **4.93 mm** apart with only **1.73 mm** of wall between them;
- the lobe amplitude is **1.2 mm** peak-to-valley.

Two ways out, both a one-line change:

```python
# A. keep one stage, drop the ratio — much more forgiving to print
"lobes": 25, "ecc": 1.2, "pin_r": 2.5,   # -> 25:1

# B. keep 50:1, run two 7:1-ish stages (needs a second disc set; not generated yet)
```

The undercut guard is `bore_r / (ecc * n_pins) > 1`. At the defaults it is
**1.31**, which is safe; push `ecc` up without dropping `lobes` and the profile
self-intersects. `check()` catches this and every other collision case before
anything is built.

## Bill of materials (per actuator, approx.)

| Item | Qty | ~USD |
|---|---|---|
| 1000KV BLDC (2212 class) | 1 | 18 |
| ESC | 1 | 15 |
| AS5600 magnetic encoder | 1 | 6 |
| 608 bearings (input/output) | 2 | 4 |
| 6 mm roller bearings | 6 | 12 |
| 3 mm ring pin stock / dowel | 1 | 5 |
| PLA filament | ~180 g | 6 |
| M4 / M3 hardware | — | 8 |
| | | **~74** |
