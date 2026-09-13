import React, { useCallback, useEffect, useRef, useState } from 'react';
import RaceCanvas from './components/RaceCanvas.jsx';
import BettingPanel from './components/BettingPanel.jsx';
import { getConfig, getState } from './api.js';
import { FLY_NAMES } from '@shared/constants.js';

const fmtCountdown = (ms) => {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

export default function App() {
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [err, setErr] = useState(null);
  const offsetRef = useRef(0); // server clock - local clock

  const refresh = useCallback(async () => {
    try {
      const s = await getState();
      offsetRef.current = s.serverTime - Date.now();
      setState(s);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    getConfig().then(setConfig).catch((e) => setErr(e.message));
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  const round = state?.round;
  const now = Date.now() + offsetRef.current;
  const racing = round?.seed != null && round.status !== 'refunded';

  return (
    <div className="app">
      <header>
        <h1>🪰 Fly Race</h1>
        <div className="badges">
          {config && <span className="badge">{config.cluster}</span>}
          {config?.demoMode && <span className="badge warn-badge">demo mode — no real USDC</span>}
          {config && <span className="badge">brain: {config.brainKind}</span>}
        </div>
      </header>

      {err && <div className="error banner">{err}</div>}

      <RaceCanvas
        seed={racing ? round.seed : null}
        brainKind={round?.brainKind}
        startAt={round?.startAt}
        serverOffsetMs={offsetRef.current}
        idle={!racing}
      />

      <div className="columns">
        <BettingPanel config={config} round={round} onChanged={refresh} />

        <div className="panel">
          <h2>Round {round?.id ?? '—'}</h2>
          <dl className="stats">
            <dt>Status</dt>
            <dd>{round?.status ?? '—'}</dd>
            <dt>Entries</dt>
            <dd>
              {round?.entriesFilled ?? 0} / {round?.entriesNeeded ?? 5}
            </dd>
            {round?.refundDeadline && round.status === 'open' && (
              <>
                <dt>Auto-refund in</dt>
                <dd>{fmtCountdown(round.refundDeadline - now)}</dd>
              </>
            )}
            {round?.startAt && round.status === 'locked' && (
              <>
                <dt>Starts in</dt>
                <dd>{fmtCountdown(round.startAt - now)}</dd>
              </>
            )}
            {round?.winnerFly != null && (
              <>
                <dt>Winner</dt>
                <dd>{FLY_NAMES[round.winnerFly]}</dd>
              </>
            )}
            {round?.payout && (
              <>
                <dt>Payout</dt>
                <dd>
                  {round.payout.amountUsdc} USDC → {round.payout.status}
                </dd>
              </>
            )}
          </dl>
          {round?.seed != null && <p className="muted seed">seed {round.seed} (derived from the 5 bet signatures)</p>}

          <h3>Recent rounds</h3>
          <ul className="history">
            {(state?.history ?? []).map((r) => (
              <li key={r.id}>
                #{r.id} · {r.status}
                {r.winnerFly != null ? ` · ${FLY_NAMES[r.winnerFly]} won` : ''}
              </li>
            ))}
            {!state?.history?.length && <li className="muted">no finished rounds yet</li>}
          </ul>
        </div>
      </div>

      <footer className="muted">
        Movement is a placeholder random-walk-with-momentum model. The spiking (leaky
        integrate-and-fire) brain is wired and ready for real FlyWire / MaleCNS connectome data.
      </footer>
    </div>
  );
}
