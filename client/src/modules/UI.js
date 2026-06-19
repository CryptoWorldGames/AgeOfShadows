import { SETTINGS } from './Settings.js';

let globalSocket = null;
// Track the active music player so a second createUI() can't leave a duplicate
// audio element playing on top of the first.
let activeMusicAudio = null;

// Remove any previously-created HUD panels so building the UI again can never
// stack a second copy (duplicate Town Center button, music player, etc.).
function clearExistingHUD() {
  ['login-panel','hud','resource-bar','selected-panel','build-bar','build-menu',
   'music-tab','music-panel','chat-panel'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  if (activeMusicAudio) {
    try { activeMusicAudio.pause(); activeMusicAudio.src = ''; } catch (e) {}
    activeMusicAudio = null;
  }
}

export function showInventoryModal(resources) {
  const existingModal = document.getElementById('inventory-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'inventory-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;`;

  const resGrid = Object.entries(resources).map(([res, amt]) =>
    `<div style="padding:12px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;"><div style="font-size:11px;opacity:0.7;">${res.toUpperCase()}</div><div style="font-size:18px;font-weight:600;color:#c8a84b;margin-top:4px;">${amt}</div></div>`
  ).join('');

  modal.innerHTML = `
    <div style="background:rgba(0,0,0,0.9);border:1px solid rgba(200,168,75,0.4);border-radius:12px;padding:24px;width:90%;max-width:500px;color:#fff;font-family:'Segoe UI',sans-serif;">
      <h2 style="margin:0 0 20px;color:#c8a84b;font-size:20px;">Inventory</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;margin-bottom:20px;">${resGrid}</div>
      <button id="close-inventory" style="width:100%;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('close-inventory').onclick = () => modal.remove();
}

export function showHouseModal(socket, userId) {
  const existingModal = document.getElementById('house-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'house-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;`;
  modal.innerHTML = `
    <div style="background:rgba(0,0,0,0.9);border:1px solid rgba(200,168,75,0.4);border-radius:12px;padding:24px;width:90%;max-width:400px;color:#fff;font-family:'Segoe UI',sans-serif;">
      <h2 style="margin:0 0 20px;color:#c8a84b;font-size:20px;">🏛️ Town Center</h2>
      <div style="margin-bottom:16px;padding:12px;background:rgba(200,168,75,0.1);border-radius:6px;font-size:12px;">
        <div style="margin-bottom:8px;"><strong>Spawn Worker</strong></div>
        <div style="opacity:0.7;margin-bottom:12px;">Cost: 1000🍖 500🪵 200⛏️ 50💰</div>
      </div>
      <button id="spawn-worker-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #c8a84b, #ffd700);border:none;border-radius:4px;color:#000;font-weight:600;cursor:pointer;margin-bottom:8px;">Spawn Worker</button>
      <button id="close-house" style="width:100%;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('spawn-worker-btn').onclick = async () => {
    const res = await fetch('/api/spawn-worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    alert(data.message || (data.success ? 'Worker spawned!' : data.error));
    modal.remove();
  };

  document.getElementById('close-house').onclick = () => modal.remove();
}

export function showBuildMenu(onBuildSelect) {
  const existingModal = document.getElementById('build-menu-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'build-menu-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const textSize = isMobile ? '14px' : '18px';
  const labelSize = isMobile ? '12px' : '14px';
  const costSize = isMobile ? '11px' : '13px';
  const padding = isMobile ? '12px' : '16px';

  modal.innerHTML = `
    <div style="background:rgba(0,0,0,0.95);border:2px solid #c8a84b;border-radius:12px;padding:24px;width:90%;max-width:400px;color:#fff;font-family:'Segoe UI',sans-serif;">
      <h2 style="margin:0 0 20px;color:#c8a84b;font-size:24px;text-align:center;font-weight:700;">BUILD</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <button id="build-house" style="padding:${padding};background:rgba(100,200,100,0.2);border:2px solid rgba(100,200,100,0.5);border-radius:6px;color:#fff;font-size:${textSize};font-weight:600;cursor:pointer;transition:all 0.2s;">
          <div style="font-size:${labelSize};margin-bottom:6px;text-align:left;">House</div>
          <div style="font-size:${costSize};opacity:0.8;text-align:left;">100 Wood  -  3 min</div>
        </button>
        <button id="build-wood-fence" style="padding:${padding};background:rgba(139,100,50,0.2);border:2px solid rgba(139,100,50,0.5);border-radius:6px;color:#fff;font-size:${textSize};font-weight:600;cursor:pointer;transition:all 0.2s;">
          <div style="font-size:${labelSize};margin-bottom:6px;text-align:left;">Wood Fence</div>
          <div style="font-size:${costSize};opacity:0.8;text-align:left;">10 Wood  -  10 sec</div>
        </button>
        <button id="build-stone-fence" style="padding:${padding};background:rgba(150,150,150,0.2);border:2px solid rgba(150,150,150,0.5);border-radius:6px;color:#fff;font-size:${textSize};font-weight:600;cursor:pointer;transition:all 0.2s;">
          <div style="font-size:${labelSize};margin-bottom:6px;text-align:left;">Stone Fence</div>
          <div style="font-size:${costSize};opacity:0.8;text-align:left;">50 Stone  -  20 sec</div>
        </button>
      </div>
      <button id="close-build-menu" style="width:100%;padding:10px;margin-top:16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('close-build-menu').onclick = () => modal.remove();
  document.getElementById('build-house').onclick = () => { onBuildSelect('house'); modal.remove(); };
  document.getElementById('build-wood-fence').onclick = () => { onBuildSelect('woodFence'); modal.remove(); };
  document.getElementById('build-stone-fence').onclick = () => { onBuildSelect('stoneFence'); modal.remove(); };
}

export function showTownCenterModal(building, stockpile) {
  const existingModal = document.getElementById('town-center-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'town-center-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;`;

  // Show the player's OWN persistent stockpile (the server-authoritative bank
  // that deposits land in). This is "MY RESOURCES" — what you've banked here.
  const stock = stockpile || { wood: 0, food: 0, water: 0, gold: 0, stone: 0 };
  const ICONS = { wood: '🪵', food: '🍖', water: '💧', gold: '💰', stone: '⛏️' };
  const order = ['wood', 'food', 'water', 'stone', 'gold'];
  const banked = order.reduce((a, k) => a + (stock[k] || 0), 0);

  const resGrid = order.map(res =>
    `<div style="padding:10px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;">
      <div style="font-size:10px;opacity:0.7;">${ICONS[res] || ''} ${res.toUpperCase()}</div>
      <div style="font-size:18px;font-weight:700;color:#c8a84b;">${Math.floor(stock[res] || 0)}</div>
    </div>`
  ).join('');

  modal.innerHTML = `
    <div style="background:rgba(0,0,0,0.95);border:2px solid #ffd700;border-radius:12px;padding:24px;width:90%;max-width:500px;color:#fff;font-family:'Segoe UI',sans-serif;">
      <h2 style="margin:0 0 8px;color:#ffd700;font-size:22px;text-align:center;">🏛️ TOWN CENTER</h2>
      <div style="text-align:center;font-size:13px;color:#fff;margin-bottom:14px;">Your banked resources</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin-bottom:16px;">${resGrid}</div>
      <div style="text-align:center;margin-bottom:18px;padding:10px;background:rgba(255,215,0,0.1);border-radius:6px;border:1px solid rgba(255,215,0,0.3);">
        <div style="font-size:12px;color:#ffd700;font-weight:700;margin-bottom:4px;">⚠️ 50% TAX ON DEPOSITS</div>
        <div style="font-size:11px;opacity:0.8;">Workers depositing here keep only half. Build your own house to store tax-free.</div>
        <div style="font-size:10px;opacity:0.6;margin-top:6px;">Total banked: ${Math.floor(banked)}</div>
      </div>
      <button id="close-town-center" style="width:100%;padding:12px;background:rgba(255,215,0,0.2);border:1px solid #ffd700;border-radius:4px;color:#ffd700;font-weight:600;cursor:pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('close-town-center').onclick = () => modal.remove();
}

export function showChatPanel(socket) {
  const existingChat = document.getElementById('chat-panel');
  if (existingChat) return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const chatPanel = document.createElement('div');
  chatPanel.id = 'chat-panel';
  const chatWidth = isMobile ? '90vw' : '300px';
  const chatHeight = isMobile ? '200px' : '400px';
  const chatBottom = isMobile ? '4px' : '20px';
  const chatRight = isMobile ? '4px' : '20px';
  chatPanel.style.cssText = `position:absolute;bottom:${chatBottom};right:${chatRight};width:${chatWidth};height:${chatHeight};background:rgba(0,0,0,0.85);border:1px solid #c8a84b;border-radius:8px;display:flex;flex-direction:column;z-index:100;font-family:'Segoe UI',sans-serif;`;
  chatPanel.innerHTML = `
    <div style="padding:8px 12px;border-bottom:2px solid #c8a84b;color:#c8a84b;font-weight:700;font-size:12px;letter-spacing:0.5px;display:flex;justify-content:space-between;align-items:center;">
      <span>💬 CHAT</span>
      <button id="chat-collapse-btn" style="background:rgba(200,168,75,0.2);border:1px solid #c8a84b;color:#c8a84b;width:20px;height:20px;padding:0;cursor:pointer;font-size:12px;border-radius:3px;font-weight:bold;">−</button>
    </div>
    <div id="chat-messages" style="flex:1;overflow-y:auto;padding:8px;font-size:11px;color:#fff;"></div>
    <div style="padding:6px;border-top:1px solid rgba(200,168,75,0.2);display:flex;gap:4px;">
      <input id="chat-input" type="text" placeholder="Msg..." style="flex:1;padding:4px;background:rgba(255,255,255,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:4px;color:#fff;font-size:10px;"/>
      <button id="chat-send" style="padding:4px 8px;background:#c8a84b;border:none;border-radius:4px;color:#000;font-weight:600;cursor:pointer;font-size:9px;">Send</button>
    </div>
  `;
  document.body.appendChild(chatPanel);

  const messagesDiv = document.getElementById('chat-messages');
  const collapseBtn = document.getElementById('chat-collapse-btn');
  let isCollapsed = false;

  collapseBtn.onclick = (e) => {
    e.stopPropagation();
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      messagesDiv.style.display = 'none';
      document.querySelector('div[style*="padding:6px;border-top"]').style.display = 'none';
      chatPanel.style.height = '30px';
      collapseBtn.textContent = '+';
    } else {
      messagesDiv.style.display = 'block';
      document.querySelector('div[style*="padding:6px;border-top"]').style.display = 'flex';
      chatPanel.style.height = isMobile ? '200px' : '400px';
      collapseBtn.textContent = '−';
    }
  };

  document.getElementById('chat-send').onclick = () => {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    // Handle admin commands
    if (msg.startsWith('/admin')) {
      const adminToken = sessionStorage.getItem('adminToken');
      if (!adminToken) {
        const msgEl = document.createElement('div');
        msgEl.style.cssText = `margin-bottom:6px;padding:4px;background:rgba(255,0,0,0.2);border-radius:3px;color:#ff6b6b;`;
        msgEl.textContent = '❌ Admin commands disabled. Not authenticated as admin.';
        messagesDiv.appendChild(msgEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        input.value = '';
        return;
      }

      const parts = msg.split(' ');
      if (parts[1] === 'give' && parts[2]) {
        const amount = parseInt(parts[2]) || 1000;
        // Send admin command to server
        socket.emit('adminCommand', { command: 'give', amount, token: adminToken });
        const msgEl = document.createElement('div');
        msgEl.style.cssText = `margin-bottom:6px;padding:4px;background:rgba(0,255,0,0.1);border-radius:3px;color:#00ff88;`;
        msgEl.textContent = `📊 Admin: Requesting ${amount} of each resource...`;
        messagesDiv.appendChild(msgEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
      input.value = '';
      return;
    }

    const displayName = sessionStorage.getItem('playerName') || sessionStorage.getItem('displayName') || 'Player';
    socket.emit('chat', { message: msg, playerName: displayName });
    input.value = '';
  };

  socket.on('chatMessage', (data) => {
    const msgEl = document.createElement('div');
    msgEl.style.cssText = `margin-bottom:6px;padding:4px;background:rgba(200,168,75,0.1);border-radius:3px;`;
    msgEl.innerHTML = `<strong style="color:#c8a84b;">${data.playerName}:</strong> ${data.message}`;
    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

function showHouseInventoryModal(playerId, auth) {
  const existingModal = document.getElementById('house-inventory-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'house-inventory-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;`;

  modal.innerHTML = `
    <div style="background:rgba(0,0,0,0.9);border:1px solid rgba(200,168,75,0.4);border-radius:12px;padding:24px;width:90%;max-width:600px;color:#fff;font-family:'Segoe UI',sans-serif;max-height:80vh;overflow-y:auto;">
      <h2 style="margin:0 0 20px;color:#c8a84b;font-size:20px;">🏛️ Town Center Inventory</h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:12px;margin-bottom:20px;">
        <div style="padding:12px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;">
          <div style="font-size:11px;opacity:0.7;">WOOD</div>
          <div id="inv-wood" style="font-size:18px;font-weight:600;color:#c8a84b;margin-top:4px;">0</div>
        </div>
        <div style="padding:12px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;">
          <div style="font-size:11px;opacity:0.7;">STONE</div>
          <div id="inv-stone" style="font-size:18px;font-weight:600;color:#c8a84b;margin-top:4px;">0</div>
        </div>
        <div style="padding:12px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;">
          <div style="font-size:11px;opacity:0.7;">GOLD</div>
          <div id="inv-gold" style="font-size:18px;font-weight:600;color:#c8a84b;margin-top:4px;">0</div>
        </div>
        <div style="padding:12px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;">
          <div style="font-size:11px;opacity:0.7;">FOOD</div>
          <div id="inv-food" style="font-size:18px;font-weight:600;color:#c8a84b;margin-top:4px;">0</div>
        </div>
        <div style="padding:12px;background:rgba(200,168,75,0.15);border-radius:6px;text-align:center;">
          <div style="font-size:11px;opacity:0.7;">WATER</div>
          <div id="inv-water" style="font-size:18px;font-weight:600;color:#c8a84b;margin-top:4px;">0</div>
        </div>
      </div>

      <h3 style="color:#c8a84b;margin-top:20px;margin-bottom:12px;font-size:14px;">Actions</h3>
      <div style="display:grid;gap:8px;">
        <button id="spawn-worker-modal" style="padding:12px;background:linear-gradient(135deg, #c8a84b, #ffd700);border:none;border-radius:4px;color:#000;font-weight:600;cursor:pointer;width:100%;">➕ Spawn Worker (1000🍖 500🪵 200⛏️ 50💰)</button>
        <button style="padding:12px;background:rgba(139,69,19,0.3);border:1px solid #8b4513;border-radius:4px;color:#daa520;cursor:pointer;width:100%;opacity:0.5;" disabled>🌳 Build Wood Fence (50🪵) - Coming Soon</button>
        <button style="padding:12px;background:rgba(128,128,128,0.3);border:1px solid #808080;border-radius:4px;color:#c0c0c0;cursor:pointer;width:100%;opacity:0.5;" disabled>⬜ Build Stone Wall (100⛏️) - Coming Soon</button>
        <button style="padding:12px;background:rgba(200,100,0,0.3);border:1px solid #c86400;border-radius:4px;color:#ff8c00;cursor:pointer;width:100%;opacity:0.5;" disabled>⚔️ Craft Sword (100🪵 50⛏️) - Coming Soon</button>
      </div>

      <h3 style="color:#c8a84b;margin-top:20px;margin-bottom:12px;font-size:14px;">Your Units</h3>
      <div id="units-list" style="background:rgba(255,255,255,0.05);border-radius:6px;padding:12px;max-height:200px;overflow-y:auto;font-size:11px;">
        <div style="opacity:0.7;">Loading units...</div>
      </div>

      <button id="close-house-inventory" style="width:100%;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;cursor:pointer;margin-top:20px;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('close-house-inventory').onclick = () => modal.remove();
  document.getElementById('spawn-worker-modal').onclick = () => {
    const userId = sessionStorage.getItem('userId');
    fetch('/api/spawn-worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    }).then(r => r.json()).then(data => {
      alert(data.message || (data.success ? 'Worker spawned!' : data.error));
      modal.remove();
    });
  };
}

function showSettingsPanel(displayName, email = '') {
  const existingModal = document.getElementById('settings-modal');
  if (existingModal) existingModal.remove();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;overflow:auto;`;

  // Mobile: full width, Desktop: centered box
  const modalWidth = isMobile ? '95vw' : '90%';
  const modalMaxWidth = isMobile ? 'none' : '500px';

  modal.innerHTML = `
    <div style="background:rgba(0,0,0,0.95);border:1px solid rgba(200,168,75,0.4);border-radius:12px;padding:20px;width:${modalWidth};max-width:${modalMaxWidth};color:#fff;font-family:'Segoe UI',sans-serif;margin:20px;max-height:90vh;overflow-y:auto;">
      <h2 style="margin:0 0 20px;color:#c8a84b;font-size:20px;">Settings & Profile</h2>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">Display Name (shown to other players)</label>
        <input type="text" id="settings-nickname" value="${displayName}" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;font-weight:600;"/>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">Email (account login - full address)</label>
        <input type="email" id="settings-email" value="${email}" disabled style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(200,168,75,0.2);border-radius:4px;color:#ccc;font-size:13px;box-sizing:border-box;word-break:break-all;"/>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">Age</label>
        <input type="number" id="settings-age" placeholder="18" min="13" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;"/>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">State/Territory</label>
        <input type="text" id="settings-state" placeholder="California" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;"/>
      </div>

      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">Country</label>
        <input type="text" id="settings-country" placeholder="USA" style="width:100%;padding:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;"/>
      </div>

      <button id="save-settings-btn" style="width:100%;padding:12px;background:linear-gradient(135deg, #c8a84b, #ffd700);border:none;border-radius:4px;color:#000;font-weight:600;cursor:pointer;margin-bottom:8px;font-size:14px;">✓ Save Profile</button>
      <button id="delete-account-btn" style="width:100%;padding:12px;background:rgba(255,0,0,0.2);border:1px solid #ff6b6b;border-radius:4px;color:#ff6b6b;font-weight:600;cursor:pointer;margin-bottom:8px;font-size:14px;">🗑 Delete Account</button>
      <button id="close-settings-btn" style="width:100%;padding:12px;background:rgba(100,100,100,0.3);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;font-weight:600;cursor:pointer;font-size:14px;">✕ Close</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('close-settings-btn').onclick = () => modal.remove();

  document.getElementById('save-settings-btn').onclick = async () => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    const age = document.getElementById('settings-age').value;
    const state = document.getElementById('settings-state').value;
    const country = document.getElementById('settings-country').value;

    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: auth.userId, age: age ? parseInt(age) : null, state, country })
    });
    const data = await res.json();
    alert(data.message || 'Profile saved!');
  };

  document.getElementById('delete-account-btn').onclick = async () => {
    if (confirm('Delete account? All progress will be lost permanently. Are you sure?')) {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: auth.userId })
      });
      alert('Account deleted. Redirecting...');
      localStorage.removeItem('auth');
      window.location.href = '/';
    }
  };
}

export function createUI(playerId, gameState, displayName) {
  // Wipe any leftover HUD from a prior init so nothing is ever duplicated.
  clearExistingHUD();

  // Login info panel (top right)
  if (displayName) {
    const loginPanel = document.createElement('div');
    loginPanel.id = 'login-panel';
    loginPanel.style.cssText = `position:absolute;top:14px;right:14px;background:rgba(0,0,0,0.7);border:1px solid rgba(200,168,75,0.4);border-radius:8px;padding:10px 14px;color:#fff;font-family:'Segoe UI',sans-serif;font-size:12px;z-index:100;backdrop-filter:blur(4px);min-width:120px;`;
    loginPanel.innerHTML = `
      <div style="opacity:0.7;font-size:10px;margin-bottom:4px;">👤 Playing as</div>
      <div style="color:#c8a84b;font-weight:600;margin-bottom:8px;word-break:break-all;font-size:11px;">${displayName}</div>
      <button id="settings-btn" style="width:100%;padding:5px;background:rgba(200,168,75,0.2);border:1px solid #c8a84b;border-radius:4px;color:#c8a84b;cursor:pointer;font-size:10px;font-weight:600;">⚙️ Settings</button>
    `;
    document.body.appendChild(loginPanel);

    document.getElementById('settings-btn').onclick = () => {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      showSettingsPanel(displayName, auth.email || '');
    };
  }

  const hudContainer = document.createElement('div');
  hudContainer.id = 'hud';
  hudContainer.style.cssText = `position:absolute;bottom:20px;left:20px;color:#fff;font-family:'Segoe UI',sans-serif;font-size:13px;background:rgba(0,0,0,0.55);padding:12px 16px;border-radius:8px;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);z-index:100;line-height:1.6;`;
  hudContainer.innerHTML = `<div style="opacity:0.6;font-size:11px;">WASD move · Q/E up/down · L-drag select · R-click move/work</div>`;
  document.body.appendChild(hudContainer);

  const resDefs = [
    { key:'wood', img:'/icons/wood2.png', color:'#c79a5b' },
    { key:'food', img:'/icons/meat2.png', color:'#e57373' },
    { key:'water', img:'/icons/water2.png', color:'#5db4ec' },
    { key:'gold', img:'/icons/gold2.png', color:'#e8c84a' },
    { key:'stone', img:'/icons/stone2.png', color:'#bcbcbc' }
  ];
  const resourceBar = document.createElement('div');
  resourceBar.id = 'resource-bar';
  resourceBar.style.cssText = `position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;color:#fff;font-family:'Segoe UI',sans-serif;font-size:16px;font-weight:600;background:rgba(0,0,0,0.6);padding:8px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);z-index:100;white-space:nowrap;`;
  resDefs.forEach((r) => {
    const span = document.createElement('span');
    span.style.cssText = 'display:flex;align-items:center;gap:6px;';
    span.innerHTML = `<img src="${r.img}" width="26" height="26" style="object-fit:contain;" alt="${r.key}"/><span id="res-${r.key}" style="color:${r.color};min-width:26px;">0</span>`;
    resourceBar.appendChild(span);
  });

  const walletBtn = document.createElement('button');
  walletBtn.style.cssText = 'display:flex;align-items:center;gap:6px;background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.4);border-radius:6px;padding:6px 12px;color:#c8a84b;cursor:pointer;font-family:"Segoe UI",sans-serif;font-size:12px;font-weight:600;transition:all 0.2s;';
  walletBtn.innerHTML = '💰 Wallet';
  walletBtn.onmouseenter = () => { walletBtn.style.background = 'rgba(200,168,75,0.25)'; };
  walletBtn.onmouseleave = () => { walletBtn.style.background = 'rgba(200,168,75,0.15)'; };
  walletBtn.onclick = () => { alert('Wallet feature coming soon!'); };
  resourceBar.appendChild(walletBtn);

  document.body.appendChild(resourceBar);

  // Selected count in far left corner (above HUD)
  const selDiv = document.createElement('div');
  selDiv.id = 'selected-panel';
  selDiv.style.cssText = `position:absolute;bottom:90px;left:20px;background:rgba(0,0,0,0.6);border:1px solid rgba(200,168,75,0.3);border-radius:8px;padding:12px 16px;color:#c8a84b;font-family:'Segoe UI',sans-serif;font-size:14px;z-index:100;`;
  selDiv.innerHTML = `Selected: <span id="unit-count" style="font-weight:600;">0</span>`;
  document.body.appendChild(selDiv);

  // --- Build system: hammer button (far left) opens a build menu ---
  const buildBar = document.createElement('div');
  buildBar.id = 'build-bar';
  buildBar.style.cssText = `position:absolute;top:150px;left:14px;z-index:100;display:flex;flex-direction:column;gap:10px;`;

  // Hammer button
  const hammerBtn = document.createElement('button');
  hammerBtn.id = 'build-hammer';
  hammerBtn.title = 'Build';
  hammerBtn.innerHTML = '🔨<div style="font-size:9px;margin-top:2px;">Build</div>';
  hammerBtn.style.cssText = `width:64px;height:64px;background:rgba(0,0,0,0.6);color:#fff;border:2px solid rgba(255,255,255,0.2);border-radius:10px;font-size:24px;cursor:pointer;font-family:'Segoe UI',sans-serif;transition:all 0.12s;`;
  hammerBtn.onmouseenter = () => { hammerBtn.style.borderColor='#00ff88'; };
  hammerBtn.onmouseleave = () => { hammerBtn.style.borderColor='rgba(255,255,255,0.2)'; };
  buildBar.appendChild(hammerBtn);

  // Character selection button
  const charButton = document.createElement('button');
  charButton.id = 'char-button';
  charButton.innerHTML = '👤<div style="font-size:8px;margin-top:2px;font-weight:600;">UNIT</div>';
  charButton.style.cssText = `width:64px;height:64px;background:rgba(0,0,0,0.6);color:#fff;border:2px solid rgba(255,255,255,0.2);border-radius:10px;font-size:22px;cursor:pointer;font-family:'Segoe UI',sans-serif;transition:all 0.12s;`;
  charButton.onmouseenter = () => { charButton.style.borderColor='#00ff88'; };
  charButton.onmouseleave = () => { charButton.style.borderColor='rgba(255,255,255,0.2)'; };
  buildBar.appendChild(charButton);

  document.body.appendChild(buildBar);

  // Build menu listing what the player can build (cost + time)
  const buildMenu = document.createElement('div');
  buildMenu.id = 'build-menu';
  buildMenu.style.cssText = `position:absolute;top:150px;left:88px;z-index:101;background:rgba(0,0,0,0.9);border:1px solid #c8a84b;border-radius:10px;padding:10px;width:210px;display:none;font-family:'Segoe UI',sans-serif;color:#fff;`;
  const buildables = [
    { key: 'house' },
    { key: 'woodFence' },
    { key: 'stoneFence' }
  ];
  let buildSelectCb = () => {};
  const fmtTime = (s) => s >= 60 ? `${Math.round(s/60)} min` : `${s} sec`;
  buildMenu.innerHTML = `<div style="color:#c8a84b;font-weight:700;font-size:14px;margin-bottom:8px;letter-spacing:1px;">BUILD</div>`;
  buildables.forEach(({ key }) => {
    const b = SETTINGS.building[key];
    if (!b) return;
    const costs = [];
    if (b.woodCost) costs.push(`${b.woodCost} Wood`);
    if (b.stoneCost) costs.push(`${b.stoneCost} Stone`);
    if (b.goldCost) costs.push(`${b.goldCost} Gold`);
    const card = document.createElement('button');
    card.className = 'build-option';
    card.dataset.key = key;
    card.style.cssText = `width:100%;text-align:left;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.4);border-radius:6px;color:#fff;cursor:pointer;padding:8px;margin-bottom:6px;font-size:13px;`;
    card.innerHTML = `<div style="font-weight:600;font-size:14px;">${b.label}</div>
      <div style="font-size:11px;opacity:0.85;margin-top:2px;color:#e8c84a;">${costs.join('  ·  ')} · ⏱ ${fmtTime(b.buildTime)}</div>`;
    card.onclick = () => { buildMenu.style.display = 'none'; buildSelectCb(key); };
    buildMenu.appendChild(card);
  });
  // Fence hint
  const fenceHint = document.createElement('div');
  fenceHint.style.cssText = 'font-size:9px;opacity:0.55;margin-top:2px;';
  fenceHint.textContent = 'Fences: click repeatedly to place a line.';
  buildMenu.appendChild(fenceHint);
  document.body.appendChild(buildMenu);

  hammerBtn.onclick = () => {
    buildMenu.style.display = buildMenu.style.display === 'none' ? 'block' : 'none';
  };

  const tracks = [
    { file:'kaazoom-the-ballad-of-my-sweet-fair-maiden-medieval-style-music-358306.mp3', label:'Ballad' },
    { file:'sonican-background-music-new-age-nature-465069.mp3', label:'Nature' },
    { file:'the_mountain-ancient-empire-142301.mp3', label:'Empire' },
    { file:'loksii-no-copyright-music-211881.mp3', label:'Loksii' },
    { file:'mirostar-lofi-beats-531504.mp3', label:'Lofi' },
    { file:'fassounds-lofi-study-calm-peaceful-chill-hop-112191.mp3', label:'Chill' },
    { file:'watermelon_beats-medieval-folk-music-505203.mp3', label:'Folk' },
    { file:'deuslower-medieval-ambient-236809.mp3', label:'Ambient' },
    { file:'ivan_luzan-interstellar-piano-157094.mp3', label:'Piano' },
    { file:'good_b_music-time-166273.mp3', label:'Time' },
    { file:'hitslab-western-cowboy-western-music-543089.mp3', label:'Western' },
    { file:'ebunny-medieval-kingdom-loop-366815.mp3', label:'Kingdom' }
  ];
  const DEFAULT_TRACK = 7;

  const musicTab = document.createElement('div');
  musicTab.id = 'music-tab';
  musicTab.style.cssText = `position:absolute;top:110px;right:14px;background:rgba(0,0,0,0.65);border-radius:8px;border:1px solid rgba(255,255,255,0.15);padding:6px 12px;z-index:101;font-family:'Segoe UI',sans-serif;color:#fff;font-size:13px;font-weight:600;cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px;`;
  musicTab.innerHTML = `🎵 <span id="music-tab-label">Music</span>`;
  document.body.appendChild(musicTab);

  const musicPanel = document.createElement('div');
  musicPanel.id = 'music-panel';
  musicPanel.style.cssText = `position:absolute;top:148px;right:14px;background:rgba(0,0,0,0.88);border-radius:10px;border:1px solid rgba(255,255,255,0.15);padding:12px;z-index:100;font-family:'Segoe UI',sans-serif;color:#fff;width:224px;display:none;`;

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
  const nowPlaying = document.createElement('div');
  nowPlaying.style.cssText = 'font-size:11px;opacity:0.75;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  nowPlaying.textContent = tracks[DEFAULT_TRACK].label;
  const onoffSwitch = document.createElement('div');
  onoffSwitch.style.cssText = `width:40px;height:20px;border-radius:10px;background:#16a34a;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0;margin-left:8px;`;
  const onoffBall = document.createElement('div');
  onoffBall.style.cssText = `width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;left:22px;transition:left 0.2s;`;
  onoffSwitch.appendChild(onoffBall);
  topRow.appendChild(nowPlaying); topRow.appendChild(onoffSwitch);
  musicPanel.appendChild(topRow);

  const circlesRow = document.createElement('div');
  circlesRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;';
  const circles = [];
  const mutedTracks = new Set();

  tracks.forEach((t, i) => {
    const dot = document.createElement('button');
    dot.title = t.label;
    dot.style.cssText = `width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);cursor:pointer;font-size:10px;color:#fff;font-weight:700;transition:all 0.15s;`;
    dot.textContent = i + 1;
    dot.onclick = () => {
      if (mutedTracks.has(i)) {
        // Click gray circle = unmute it
        mutedTracks.delete(i);
        highlightCircle(currentTrack);
      } else {
        playTrack(i);
      }
    };
    circlesRow.appendChild(dot);
    circles.push(dot);
  });
  musicPanel.appendChild(circlesRow);

  const ctrlRow = document.createElement('div');
  ctrlRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;';
  function makeBtn(label) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `flex:1;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;font-size:10px;padding:5px 2px;cursor:pointer;transition:background 0.15s;`;
    return b;
  }
  const shuffleBtn = makeBtn('⇄ Shuffle');
  const loopBtn = makeBtn('↻ Loop');
  const skipBtn = makeBtn('⏭ Skip');
  const muteBtn = makeBtn('🔇 Mute');
  ctrlRow.appendChild(shuffleBtn); ctrlRow.appendChild(loopBtn);
  ctrlRow.appendChild(skipBtn); ctrlRow.appendChild(muteBtn);
  musicPanel.appendChild(ctrlRow);

  // Mute hint label
  const muteHint = document.createElement('div');
  muteHint.style.cssText = 'font-size:9px;opacity:0.45;margin-bottom:6px;text-align:center;';
  muteHint.textContent = 'Click gray circle to unmute';
  musicPanel.appendChild(muteHint);

  const volRow = document.createElement('div');
  volRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  volRow.innerHTML = `<span style="font-size:12px;">🔊</span>`;
  const volSlider = document.createElement('input');
  volSlider.type='range'; volSlider.min=0; volSlider.max=100; volSlider.value=25;
  volSlider.style.cssText = 'flex:1;accent-color:#00ff88;cursor:pointer;';
  volRow.appendChild(volSlider);
  musicPanel.appendChild(volRow);
  document.body.appendChild(musicPanel);

  let panelOpen = false;
  // Music Tab Toggle (WORKS: Desktop, iOS, Android)
  addClickHandler(musicTab, () => {
    panelOpen = !panelOpen;
    musicPanel.style.display = panelOpen ? 'block' : 'none';
    musicTab.style.borderColor = panelOpen ? '#00ff88' : 'rgba(255,255,255,0.15)';
  });

  const audio = new Audio();
  audio.volume = 0.25; // start at 25%
  activeMusicAudio = audio; // track so a later createUI() can stop this one
  let currentTrack = DEFAULT_TRACK;
  let musicOn = true;
  let shuffleMode = false;
  let loopMode = false;

  function getNextTrack(fromIndex) {
    if (loopMode) return fromIndex;
    if (shuffleMode) {
      const available = tracks.map((_,i)=>i).filter(i => !mutedTracks.has(i) && i !== fromIndex);
      if (available.length === 0) return fromIndex;
      return available[Math.floor(Math.random()*available.length)];
    }
    for (let offset = 1; offset <= tracks.length; offset++) {
      const idx = (fromIndex + offset) % tracks.length;
      if (!mutedTracks.has(idx)) return idx;
    }
    return fromIndex;
  }

  function skipToNext() { playTrack(getNextTrack(currentTrack)); }

  function highlightCircle(i) {
    circles.forEach((c, idx) => {
      if (mutedTracks.has(idx)) {
        c.style.background = 'rgba(30,30,30,0.9)';
        c.style.borderColor = '#2a2a2a';
        c.style.color = '#333';
        c.style.textDecoration = 'line-through';
        c.style.opacity = '0.35';
      } else if (idx === i) {
        c.style.background = '#00ff88';
        c.style.borderColor = '#00ff88';
        c.style.color = '#000';
        c.style.textDecoration = 'none';
        c.style.opacity = '1';
      } else {
        c.style.background = 'rgba(255,255,255,0.15)';
        c.style.borderColor = 'rgba(255,255,255,0.25)';
        c.style.color = '#fff';
        c.style.textDecoration = 'none';
        c.style.opacity = '1';
      }
    });
    muteBtn.style.background = mutedTracks.has(i) ? '#ef4444' : 'rgba(255,255,255,0.12)';
    muteBtn.style.borderColor = mutedTracks.has(i) ? '#ef4444' : 'rgba(255,255,255,0.2)';
    muteBtn.textContent = mutedTracks.has(i) ? '🔇 Muted' : '🔇 Mute';
  }

  function playTrack(i) {
    if (mutedTracks.has(i)) { playTrack(getNextTrack(i)); return; }
    currentTrack = i;
    audio.loop = loopMode;
    audio.src = `/sounds/${tracks[i].file}`;
    audio.currentTime = 0;
    if (musicOn) audio.play().catch(() => {});
    highlightCircle(i);
    nowPlaying.textContent = `${i+1}. ${tracks[i].label}`;
    document.getElementById('music-tab-label').textContent = tracks[i].label;
  }

  audio.addEventListener('ended', () => { if (!loopMode) skipToNext(); });

  // Helper: Add event listener that works on desktop, iOS, and Android
  function addClickHandler(element, callback) {
    element.addEventListener('click', (e) => { e.preventDefault(); callback(); });
    element.addEventListener('touchend', (e) => { e.preventDefault(); callback(); });
  }

  // On/Off Switch = MASTER audio toggle. Turns off music AND all game sound
  // effects (chopping, mining, click sounds) on desktop and mobile.
  addClickHandler(onoffSwitch, () => {
    musicOn = !musicOn;
    window.__AOS_MUTED = !musicOn; // silence Web Audio SFX + click sounds everywhere
    if (musicOn) {
      audio.muted = false;
      audio.play().catch(()=>{});
      onoffSwitch.style.background='#16a34a'; onoffBall.style.left='22px';
    } else {
      audio.pause(); audio.muted = true; // pause + hard-mute so nothing leaks through
      onoffSwitch.style.background='#555'; onoffBall.style.left='2px';
    }
  });

  // Shuffle Button (WORKS: Desktop, iOS, Android)
  addClickHandler(shuffleBtn, () => {
    shuffleMode = !shuffleMode;
    if (shuffleMode) { loopMode=false; audio.loop=false; loopBtn.style.background='rgba(255,255,255,0.12)'; loopBtn.textContent='↻ Loop'; }
    shuffleBtn.style.background = shuffleMode ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.12)';
    shuffleBtn.textContent = shuffleMode ? '⇄ Shuffle ON' : '⇄ Shuffle';
  });

  // Loop Button (WORKS: Desktop, iOS, Android)
  addClickHandler(loopBtn, () => {
    loopMode = !loopMode;
    if (loopMode) { shuffleMode=false; shuffleBtn.style.background='rgba(255,255,255,0.12)'; shuffleBtn.textContent='⇄ Shuffle'; }
    audio.loop = loopMode;
    loopBtn.style.background = loopMode ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.12)';
    loopBtn.textContent = loopMode ? '↻ Loop ON' : '↻ Loop';
  });

  // Skip Button (WORKS: Desktop, iOS, Android)
  addClickHandler(skipBtn, skipToNext);

  // Mute Button (WORKS: Desktop, iOS, Android - THIS WAS BROKEN ON iOS)
  addClickHandler(muteBtn, () => {
    if (mutedTracks.has(currentTrack)) {
      mutedTracks.delete(currentTrack);
      highlightCircle(currentTrack);
    } else {
      const toMute = currentTrack;
      mutedTracks.add(toMute);
      const next = getNextTrack(toMute);
      highlightCircle(toMute);
      if (next !== toMute) playTrack(next);
    }
  });

  // Volume Slider (different event for mobile/desktop compatibility)
  volSlider.addEventListener('input', () => { audio.volume = volSlider.value/100; });
  volSlider.addEventListener('change', () => { audio.volume = volSlider.value/100; });

  const startMusic = () => { playTrack(DEFAULT_TRACK); document.removeEventListener('click', startMusic); };
  document.addEventListener('click', startMusic);
  highlightCircle(DEFAULT_TRACK);

  const popup = document.createElement('div');
  popup.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#fff;font-family:'Segoe UI',sans-serif;padding:18px 22px;border-radius:12px;border:1px solid rgba(255,255,255,0.18);text-align:center;z-index:200;display:none;`;
  popup.innerHTML = `
    <div id="place-prompt" style="font-size:15px;margin-bottom:14px;">Place building here?</div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button id="place-yes" style="padding:8px 18px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;">Yes</button>
      <button id="place-move" style="padding:8px 18px;border:none;border-radius:6px;background:#475569;color:#fff;cursor:pointer;font-weight:600;">Move it</button>
      <button id="place-no" style="padding:8px 18px;border:none;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;font-weight:600;">No</button>
    </div>
  `;
  document.body.appendChild(popup);

  const toast = document.createElement('div');
  toast.style.cssText = `position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;font-family:'Segoe UI',sans-serif;padding:10px 20px;border-radius:8px;font-size:14px;z-index:300;display:none;pointer-events:none;`;
  document.body.appendChild(toast);
  let toastTimer = null;

  return {
    hudContainer,
    setResources(res) {
      ['wood','food','water','gold','stone'].forEach((k) => {
        const el = document.getElementById('res-'+k);
        if (el) el.textContent = Math.floor(res[k]||0);
      });
    },
    setSelectedCount(n) { const el = document.getElementById('unit-count'); if (el) el.textContent = n; },
    showToast(msg, duration=3000) {
      toast.textContent=msg; toast.style.display='block';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(()=>{ toast.style.display='none'; }, duration);
    },
    onBuildSelect(cb) { buildSelectCb = cb; },
    onCharacterClick(cb) { charButton.onclick = cb; },
    showConfirm(label) {
      const p = document.getElementById('place-prompt');
      if (p && label) p.textContent = label;
      popup.style.display='block';
    },
    hideConfirm() { popup.style.display='none'; },
    onConfirmYes(cb) { document.getElementById('place-yes').onclick = cb; },
    onConfirmMove(cb) { document.getElementById('place-move').onclick = cb; },
    onConfirmNo(cb) { document.getElementById('place-no').onclick = cb; }
  };
}