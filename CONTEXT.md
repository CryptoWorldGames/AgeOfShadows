# Age of Shadows — Session Context
**Last updated:** 2026-06-13

## What We Are Building
A browser-based 3D multiplayer RTS game (Age of Empires style) built with:
- **Backend:** Node.js + Express on port 5006
- **Frontend:** React + Vite on port 5173
- **3D Engine:** Three.js with GLTFLoader for characters
- **GitHub:** https://github.com/CryptoWorldGames/AgeOfShadows

## File Structure
C:\Users\[user]\games\AgeOfShadows\
├── server.js              (Express backend, port 5006)
├── manager.js
├── package.json
├── .env                   (APP_PORT=5006 — never commit)
├── .gitignore
├── CONTEXT.md             (this file)
└── client\
    ├── vite.config.js     (proxy /api to localhost:5006)
    ├── package.json
    └── src\
        ├── main.jsx       (NO StrictMode — causes double render)
        ├── App.jsx        (joins /api/join, polls /api/state every 1s)
        ├── GameScene.js   (renderer + imports — use Python writer to save)
        └── modules\
            ├── Environment.js   (ground, sky, lighting, grid)
            ├── Human.js         (loads GLB via GLTFLoader)
            ├── Controls.js      (OrbitControls + WASD + click-select + right-click-move)
            └── UI.js            (bottom-left HUD pill)
    └── public\
        ├── models\
        │   └── balkan__cs2_agent_model_dragomir_no1.glb  (NOT in git - CC Attribution)
        └── sounds\
            └── pensieri_profondi_scuba-ok-274157.mp3     (NOT in git)

## Starting the Game
Two separate cmd windows:
Window 1: cd C:\Users\[user]\games\AgeOfShadows && npm run server:dev
Window 2: cd C:\Users\[user]\games\AgeOfShadows\client && npm run dev
Browser: http://localhost:5173
Health check: curl http://localhost:5006/health

## If Server Crashes with EADDRINUSE
netstat -ano | findstr :5006
taskkill /PID <LISTENING_PID> /F
DO NOT use taskkill /F /IM node.exe — other node projects may be running.

## GameScene.js MUST use Python writer
Notepad++ corrupts JSX. Always write via:
python C:\Users\[user]\write_gamescene.py
The write_gamescene.py file lives at C:\Users\[user]\write_gamescene.py

## Editing Other Files
Controls.js, Human.js, Environment.js, UI.js — edit directly in Notepad++:
"C:\Users\[user]\Downloads\Notepad++\notepad++.exe" C:\Users\[user]\games\AgeOfShadows\client\src\modules\Controls.js

## Current Game State
- Server + Vite running clean at localhost:5006 and localhost:5173
- Real GLB character loaded with shadow
- OrbitControls: left-drag=rotate, right-drag=pan, scroll=zoom toward cursor
- WASD=move camera, Q/E=up/down
- Left-click character = green selection ring appears
- Drag mouse = green selection box drawn on screen
- Right-click ground when selected = orange arrow marker + ok sound + character walks there
- React StrictMode removed (was causing double canvas)
- Restore point committed to GitHub

## What Needs Fixing Next Session
1. Click-to-select from far away — project character center (y=1.0) to screen space,
   use fixed pixel radius 20-30px instead of raycasting mesh directly
2. Drag box select — project character center (y=1.0) not feet (y=0) when checking
   if inside selection box
3. Walking animation — check gltf.animations in Human.js, trigger walk clip when
   moving, idle when stopped

## Session Rules
- Always give full file code, never partial edits
- GameScene.js via Python writer only
- Give cmd to open file BEFORE giving code to paste
- One command at a time
- Windows paths only
- When killing node by port: taskkill /PID <pid> /F

## Sound Credits (must appear in game credits page)
- ok sound: MARCELLO (Pensieri_Profondi_Scuba) from Pixabay
  https://pixabay.com/users/pensieri_profondi_scuba-47530910/
  File: pensieri_profondi_scuba-ok-274157.mp3

## Character Model Credits (must appear in game credits page)
- Balkan CS2 Agent Dragomir by gettan on Sketchfab (CC Attribution)
  Must credit when game is published publicly.

## Bug History
See AgeOfShadows_BugLog.md for all bugs fixed in first session.