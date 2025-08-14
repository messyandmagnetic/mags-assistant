export function getSecret(name: string): { value?: string; present: boolean } {
  const value = process.env[name];
  return value ? { value, present: true } : { present: false };
}

export function note(name: string): string {
  return getSecret(name).present ? 'OK' : 'missing';
}

export async function guard<T>(label: string, fn: () => Promise<T>): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
