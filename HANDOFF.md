# AGE OF SHADOWS — Master Build & Handoff Prompt

> Paste this entire document to another AI to continue development. It contains the
> full vision, current state, exact file locations, how to run it, the database/API
> setup, the network protocol, known bugs, and the complete roadmap.

---

## 0. WHO YOU ARE / WHAT TO DO
You are continuing development of an existing, working browser-based multiplayer
RTS game called **Age of Shadows**, plus a companion **3D Character Creator** tool.
Do **not** rebuild from scratch. Read the existing code, keep the current
architecture and art style, fix the listed bugs, and build the roadmap features in
order. Always give COMPLETE files (never "add this snippet"). Test the server logic
with Node, and tell the user exactly how to test the visual/multiplayer parts in
their browser (the AI cannot see the 3D output).

---

## 1. THE VISION
- A browser-based 3D multiplayer real-time strategy game (Age of Empires / RTS
  style) set in a dark-fantasy / medieval-survival world.
- **Everything must be server-authoritative** ("all on the server"): one shared
  world that every player sees identically. If player 1 chops a tree, player 2 sees
  it fall. Resources, units, buildings, combat, trade — all owned by the server.
- Workers ("the man") gather resources autonomously and **keep working 24/7 even
  when the player is offline/AFK/logged out**. Progress persists.
- Players can fight each other, trade, build, and command units.
- Ownership rule: a felled/dropped resource belongs to whoever produced it for **5
  minutes**, then becomes free-for-all so players can fight over it.
- A separate **Character Creator** tool (localhost) lets the user design realistic
  human characters (load GLB models, recolor, equip weapons, animate, rig) and
  export them for use in the game and in real PC game engines (Godot/Unity/Unreal).
  **GLB/glTF is the primary character format** (lightweight, browser + engine
  friendly). FBX is import-only (for Mixamo). Never export FBX.

---

## 2. TECH STACK
- **Backend:** Node.js + Express + Socket.IO. Single server process. Port **5006**.
- **Frontend:** React + Vite, Three.js (3D). Dev port **5173**; in production the
  Express server serves the built client from `client/dist`.
- **Database:** PostgreSQL via the `pg` package. Connection via `DATABASE_URL`.
- **3D:** Three.js r0.160, `GLTFLoader`, `FBXLoader`, `AnimationMixer`,
  `OrbitControls`, `Box3`.
- **Auth:** bcryptjs password hashing; email via nodemailer (optional).
- Root deps: `axios, bcryptjs, cors, dotenv, express, nodemailer, pg, socket.io, uuid`.

---

## 3. WHERE THE CODE LIVES & HOW TO RUN IT
- **GitHub:** `https://github.com/CryptoWorldGames/AgeOfShadows`
- **Active branch:** `claude/youthful-planck-10tq4q` (also merged into `main` —
  both point at the same latest commit).
- **Local working folder (Windows):** `C:\Users\mycry\games\AgeOfShadows`
  - IMPORTANT: there is a SECOND stale clone at `C:\Users\mycry\AgeOfShadows` that
    has an EMPTY `.env` (no database). **Always use the `games\AgeOfShadows`
    folder** — it has the real `.env` with the database connection.

### Run it (single window — production-style, what works)
```cmd
cd /d C:\Users\mycry\games\AgeOfShadows
npm install            REM installs SERVER deps (bcryptjs, express, pg, socket.io...) — REQUIRED, npm start does NOT do this
npm start              REM builds the client (client npm install + vite build) then runs node server.js
```
Then open **http://localhost:5006**.

### Run it (two windows — live-reload dev)
```cmd
REM window 1 (server, auto-restart):  needs root `npm install` first
cd /d C:\Users\mycry\games\AgeOfShadows && npm run server:dev
REM window 2 (client, hot reload):    needs `npm install` inside client\ first
cd /d C:\Users\mycry\games\AgeOfShadows\client && npm run dev
```
Then open **http://localhost:5173**.

### Common gotchas
- `'nodemon' / 'vite' is not recognized` → dependencies not installed. Run
  `npm install` in the root and in `client\`.
- `Cannot find module 'bcryptjs'` → root deps not installed; run `npm install` in
  the game root.
- `Failed to initialize database` / `injected env (0)` → the `.env` is missing or
  has no `DATABASE_URL`. The real `.env` is in `games\AgeOfShadows`.

---

## 4. ENVIRONMENT (.env) & DATABASE
`.env` lives in the project root and is **gitignored** (never committed). Required:
```
DATABASE_URL=postgres://USER:PASS@HOST:PORT/DBNAME   # PostgreSQL connection string (hosted, e.g. Neon/Render; uses SSL)
PORT=5006
APP_URL=http://localhost:5173
ADMIN_EMAIL=the_admins_email@example.com
# optional email (else Ethereal test):
# SENDGRID_API_KEY=...  OR  GMAIL_EMAIL=... + GMAIL_APP_PASSWORD=...
EMAIL_FROM=noreply@ageofshadows.game
```
- `database.js` creates two tables on startup if missing: **`users`** (id, email,
  display_name, password_hash, verification/reset tokens, profile JSONB,
  wants_emails) and **`players`** (user_id, resources JSONB, units JSONB, buildings
  JSONB, last_saved).
- If you want it to run with **no database**, you must add a JSON-file/in-memory
  fallback in `database.js` + `auth.js` (all data access goes through
  `query(sql, params)` and the `auth.js` functions). This is currently NOT done.

---

## 5. FULL FILE MAP
```
AgeOfShadows/
├─ server.js              Express + Socket.IO server, API, world state, SIMULATION TICK
├─ worldsim.js            PURE authoritative world logic (trees + worker sim). UNIT-TESTED.
├─ worldsim.test.js       Node tests for worldsim (run: `node worldsim.test.js`, 12 passing)
├─ auth.js                User auth + player data load/save (all DB access)
├─ database.js            pg Pool + schema init + query()
├─ email.js               nodemailer (verification / reset emails)
├─ manager.js             (dev helper)
├─ package.json           scripts: start, server, server:dev, build:client
├─ .env                   (gitignored) DATABASE_URL etc.
├─ CONTEXT.md             session notes / history
├─ CREDITS.txt            asset credits (MUST keep — model + sound licenses)
├─ characters/            source GLB models (peasant variants; also used by creator)
├─ client/
│  ├─ vite.config.js      proxies /api and /socket.io to localhost:5006
│  ├─ package.json        client deps (three, react, vite, socket.io-client)
│  └─ src/
│     ├─ main.jsx         entry (NO React.StrictMode — caused double canvas)
│     ├─ App.jsx          auth screens + mounts GameScene
│     ├─ GameScene.jsx    THREE scene, socket wiring, render loop, world object
│     └─ modules/
│        ├─ Human.js      THE WORKER: loads GLB, procedural bone rig, animation, serverDriven follow
│        ├─ Tree.js       tree visual + applyServer() (server-driven state)
│        ├─ Controls.jsx  camera + selection + click commands (emits commandMove/Gather/Deposit)
│        ├─ Building.js    Town Center / house / fences (construction bars/timers)
│        ├─ Animal.js      chickens / deer
│        ├─ Stone.js / Gold.js   stone & gold deposits (still CLIENT-side random)
│        ├─ Environment.js ground, sky, water, pond, lighting, grid
│        ├─ UI.js          HUD, resource bar, town-center modal, build button, music player
│        ├─ Settings.js    tuning constants (unit speed, ranges, yields, respawn times)
│        └─ Responsive.js  mobile/responsive UI
└─ character-generator/   STANDALONE localhost 3D character creator (separate from the game)
   ├─ index.html          the creator (loads real rigged GLB/FBX, recolor, weapons, AI prompt, rig wizard)
   ├─ procedural.html     older sphere/capsule procedural builder (kept for reference)
   ├─ serve.js            zero-dependency static server (node serve.js → http://localhost:8080)
   ├─ start.bat           Windows one-click launcher
   ├─ vendor/             three.module.js, OrbitControls.js, GLTFLoader.js, FBXLoader.js, fflate, NURBS*
   └─ models/             peasant_realistic.glb, peasant_modular.glb, (drop custom.glb / custom.fbx here)
```

---

## 6. NETWORK PROTOCOL (Socket.IO) — current
**Client → Server:**
- `join {userId}` → server loads/creates player, replies `joined {playerId, player, world}`
- `commandMove {unitIds, x, z}` → walk units there, then resume auto-work
- `commandGather {unitIds, treeId}` → send units to chop a specific tree
- `commandDeposit {unitIds}` → make units carry their load to the town center now
- `chopTree {treeId}` / `gatherWood {treeId, unitId}` → manual chop/gather (server arbitrates ownership)
- `depositBuilding {buildingId, buildingType, resources}` → bank carried load (Town Center = 50% tax)
- `placeBuilding {type, x, z}` → place a building (NOT yet cost-validated/persisted server-side)
- `chat {playerName, message}`
- `unitMove {unitId, x, z}` (legacy; positions are now server-owned)
- `resourceSync` (ignored — was the old client-clobber bug)

**Server → Client:**
- `joined`, `joinError`
- `worldUpdate {players, buildings}` every 100ms (all players' unit positions)
- `treesUpdate [trees]` — authoritative tree state deltas (chop/fall/woodpile/respawn)
- `resourceUpdate {resources}` — the player's authoritative stockpile
- `depositResult {banked, isTownCenter, stockpile}`
- `woodGathered`, `gatherDenied`, `buildingPlaced`, `chatMessage`, `playerLeft`

**HTTP API (Express):** `/api/register`, `/api/login`, `/api/forgot-password`,
`/api/verify-email`, `/api/profile` (GET/POST), `/api/delete-account`,
`/api/reset-password`, `/api/spawn-worker`, `/api/wallet`, `/api/buy-currency`,
`/api/market` (GET), `/api/market/list`, `/api/market/buy`, `/api/admin/login`,
`/api/admin/stats`, `/api/admin/wipe-player`, `/api/admin/gift-resources`,
`/api/join`, `/api/state/:playerId`, `/health`.

---

## 7. CURRENT STATE — WHAT IS DONE
**Server-authoritative (DONE & tested):**
- `worldsim.js` owns the shared **forest**: tree generation (100 trees, spaced, off
  the town center, avoiding the pond), and the tree state machine
  `standing → falling → woodpile → respawning → standing` with ownership + the
  5-minute free-for-all rule and **taxed deposits** (Town Center −50%).
- **Worker simulation (`worldsim.stepUnit`)**: each unit walks to the nearest
  workable tree, fells it, **waits for it to fall**, gathers the woodpile, fills up
  (carryMax), walks to the town center, deposits into the player's persistent
  stockpile, repeats. Supports a manual `cmd` (move/gather/deposit) that overrides
  auto behavior.
- `server.js` runs a **250ms simulation tick** over EVERY player's units, **online
  or offline**, so workers keep gathering while logged out. Stockpile pushed to
  connected owners and autosaved to the DB every 30s.
- On disconnect the player is kept (`online:false`) so its workers keep running;
  **reconnect resumes the exact live state** (no lost offline progress); offline
  players are garbage-collected after 1 hour.
- **Client renders the server world**: trees come from the server (`Tree.applyServer`
  reflects authoritative state); owned units follow server positions
  (`Human.js` `serverDriven` path) and animate walk/idle; the client no longer runs
  local worker AI or pushes positions.
- Resources/stockpile persist and show in the **Town Center modal** (click it).
- Workers spawn ~20 units **in front** of the town center (not on top of it).
- **Chat** is already server-broadcast.
- Manual **click commands** work again (right-click move, click tree to gather,
  click town center to deposit) via the socket commands above.

---

## 8. KNOWN BUGS / NEEDS VERIFICATION (fix first)
1. **Arms T-pose:** the in-game character model loads in a T-pose. `Human.js` tries
   to lower the upper arms by rotating `rest.armUL/armUR` (bones `arm_upper_l_28`,
   `arm_upper_r_55`) about the X axis by ~1.25 rad — **the exact axis/sign is
   unverified** and may still look wrong. `Human.js` logs `[rig] bones found: ...`
   to the console — use that to confirm the arm bones exist and tune the rotation.
   The model also has bones `leg_upper_l_65, leg_lower_l_63, leg_upper_r_70,
   leg_lower_r_68, spine_2_58`, and right hand `hand_r_49` (weapons attach here).
2. **Walking-in-place / animation gating:** verify the worker only plays the walk
   cycle while actually moving (driven by server position delta in the
   `serverDriven` branch of `Human.js update()`).
3. **Worker loop end-to-end:** verify on a real browser that a worker fells a tree,
   gathers, carries to the town center, and the town-center total goes UP — and
   that it grows while logged out for a minute.
4. Stone/Gold/Animals are still client-side random objects; clicking them currently
   just walks the unit there (no server gathering yet).

---

## 9. ROADMAP — BUILD IN THIS ORDER
1. **Stone, gold, food/animals on the server** — mirror the tree pattern in
   `worldsim.js`: generate + tick + harvest server-side; extend `stepUnit` to
   support task types (wood/stone/gold/hunt); client renders them like trees.
2. **Build system server-authoritative** — `placeBuilding` must charge cost,
   validate placement/collision, run a construction timer (workers walk over and
   build), persist buildings, and broadcast. Town Center, houses, fences.
3. **Manual task assignment** — let the player set a unit's job (which resource) as
   a server command, not just move/gather one tree.
4. **Trade** — wire the existing `/api/market` REST marketplace into live play:
   player-to-player offers, escrow, real-time updates.
5. **Combat / PvP** — unit combat stats, attack commands, damage on the tick,
   death/respawn, and dropped-loot using the same 5-min ownership rule.
6. **Inventory/items** (optional depth) — real item objects beyond resource counts.

For each: keep `worldsim.js` PURE and unit-tested; keep the server the single
source of truth; keep the client a renderer + input sender.

---

## 10. THE CHARACTER CREATOR (separate tool) — SPEC & STATE
**Run:** double-click `character-generator/start.bat` (or `node serve.js`) →
**http://localhost:8080**. Fully offline (Three.js vendored). `.glb` is served with
the right MIME type by `serve.js`.

**Done:**
- Loads a **real rigged 3D human** (default "Operator" = the game's realistic
  model, loaded from R2; fallbacks: peasant GLB, modular GLB, or a user `custom.glb`
  / `custom.fbx`). Auto-frames the camera to fit any model size. Defaults to a clean
  T-pose; hides junk "eye/test" animation clips.
- **Recolor any part** (per-material color swatches, works on any model's mesh names).
- **Weapons in hand** (procedural): sword, axe, pick, mace, spear, dagger, bow,
  staff, torch, **pistol, rifle**. They glue to the detected right-hand bone, sized
  to the character, standing upright in the fist by default.
- **Per-weapon placement memory** (each weapon remembers its own Spin/Tilt/Roll/
  Size/Move) + explicit Save button.
- **Action preview:** Swing (Overhead/Horizontal/Diagonal) for melee, Fire (muzzle
  flash + 1-second bullet tracer line + travelling bullet) for guns; the Speed
  slider = slow motion.
- **AI Prompt box** (`applyPrompt(text)`): plain-English, rule-based, OFFLINE —
  understands colors+parts ("dark green shirt"), height ("taller"/"1.9m"), weapons
  ("give him a rifle"), animation ("walk"/"t-pose"). Expandable to a real LLM API
  later.
- **Rig Wizard:** lists every bone, lets you pick which bone a weapon attaches to,
  Auto-seat button.
- **Auto-save** to `localStorage` (placement + colors persist across refreshes).
- Copy Config (JSON), Snapshot (PNG).

**Roadmap for the creator (from the user's detailed spec):**
- GLB **file import** via FileReader/`URL.createObjectURL` (drag your own model in).
- **Rich JSON character schema** (id, name, baseModel, appearance{colors,hat,
  accessory,weapon}, animation{clip,speed}, rig{hasSkeleton,humanoidMap}, stats
  {health,stamina,strength,speed,intelligence,charisma}, gameData, timestamps).
- **Save/Load/Duplicate/Delete** multiple characters (localStorage/IndexedDB).
- **AI-assisted rigging:** Analyze Rig, Check Animation Compatibility, **Auto-Map
  Humanoid Bones** (Hips/Spine/Chest/Neck/Head/Left|RightUpperArm/LowerArm/Hand/
  UpperLeg/LowerLeg/Foot) with manual correction, export rig report + bone-map JSON.
  (Honest limit: true auto-rigging of an UNrigged mesh needs Mixamo/Blender — build
  the ASSISTANT, not a magic rigger.)
- **GLB optimization stats** (triangle/mesh/material/texture/bone counts, file size,
  embedded textures) + warnings (too heavy / no skeleton / no clips).
- **Mesh inspector**: click a mesh → assign it to a part category; save mesh→part
  mappings (GLB sources name meshes differently).
- **GLB export** via Three.js `GLTFExporter` (optional; heavy — default to JSON
  config export + reference to the source GLB, which is the lightweight path).
- Engine bridge notes: GLB imports into **Godot** (native), **Unity** (glTFast),
  **Unreal** (native); the exported humanoid bone-map JSON helps engine retargeting.
- Recommended setup: **plain Three.js (+ optional Vite)**, NOT React Three Fiber.

---

## 11. ASSETS / CREDITS (must preserve — see CREDITS.txt)
- In-game character model: a CS2-style operator GLB hosted at
  `https://pub-9e79279ca165496da153d64ecb88f99c.r2.dev/balkan__cs2_agent_model_dragomir_no1.glb`
  (CC Attribution — "Balkan CS2 Agent Dragomir" by gettan on Sketchfab). Bone names
  above; skin material `tm_balkan_v2_head_varianta.001`.
- Sounds in `client/public/sounds/` (medieval/lofi tracks + an "ok" SFX). Keep the
  Pixabay/artist credits in the game's credits page.

---

## 12. RULES FOR THE CONTINUING AI
- Server is the single source of truth; the browser is a renderer + input sender.
- Keep `worldsim.js` pure and unit-tested; run `node worldsim.test.js` after changes.
- You CANNOT see the 3D/multiplayer — verify server logic with Node, then give the
  user precise browser test steps.
- Always deliver COMPLETE files. Never "same as before" or partial snippets.
- Don't break the dark-fantasy UI/art style. Keep GLB as the character format.
- Commit with clear messages; develop on a feature branch; the user runs from
  `C:\Users\mycry\games\AgeOfShadows` and tests at localhost:5006 (game) /
  localhost:8080 (creator).
```
