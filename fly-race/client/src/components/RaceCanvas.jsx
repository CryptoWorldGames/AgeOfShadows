import React, { useEffect, useRef } from 'react';
import { FLY_COLORS, FLY_NAMES, FLY_RADIUS, FOOD, TICK_HZ, WORLD } from '@shared/constants.js';
import { createRace } from '@shared/sim.js';

/**
 * Replays a race from its seed, driven by the wall clock so every browser shows
 * the same fly in the same place at the same moment. The server has already
 * decided the winner from this exact seed — the canvas is a viewer, not a judge.
 */
export default function RaceCanvas({ seed, brainKind = 'randomWalk', startAt, serverOffsetMs = 0, idle }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ race: null, seed: null, idleStart: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frame;

    const draw = () => {
      const st = stateRef.current;
      const now = Date.now() + serverOffsetMs;

      // Waiting for a round? Loop a throwaway demo race so the track is alive.
      const activeSeed = seed ?? st.previewSeed ?? (st.previewSeed = Math.floor(Math.random() * 1e9));
      const activeStart = seed != null ? startAt : st.idleStart || (st.idleStart = now);

      if (st.seed !== activeSeed || st.startAt !== activeStart) {
        st.seed = activeSeed;
        st.startAt = activeStart;
        st.race = createRace(activeSeed, brainKind);
      }

      const race = st.race;
      const elapsed = now - activeStart;
      if (elapsed >= 0) {
        const targetTick = Math.floor((elapsed / 1000) * TICK_HZ);
        let guard = 0;
        while (race.tick < targetTick && race.winner === null && guard++ < 600) race.step();
        // Idle preview: restart once the demo race is over.
        if (idle && race.winner !== null) {
          st.previewSeed = Math.floor(Math.random() * 1e9);
          st.idleStart = now + 1200;
        }
      }

      render(ctx, canvas, race, { elapsed, countdown: elapsed < 0 ? Math.ceil(-elapsed / 1000) : 0, idle });
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [seed, startAt, brainKind, serverOffsetMs, idle]);

  return <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} className="race-canvas" />;
}

function render(ctx, canvas, race, { countdown, idle }) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Track.
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#11151f');
  grad.addColorStop(1, '#1b2233');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = (WORLD.height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Start line.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.lineTo(48, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Food.
  const pulse = 1 + Math.sin(Date.now() / 260) * 0.06;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(FOOD.x, FOOD.y, FOOD.radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,179,71,0.16)';
  ctx.beginPath();
  ctx.arc(FOOD.x, FOOD.y, FOOD.radius * 2.4 * pulse, 0, Math.PI * 2);
  ctx.fill();

  for (const fly of race.flies) {
    const color = FLY_COLORS[fly.index];

    // Trail.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < fly.trail.length; i += 2) {
      const x = fly.trail[i];
      const y = fly.trail[i + 1];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Body.
    ctx.save();
    ctx.translate(fly.x, fly.y);
    ctx.rotate(fly.heading);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, FLY_RADIUS * 1.5, FLY_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings.
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    const flap = Math.sin(Date.now() / 28 + fly.index) * 3;
    ctx.beginPath();
    ctx.ellipse(-2, -FLY_RADIUS - 2, FLY_RADIUS, 3 + flap * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2, FLY_RADIUS + 2, FLY_RADIUS, 3 - flap * 0.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Label.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(FLY_NAMES[fly.index], fly.x, fly.y - FLY_RADIUS - 10);
  }

  if (countdown > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(countdown), canvas.width / 2, canvas.height / 2 + 32);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Race starting', canvas.width / 2, canvas.height / 2 - 60);
  }

  if (race.winner !== null && !countdown) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, canvas.height / 2 - 46, canvas.width, 92);
    ctx.fillStyle = FLY_COLORS[race.winner];
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      idle ? `${FLY_NAMES[race.winner]} wins (demo)` : `${FLY_NAMES[race.winner]} wins!`,
      canvas.width / 2,
      canvas.height / 2 + 14
    );
  }
}
