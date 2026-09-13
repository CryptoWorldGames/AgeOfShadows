import fs from 'node:fs';
import path from 'node:path';

/**
 * Dead-simple durable JSON store. Bets and payouts are money, so every mutation
 * is flushed synchronously and written atomically (tmp file + rename) — a crash
 * mid-write can never leave a truncated ledger.
 */
export class Store {
  constructor(file) {
    this.file = path.resolve(file);
    this.data = {
      rounds: [],
      // signature -> betId, so the same transfer can never fund two bets.
      usedSignatures: {},
      nextRoundId: 1,
    };
    this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      this.data = { ...this.data, ...JSON.parse(raw) };
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      this.save();
    }
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get rounds() {
    return this.data.rounds;
  }

  roundById(id) {
    return this.data.rounds.find((r) => r.id === id) || null;
  }

  openRound() {
    return this.data.rounds.find((r) => r.status === 'open') || null;
  }

  activeRounds() {
    return this.data.rounds.filter((r) => r.status === 'open' || r.status === 'locked' || r.status === 'racing');
  }

  isSignatureUsed(sig) {
    return Boolean(this.data.usedSignatures[sig]);
  }

  markSignature(sig, betId) {
    this.data.usedSignatures[sig] = betId;
  }

  createRound(round) {
    round.id = this.data.nextRoundId++;
    this.data.rounds.push(round);
    this.save();
    return round;
  }
}
