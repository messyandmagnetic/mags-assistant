import { google } from 'googleapis';

export default async function(req, res) {
  const next_steps = [];
  const email = process.env.GOOGLE_SERVICE_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    next_steps.push('Set GOOGLE_SERVICE_EMAIL and GOOGLE_PRIVATE_KEY');
    return res.json({ ok: false, reason: 'missing service account', next_steps });
  }
  try {
    const auth = new google.auth.JWT(email, null, key.replace(/\\n/g, '\n'), [
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ]);
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.list({ pageSize: 1, fields: 'files(id)' });
    return res.json({ ok: true });
  } catch (e) {
    return res.json({ ok: false, reason: e.message, next_steps });
  }
}
