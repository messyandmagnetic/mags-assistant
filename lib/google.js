import { google } from 'googleapis';
import { requireEnv } from './env.js';

function getAuth() {
  const client_email = requireEnv('GOOGLE_CLIENT_EMAIL');
  const private_key = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  return new google.auth.JWT(client_email, undefined, private_key, [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
}

export function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

export function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

export async function createSpreadsheet(title, parentId) {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, webViewLink',
  });
  return res.data;
}

export async function addSheet(spreadsheetId, title, headers = []) {
  const sheets = getSheets();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  if (headers.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

export async function appendRows(spreadsheetId, range, values) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}
