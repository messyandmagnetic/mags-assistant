import { localEnv } from '../env.local';

export function getEnv(key: string, provided: Record<string, string | undefined> = {}): string | undefined {
  return provided[key] || process.env[key] || localEnv[key];
}
