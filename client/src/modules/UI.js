// C:\Users\mycry\games\AgeOfShadows\client\src\modules\UI.js
export function createUI(playerId, gameState) {
  const hudContainer = document.createElement('div');
  hudContainer.id = 'hud';
  hudContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 20px;
    color: #fff;
    font-family: 'Segoe UI', sans-serif;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.55);
    padding: 12px 16px;
    border-radius: 8px;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.1);
    z-index: 100;
    line-height: 1.6;
  `;

  const updateHUD = () => {
    hudContainer.innerHTML = `
      <div style="opacity:0.6; font-size:11px;">WASD move · Q/E up/down</div>
    `;
  };

  document.body.appendChild(hudContainer);
  updateHUD();

  return { hudContainer, updateHUD };
}