// Minimal Google Sheets helper functions used by the worker.
// Note: actual Google Sheets calls require service account credentials in env.
// This module uses fetch and JWT auth to talk to Google APIs.

export interface Env {
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY_P1?: string;
  GOOGLE_PRIVATE_KEY_P2?: string;
  GOOGLE_PRIVATE_KEY_P3?: string;
  GOOGLE_PRIVATE_KEY_P4?: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(env: Env): Promise<string> {
  if (!env.GOOGLE_CLIENT_EMAIL) throw new Error('missing client email');
  const key =
    (env.GOOGLE_PRIVATE_KEY_P1 || '') +
    (env.GOOGLE_PRIVATE_KEY_P2 || '') +
    (env.GOOGLE_PRIVATE_KEY_P3 || '') +
    (env.GOOGLE_PRIVATE_KEY_P4 || '');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: env.GOOGLE_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const unsigned = `${header}.${payload}`;
  const keyData = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(keyData),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const signature = base64url(sigBuf);
  const assertion = `${unsigned}.${signature}`;
  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', assertion);
  const r = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', body });
  const js = await r.json();
  return js.access_token as string;
}

async function sheetsFetch(env: Env, url: string, init: RequestInit = {}) {
  const token = await getAccessToken(env);
  const headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
  return fetch(url, { ...init, headers });
}

export async function ensureHeaders(
  env: Env,
  spreadsheetId: string,
  sheet: string,
  headers: string[]
) {
  const range = `${sheet}!1:1`;
  await sheetsFetch(
    env,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [headers] }),
      headers: { 'content-type': 'application/json' },
    }
  );
}

export async function findRowBySubmissionId(
  env: Env,
  spreadsheetId: string,
  sheet: string,
  submissionId: string
): Promise<number | null> {
  const range = `${sheet}!A:A`;
  const r = await sheetsFetch(
    env,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  );
  const js = await r.json();
  const rows: string[][] = js.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === submissionId) return i + 1; // 1-indexed
  }
  return null;
}

export async function upsertRow(
  env: Env,
  spreadsheetId: string,
  sheet: string,
  row: Record<string, any>,
  headers: string[]
) {
  const rowIndex = await findRowBySubmissionId(env, spreadsheetId, sheet, row['submission_id']);
  const values = headers.map((h) => row[h] || '');
  if (rowIndex) {
    const range = `${sheet}!A${rowIndex}`;
    await sheetsFetch(
      env,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [values] }),
        headers: { 'content-type': 'application/json' },
      }
    );
  } else {
    await sheetsFetch(
      env,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheet}!A:append?valueInputOption=RAW`,
      {
        method: 'POST',
        body: JSON.stringify({ values: [values] }),
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
