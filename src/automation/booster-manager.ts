import fs from 'fs';
import path from 'path';

export interface BoosterAccount {
  id: string;
  username: string;
  alias: string;
  role: string;
  postFrequency: string;
  interact: boolean;
  lastUsed?: string;
}

export class BoosterAccountManager {
  private accounts: BoosterAccount[] = [];
  private statePath: string;

  constructor(accountsPath = 'data/accounts.json', statePath = 'data/booster-state.json') {
    this.statePath = statePath;
    const raw = fs.readFileSync(accountsPath, 'utf-8');
    this.accounts = JSON.parse(raw).filter((a: BoosterAccount) => a.role === 'booster');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, string>;
      this.accounts.forEach((a) => (a.lastUsed = state[a.id]));
    }
  }

  /** Select the booster account least recently used */
  nextBooster(): BoosterAccount | undefined {
    const sorted = [...this.accounts].sort((a, b) => {
      const t1 = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const t2 = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return t1 - t2;
    });
    return sorted[0];
  }

  markUsed(id: string) {
    const acc = this.accounts.find((a) => a.id === id);
    if (!acc) return;
    acc.lastUsed = new Date().toISOString();
    const state: Record<string, string> = {};
    this.accounts.forEach((a) => {
      if (a.lastUsed) state[a.id] = a.lastUsed;
    });
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }
}
