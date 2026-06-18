// Responsive + collapsible HUD layer.
// Injects one stylesheet that reflows the persistent panels so they never
// overlap on a phone (especially portrait), and adds a collapse toggle to the
// major panels so the player can tuck any box away.

const STYLE_ID = 'aos-responsive-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ---- Collapsible panels ---- */
    .ui-collapse-btn {
      position: absolute; top: 3px; right: 3px; width: 26px; height: 26px;
      padding: 0; border: 1px solid #c8a84b;
      background: rgba(0,0,0,0.8); color: #c8a84b; border-radius: 4px;
      cursor: pointer; font-size: 16px; line-height: 24px; text-align: center;
      z-index: 20; font-family: 'Segoe UI', sans-serif; font-weight: bold;
    }
    .ui-collapse-btn:hover { background: #c8a84b; color: #000; transform: scale(1.1); }
    .ui-collapsed-label {
      display: none; color: #c8a84b; font-size: 11px; font-weight: 700;
      padding: 1px 26px 1px 4px; white-space: nowrap;
      font-family: 'Segoe UI', sans-serif;
    }
    .ui-collapsed > *:not(.ui-collapse-btn):not(.ui-collapsed-label) { display: none !important; }
    .ui-collapsed > .ui-collapsed-label { display: block; }
    .ui-collapsed {
      width: auto !important; min-width: 0 !important;
      height: auto !important; min-height: 0 !important;
      padding: 4px !important;
    }

    /* ---- Portrait phone layout: stack panels, no overlap ---- */
    @media (orientation: portrait) {
      /* WASD/keyboard hint is useless on touch */
      #hud { display: none !important; }

      #game-info-panel {
        top: 4px !important; left: 4px !important;
        transform: scale(0.82); transform-origin: top left;
        min-width: 0 !important;
      }
      #login-panel {
        top: 4px !important; right: 4px !important;
        transform: scale(0.82); transform-origin: top right;
        min-width: 0 !important;
      }
      #resource-bar {
        top: 92px !important; left: 50% !important;
        font-size: 12px !important; gap: 8px !important;
        padding: 5px 8px !important; flex-wrap: wrap !important;
        justify-content: center !important; max-width: 94vw !important;
      }
      #resource-bar img { width: 18px !important; height: 18px !important; }
      #music-tab {
        top: 62px !important; right: 4px !important;
        transform: scale(0.85); transform-origin: top right;
      }
      #music-panel {
        top: 92px !important; right: 4px !important;
        transform: scale(0.85); transform-origin: top right;
      }
      #build-bar {
        top: 64px !important; left: 4px !important;
        transform: scale(0.85); transform-origin: top left;
      }
      #admin-panel {
        bottom: auto !important; top: 150px !important; left: 4px !important;
        transform: scale(0.78); transform-origin: top left;
      }
      #selected-panel {
        bottom: 56px !important; left: 4px !important;
        transform: scale(0.85); transform-origin: bottom left;
        padding: 6px 10px !important;
      }
      #chat-panel {
        bottom: 4px !important; right: 4px !important; left: 4px !important;
        width: auto !important;
      }
    }

    /* ---- Small landscape phones: shrink a touch ---- */
    @media (orientation: landscape) and (max-height: 480px) {
      #game-info-panel, #login-panel, #music-tab, #build-bar, #admin-panel {
        transform: scale(0.85);
      }
      #game-info-panel, #build-bar { transform-origin: top left; }
      #login-panel, #music-tab { transform-origin: top right; }
      #admin-panel { transform-origin: bottom left; }
    }
  `;
  document.head.appendChild(style);
}

// Add a collapse/expand toggle to a panel element.
function makeCollapsible(el, shortLabel, startCollapsed = false) {
  if (!el || el.querySelector(':scope > .ui-collapse-btn')) return;
  // Ensure the panel is a positioning context for the absolute button.
  const pos = getComputedStyle(el).position;
  if (pos === 'static') el.style.position = 'absolute';

  const btn = document.createElement('button');
  btn.className = 'ui-collapse-btn';
  btn.title = 'Collapse / expand';

  const label = document.createElement('div');
  label.className = 'ui-collapsed-label';
  label.textContent = shortLabel;

  el.appendChild(btn);
  el.appendChild(label);

  const setState = (collapsed) => {
    el.classList.toggle('ui-collapsed', collapsed);
    btn.textContent = collapsed ? '+' : '–';
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    setState(!el.classList.contains('ui-collapsed'));
  };
  setState(startCollapsed);
}

// Apply collapsible toggles to the known panels. Safe to call repeatedly and
// before every panel exists — it only touches what is currently in the DOM.
export function applyResponsiveUI() {
  injectStyles();

  const portrait = window.matchMedia('(orientation: portrait)').matches;

  const panels = [
    ['game-info-panel', 'INFO', true],
    ['login-panel', 'MENU', true],
    ['build-bar', 'BUILD', true],
    ['selected-panel', 'SELECT', true],
    ['admin-panel', 'ADMIN', true],
  ];
  panels.forEach(([id, label, startCollapsed]) => {
    const el = document.getElementById(id);
    if (el) makeCollapsible(el, label, (startCollapsed && portrait) || portrait);
  });

  // Resource bar should never collapse (always visible at top on mobile)
  const resourceBar = document.getElementById('resource-bar');
  if (resourceBar && resourceBar.querySelector(':scope > .ui-collapse-btn')) {
    const btn = resourceBar.querySelector(':scope > .ui-collapse-btn');
    btn.remove();
    const label = resourceBar.querySelector(':scope > .ui-collapsed-label');
    if (label) label.remove();
    resourceBar.classList.remove('ui-collapsed');
  }

  // Collapse chat panel by default on mobile portrait to save screen space
  if (portrait) {
    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel) {
      const collapseBtn = chatPanel.querySelector('#chat-collapse-btn');
      if (collapseBtn) {
        collapseBtn.click();
      }
    }
  }
}

// Watch for late-mounting panels (e.g. the React admin panel) and wire them up.
export function startResponsiveUI() {
  applyResponsiveUI();
  // Re-apply when new top-level nodes appear (admin panel mounts after login).
  const obs = new MutationObserver(() => applyResponsiveUI());
  obs.observe(document.body, { childList: true });
  window.addEventListener('orientationchange', () => setTimeout(applyResponsiveUI, 150));
  window.addEventListener('resize', () => applyResponsiveUI());
  return obs;
}
