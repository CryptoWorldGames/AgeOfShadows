import React, { useState } from 'react';
import { placeBet, placeFakeBet } from '../api.js';

export default function BettingPanel({ config, round, onChanged }) {
  const [wallet, setWallet] = useState(() => localStorage.getItem('flyrace.wallet') || '');
  const [signature, setSignature] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const open = round?.status === 'open';
  const myBets = round?.slots.filter((s) => s.taken && s.wallet === wallet).length ?? 0;
  const atLimit = myBets >= (config?.maxBetsPerWallet ?? 3);

  const submit = async (fake) => {
    setError(null);
    setNotice(null);
    if (selected === null) return setError('Pick a fly first.');
    setBusy(true);
    try {
      localStorage.setItem('flyrace.wallet', wallet.trim());
      if (fake) {
        await placeFakeBet({ wallet: wallet.trim() || undefined, flyIndex: selected });
      } else {
        await placeBet({ wallet: wallet.trim(), flyIndex: selected, signature: signature.trim() });
      }
      setNotice('Bet accepted.');
      setSignature('');
      setSelected(null);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Place a bet</h2>
      <p className="muted">
        {config ? `${config.betAmountUsdc} USDC per fly · winner takes ${config.payoutUsdc} USDC` : '…'}
      </p>

      <div className="fly-grid">
        {(config?.flies ?? []).map((fly) => {
          const slot = round?.slots.find((s) => s.flyIndex === fly.index);
          const taken = Boolean(slot?.taken);
          return (
            <button
              key={fly.index}
              className={`fly-btn${selected === fly.index ? ' selected' : ''}${taken ? ' taken' : ''}`}
              style={{ '--fly': fly.color }}
              disabled={taken || !open || atLimit}
              onClick={() => setSelected(fly.index)}
            >
              <span className="dot" />
              <span className="name">{fly.name}</span>
              <span className="state">{taken ? 'taken' : 'open'}</span>
            </button>
          );
        })}
      </div>

      <label>
        Your Solana wallet
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="the address you send USDC from"
          spellCheck={false}
        />
      </label>

      {!config?.demoMode && (
        <>
          <div className="escrow">
            Send exactly <b>{config?.betAmountUsdc} USDC</b> to
            <code>{config?.escrowWallet}</code>
            then paste the transaction signature below.
          </div>
          <label>
            Transaction signature
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="5Kd…"
              spellCheck={false}
            />
          </label>
        </>
      )}

      {atLimit && <p className="warn">You already back {myBets} flies — that is the per-round limit.</p>}
      {!open && <p className="warn">Betting is closed for this round.</p>}
      {error && <p className="error">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <button className="primary" disabled={busy || !open || atLimit} onClick={() => submit(config?.demoMode)}>
        {config?.demoMode ? 'Place demo bet (no USDC)' : 'I paid — verify & place bet'}
      </button>
    </div>
  );
}
