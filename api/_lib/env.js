export function validateEnv(required = []) {
  const missing = required.filter((n) => !process.env[n]);
  if (missing.length) {
    console.warn('Missing env vars:', missing.join(', '));
  }
}

