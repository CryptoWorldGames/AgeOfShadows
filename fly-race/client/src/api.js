const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
  return body;
};

export const getConfig = () => fetch('/api/config').then(json);
export const getState = () => fetch('/api/state').then(json);

export const placeBet = ({ wallet, flyIndex, signature }) =>
  fetch('/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, flyIndex, signature }),
  }).then(json);

export const placeFakeBet = ({ wallet, flyIndex }) =>
  fetch('/api/dev/fake-bet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, flyIndex }),
  }).then(json);
