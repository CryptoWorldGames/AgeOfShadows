// C:\Users\mycry\games\AgeOfShadows\client\src\modules\UI.js
export function createUI(playerId, gameState) {
  const hudContainer = document.createElement('div');
  hudContainer.id = 'hud';
  hudContainer.style.cssText = `
    position: absolute; bottom: 20px; left: 20px;
    color: #fff; font-family: 'Segoe UI', sans-serif; font-size: 13px;
    background: rgba(0, 0, 0, 0.55); padding: 12px 16px; border-radius: 8px;
    backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);
    z-index: 100; line-height: 1.6;
  `;
  hudContainer.innerHTML = `<div style="opacity:0.6; font-size:11px;">WASD move · Q/E up/down · L-drag select · R-click move/work</div>`;
  document.body.appendChild(hudContainer);

  // Real PNG icons from client/public/icons (your colored versions)
  const resDefs = [
    { key: 'wood',  img: '/icons/wood2.png',  color: '#c79a5b' },
    { key: 'food',  img: '/icons/meat2.png',  color: '#e57373' },
    { key: 'water', img: '/icons/water2.png', color: '#5db4ec' },
    { key: 'gold',  img: '/icons/gold2.png',  color: '#e8c84a' },
    { key: 'stone', img: '/icons/stone2.png', color: '#bcbcbc' }
  ];

  const resourceBar = document.createElement('div');
  resourceBar.style.cssText = `
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 16px; align-items: center;
    color: #fff; font-family: 'Segoe UI', sans-serif; font-size: 16px; font-weight: 600;
    background: rgba(0,0,0,0.6); padding: 8px 18px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12); z-index: 100;
  `;
  resDefs.forEach((r) => {
    const span = document.createElement('span');
    span.style.cssText = 'display:flex;align-items:center;gap:6px;';
    span.innerHTML = `<img src="${r.img}" width="26" height="26" style="object-fit:contain;" alt="${r.key}"/><span id="res-${r.key}" style="color:${r.color};min-width:26px;display:inline-block;">0</span>`;
    resourceBar.appendChild(span);
  });
  const selSpan = document.createElement('span');
  selSpan.style.cssText = 'opacity:0.8;font-size:13px;border-left:1px solid rgba(255,255,255,0.2);padding-left:14px;';
  selSpan.innerHTML = `Selected: <span id="unit-count">0</span>`;
  resourceBar.appendChild(selSpan);
  document.body.appendChild(resourceBar);

  // Town Center button
  const buildBar = document.createElement('div');
  buildBar.style.cssText = `position:absolute;top:14px;left:14px;z-index:100;`;
  const tcButton = document.createElement('button');
  tcButton.id = 'tc-button';
  tcButton.innerHTML = 'TC<div style="font-size:10px;margin-top:2px;">Town Center</div>';
  tcButton.style.cssText = `
    width: 72px; height: 72px; background: rgba(0,0,0,0.6); color: #fff;
    border: 2px solid rgba(255,255,255,0.2); border-radius: 10px;
    font-size: 22px; font-weight: 700; cursor: pointer; font-family: 'Segoe UI', sans-serif; transition: all 0.12s;
  `;
  tcButton.onmouseenter = () => { tcButton.style.borderColor = '#00ff88'; };
  tcButton.onmouseleave = () => { tcButton.style.borderColor = 'rgba(255,255,255,0.2)'; };
  buildBar.appendChild(tcButton);
  document.body.appendChild(buildBar);

  // Confirm popup
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.85); color: #fff; font-family: 'Segoe UI', sans-serif;
    padding: 18px 22px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.18);
    text-align: center; z-index: 200; display: none;
  `;
  popup.innerHTML = `
    <div style="font-size:15px;margin-bottom:14px;">Place Town Center here?</div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button id="place-yes" style="padding:8px 18px;border:none;border-radius:6px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;">Yes</button>
      <button id="place-move" style="padding:8px 18px;border:none;border-radius:6px;background:#475569;color:#fff;cursor:pointer;font-weight:600;">Move it</button>
      <button id="place-no" style="padding:8px 18px;border:none;border-radius:6px;background:#dc2626;color:#fff;cursor:pointer;font-weight:600;">No</button>
    </div>
  `;
  document.body.appendChild(popup);

  return {
    hudContainer,
    setResources(res) {
      ['wood', 'food', 'water', 'gold', 'stone'].forEach((k) => {
        const el = document.getElementById('res-' + k);
        if (el) el.textContent = Math.floor(res[k] || 0);
      });
    },
    setSelectedCount(n) {
      const el = document.getElementById('unit-count');
      if (el) el.textContent = n;
    },
    onTownCenterClick(cb) { tcButton.onclick = cb; },
    showConfirm() { popup.style.display = 'block'; },
    hideConfirm() { popup.style.display = 'none'; },
    onConfirmYes(cb) { document.getElementById('place-yes').onclick = cb; },
    onConfirmMove(cb) { document.getElementById('place-move').onclick = cb; },
    onConfirmNo(cb) { document.getElementById('place-no').onclick = cb; }
  };
}