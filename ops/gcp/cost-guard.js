import gcpMetadata from 'gcp-metadata';
import { google } from 'googleapis';

async function getAccessToken() {
  // Try metadata server first
  try {
    const available = await gcpMetadata.isAvailable();
    if (available) {
      const token = await gcpMetadata.instance('service-accounts/default/token');
      return { token: token.access_token, mode: 'metadata' };
    }
  } catch {}

  // Fallback to service account env vars
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const project = process.env.GOOGLE_PROJECT_ID;
  const parts = [
    process.env.GOOGLE_PRIVATE_KEY_P1,
    process.env.GOOGLE_PRIVATE_KEY_P2,
    process.env.GOOGLE_PRIVATE_KEY_P3,
    process.env.GOOGLE_PRIVATE_KEY_P4,
  ];
  if (email && project && parts.every(Boolean)) {
    const key = parts.join('').replace(/\\n/g, '\n');
    const jwt = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    try {
      const { access_token } = await jwt.authorize();
      return { token: access_token, mode: 'service_account', project };
    } catch {}
  }

  return { token: null, mode: 'none' };
}

async function run(apply) {
  const auth = await getAccessToken();
  if (!auth.token) {
    return { ok: false, mode: 'skipped', reason: 'NO_GCP_CREDS' };
  }
  // Placeholder for real cost guard work
  return { ok: true, mode: apply ? 'applied' : 'dry', authMode: auth.mode, project: auth.project };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes('--apply');
  run(apply)
    .then((res) => {
      console.log(JSON.stringify(res));
    })
    .catch((err) => {
      console.error(JSON.stringify({ ok: false, error: err.message }));
      process.exit(1);
    });
}
