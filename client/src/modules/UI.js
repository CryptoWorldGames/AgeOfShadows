export function createUI(playerId, gameState) {

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
  resourceBar.style.cssText = `position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;color:#fff;font-family:'Segoe UI',sans-serif;font-size:16px;font-weight:600;background:rgba(0,0,0,0.6);padding:8px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);z-index:100;white-space:nowrap;`;
  resDefs.forEach((r) => {
    const span = document.createElement('span');
    span.style.cssText = 'display:flex;align-items:center;gap:6px;';
    span.innerHTML = `<img src="${r.img}" width="26" height="26" style="object-fit:contain;" alt="${r.key}"/><span id="res-${r.key}" style="color:${r.color};min-width:26px;">0</span>`;
    resourceBar.appendChild(span);
  });
  const selSpan = document.createElement('span');
  selSpan.style.cssText = 'opacity:0.8;font-size:13px;border-left:1px solid rgba(255,255,255,0.2);padding-left:14px;';
  selSpan.innerHTML = `Selected: <span id="unit-count">0</span>`;
  resourceBar.appendChild(selSpan);
  document.body.appendChild(resourceBar);

  const buildBar = document.createElement('div');
  buildBar.style.cssText = `position:absolute;top:14px;left:14px;z-index:100;`;
  const tcButton = document.createElement('button');
  tcButton.id = 'tc-button';
  tcButton.innerHTML = '🏛️<div style="font-size:9px;margin-top:2px;">Town Center<br><span style="color:#e8c84a;">100 🪵</span></div>';
  tcButton.style.cssText = `width:72px;height:72px;background:rgba(0,0,0,0.6);color:#fff;border:2px solid rgba(255,255,255,0.2);border-radius:10px;font-size:22px;cursor:pointer;font-family:'Segoe UI',sans-serif;transition:all 0.12s;`;
  tcButton.onmouseenter = () => { tcButton.style.borderColor='#00ff88'; };
  tcButton.onmouseleave = () => { tcButton.style.borderColor='rgba(255,255,255,0.2)'; };
  buildBar.appendChild(tcButton);
  document.body.appendChild(buildBar);

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

  // Music tab
  const musicTab = document.createElement('div');
  musicTab.style.cssText = `position:absolute;top:14px;right:14px;background:rgba(0,0,0,0.65);border-radius:8px;border:1px solid rgba(255,255,255,0.15);padding:6px 12px;z-index:101;font-family:'Segoe UI',sans-serif;color:#fff;font-size:13px;font-weight:600;cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px;`;
  musicTab.innerHTML = `🎵 <span id="music-tab-label">Music</span>`;
  document.body.appendChild(musicTab);

  // Music panel
  const musicPanel = document.createElement('div');
  musicPanel.style.cssText = `position:absolute;top:48px;right:14px;background:rgba(0,0,0,0.88);border-radius:10px;border:1px solid rgba(255,255,255,0.15);padding:12px;z-index:100;font-family:'Segoe UI',sans-serif;color:#fff;width:224px;display:none;`;

  // Row 1: now playing + ON/OFF switch
  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';

  const nowPlaying = document.createElement('div');
  nowPlaying.style.cssText = 'font-size:11px;opacity:0.75;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  nowPlaying.textContent = tracks[DEFAULT_TRACK].label;

  // ON/OFF slider switch
  const onoffSwitch = document.createElement('div');
  onoffSwitch.style.cssText = `width:40px;height:20px;border-radius:10px;background:#16a34a;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0;margin-left:8px;`;
  const onoffBall = document.createElement('div');
  onoffBall.style.cssText = `width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;left:22px;transition:left 0.2s;`;
  onoffSwitch.appendChild(onoffBall);

  topRow.appendChild(nowPlaying);
  topRow.appendChild(onoffSwitch);
  musicPanel.appendChild(topRow);

  // Track circles
  const circlesRow = document.createElement('div');
  circlesRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;';
  const circles = [];
  const mutedTracks = new Set();

  tracks.forEach((t, i) => {
    const dot = document.createElement('button');
    dot.title = t.label;
    dot.style.cssText = `width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);cursor:pointer;font-size:10px;color:#fff;font-weight:700;transition:all 0.15s;`;
    dot.textContent = i + 1;
    dot.onclick = () => playTrack(i);
    circlesRow.appendChild(dot);
    circles.push(dot);
  });
  musicPanel.appendChild(circlesRow);

  // Buttons row: Shuffle, Loop, Skip, Mute
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

  ctrlRow.appendChild(shuffleBtn);
  ctrlRow.appendChild(loopBtn);
  ctrlRow.appendChild(skipBtn);
  ctrlRow.appendChild(muteBtn);
  musicPanel.appendChild(ctrlRow);

  // Volume
  const volRow = document.createElement('div');
  volRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  volRow.innerHTML = `<span style="font-size:12px;">🔊</span>`;
  const volSlider = document.createElement('input');
  volSlider.type='range'; volSlider.min=0; volSlider.max=100; volSlider.value=60;
  volSlider.style.cssText = 'flex:1;accent-color:#00ff88;cursor:pointer;';
  volRow.appendChild(volSlider);
  musicPanel.appendChild(volRow);
  document.body.appendChild(musicPanel);

  let panelOpen = false;
  musicTab.onclick = () => {
    panelOpen = !panelOpen;
    musicPanel.style.display = panelOpen ? 'block' : 'none';
    musicTab.style.borderColor = panelOpen ? '#00ff88' : 'rgba(255,255,255,0.15)';
  };

  const audio = new Audio();
  audio.volume = 0.6;
  let currentTrack = DEFAULT_TRACK;
  let musicOn = true;
  let shuffleMode = false;
  let loopMode = false;

  function getNextTrack() {
    const available = tracks.map((_,i) => i).filter(i => !mutedTracks.has(i));
    if (available.length === 0) return currentTrack;
    if (loopMode) return currentTrack;
    if (shuffleMode) {
      const others = available.filter(i => i !== currentTrack);
      return others.length === 0 ? currentTrack : others[Math.floor(Math.random()*others.length)];
    }
    const idx = available.indexOf(currentTrack);
    return available[(idx+1) % available.length];
  }

  function skipToNext() { playTrack(getNextTrack()); }

  function highlightCircle(i) {
    circles.forEach((c, idx) => {
      if (mutedTracks.has(idx)) {
        c.style.background = 'rgba(100,100,100,0.3)';
        c.style.borderColor = '#666';
        c.style.color = '#666';
      } else if (idx === i) {
        c.style.background = '#00ff88';
        c.style.borderColor = '#00ff88';
        c.style.color = '#000';
      } else {
        c.style.background = 'rgba(255,255,255,0.15)';
        c.style.borderColor = 'rgba(255,255,255,0.25)';
        c.style.color = '#fff';
      }
    });
    // Update mute button to reflect current track state
    if (mutedTracks.has(i)) {
      muteBtn.style.background = '#ef4444';
      muteBtn.style.borderColor = '#ef4444';
      muteBtn.textContent = '🔇 Muted';
    } else {
      muteBtn.style.background = 'rgba(255,255,255,0.12)';
      muteBtn.style.borderColor = 'rgba(255,255,255,0.2)';
      muteBtn.textContent = '🔇 Mute';
    }
  }

  function playTrack(i) {
    if (mutedTracks.has(i)) { const next = getNextTrack(); if (next !== i) playTrack(next); return; }
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

  // ON/OFF switch
  onoffSwitch.onclick = () => {
    musicOn = !musicOn;
    if (musicOn) {
      audio.play().catch(()=>{});
      onoffSwitch.style.background = '#16a34a';
      onoffBall.style.left = '22px';
    } else {
      audio.pause();
      onoffSwitch.style.background = '#555';
      onoffBall.style.left = '2px';
    }
  };

  shuffleBtn.onclick = () => {
    shuffleMode = !shuffleMode;
    if (shuffleMode) { loopMode = false; audio.loop = false; loopBtn.style.background='rgba(255,255,255,0.12)'; loopBtn.textContent='↻ Loop'; }
    shuffleBtn.style.background = shuffleMode ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.12)';
    shuffleBtn.textContent = shuffleMode ? '⇄ Shuffle ON' : '⇄ Shuffle';
  };

  loopBtn.onclick = () => {
    loopMode = !loopMode;
    if (loopMode) { shuffleMode = false; shuffleBtn.style.background='rgba(255,255,255,0.12)'; shuffleBtn.textContent='⇄ Shuffle'; }
    audio.loop = loopMode;
    loopBtn.style.background = loopMode ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.12)';
    loopBtn.textContent = loopMode ? '↻ Loop ON' : '↻ Loop';
  };

  skipBtn.onclick = () => skipToNext();

  muteBtn.onclick = () => {
    const i = currentTrack;
    if (mutedTracks.has(i)) {
      mutedTracks.delete(i);
    } else {
      mutedTracks.add(i);
      skipToNext(); // skip to next non-muted song immediately
    }
    highlightCircle(currentTrack);
  };

  volSlider.oninput = () => { audio.volume = volSlider.value/100; };

  const startMusic = () => { playTrack(DEFAULT_TRACK); document.removeEventListener('click', startMusic); };
  document.addEventListener('click', startMusic);
  highlightCircle(DEFAULT_TRACK);

  const popup = document.createElement('div');
  popup.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#fff;font-family:'Segoe UI',sans-serif;padding:18px 22px;border-radius:12px;border:1px solid rgba(255,255,255,0.18);text-align:center;z-index:200;display:none;`;
  popup.innerHTML = `
    <div style="font-size:15px;margin-bottom:14px;">Place Town Center here?</div>
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
    onTownCenterClick(cb) { tcButton.onclick = cb; },
    showConfirm() { popup.style.display='block'; },
    hideConfirm() { popup.style.display='none'; },
    onConfirmYes(cb) { document.getElementById('place-yes').onclick = cb; },
    onConfirmMove(cb) { document.getElementById('place-move').onclick = cb; },
    onConfirmNo(cb) { document.getElementById('place-no').onclick = cb; }
  };
}