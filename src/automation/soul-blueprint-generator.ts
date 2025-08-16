import { getSheets, getDrive, getDocs } from '../../lib/google.js';
import { tgSend } from '../../lib/telegram.ts';

/**
 * SoulBlueprintGenerator watches the "Soul Blueprint Orders – Messy & Magnetic™" sheet
 * for new entries and produces personalized PDF readings using Google Doc templates.
 * Each public method is implemented with simple Google API calls so that real
 * integrations can be added later without changing the overall flow.
 */

export interface SoulBlueprintEnv {
  SHEET_ID?: string; // Spreadsheet ID for "Soul Blueprint Orders – Messy & Magnetic™"
  READINGS_FOLDER_ID?: string; // Drive folder that contains per‑client folders
  MINI_TEMPLATE_ID?: string; // Drive file ID for mini_template.docx
  LITE_TEMPLATE_ID?: string; // Drive file ID for lite_template.docx
  FULL_TEMPLATE_ID?: string; // Drive file ID for full_blueprint_template.docx
  TELEGRAM_BOT_TOKEN?: string; // optional – for daily summary
  TELEGRAM_CHAT_ID?: string;
}

interface OrderRow {
  index: number; // 1 indexed row number in the sheet
  data: Record<string, string>;
}

const SHEET_NAME = 'Soul Blueprint Orders – Messy & Magnetic™';

export class SoulBlueprintGenerator {
  constructor(private env: SoulBlueprintEnv) {}

  /**
   * Main entry point. Finds unprocessed rows, generates readings and updates the sheet.
   */
  async run(): Promise<{ processed: number }> {
    const orders = await this.fetchUnprocessedRows();
    const processedNames: string[] = [];
    for (const order of orders) {
      const link = await this.generateReading(order.data);
      await this.markProcessed(order.index, link);
      processedNames.push(order.data['Name']);
    }
    if (processedNames.length) {
      await this.sendSummary(processedNames);
    }
    return { processed: processedNames.length };
  }

  /**
   * Pull all rows from the sheet and return those with an empty "Processed?" column.
   */
  private async fetchUnprocessedRows(): Promise<OrderRow[]> {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: this.env.SHEET_ID!,
      range: `${SHEET_NAME}!A:Z`,
    });
    const rows: string[][] = res.data.values || [];
    const headers = rows[0] || [];
    const processedIdx = headers.indexOf('Processed?');
    const result: OrderRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if ((row[processedIdx] || '').toLowerCase() === 'yes') continue;
      const data: Record<string, string> = {};
      headers.forEach((h, idx) => (data[h] = row[idx] || ''));
      result.push({ index: i + 1, data });
    }
    return result;
  }

  /**
   * Decide which template should be used based on the product column.
   */
  private pickTemplate(product: string): { id: string; label: string } {
    switch (product) {
      case 'Mini Soul Snapshot':
        return { id: this.env.MINI_TEMPLATE_ID!, label: 'Mini Soul Snapshot' };
      case 'Lite Soul Reading':
        return { id: this.env.LITE_TEMPLATE_ID!, label: 'Lite Soul Reading' };
      case 'Full Soul Blueprint':
      default:
        return { id: this.env.FULL_TEMPLATE_ID!, label: 'Full Soul Blueprint' };
    }
  }

  /**
   * Copy the appropriate template, fill in placeholders and export a PDF.
   * Returns the Drive link to the generated PDF.
   */
  private async generateReading(data: Record<string, string>): Promise<string> {
    const drive = await getDrive();
    const docs = await getDocs();
    const { id: templateId, label } = this.pickTemplate(data['Product']);
    const name = data['Name'];
    const firstName = name.split(' ')[0];
    const folderId = await this.ensureClientFolder(firstName);

    const copy = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `${name} – ${label} Reading`,
        parents: [folderId],
      },
      fields: 'id',
    });
    const docId = copy.data.id!;

    // Replace placeholders like {{Name}} in the copied document.
    const requests = [
      {
        replaceAllText: {
          containsText: { text: '{{Name}}', matchCase: true },
          replaceText: name,
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{{Birth Date}}', matchCase: true },
          replaceText: data['Birth Date'] || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{{Birth Time}}', matchCase: true },
          replaceText: data['Birth Time'] || '',
        },
      },
      {
        replaceAllText: {
          containsText: { text: '{{Birth Location}}', matchCase: true },
          replaceText: data['Birth Location'] || '',
        },
      },
    ];
    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });

    // Export the filled document to PDF and upload back to Drive.
    const pdf = await drive.files.export(
      { fileId: docId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    );
    const pdfFile = await drive.files.create({
      requestBody: {
        name: `${name} – ${label} Reading.pdf`,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: Buffer.from(pdf.data as ArrayBuffer),
      },
      fields: 'webViewLink',
    });
    return pdfFile.data.webViewLink || '';
  }

  /** Ensure a folder exists for the client's first name. */
  private async ensureClientFolder(firstName: string): Promise<string> {
    const drive = await getDrive();
    const parent = this.env.READINGS_FOLDER_ID!;
    const q = `'${parent}' in parents and name='${firstName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({ q, fields: 'files(id)' });
    const existing = res.data.files?.[0];
    if (existing) return existing.id!;
    const folder = await drive.files.create({
      requestBody: {
        name: firstName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      },
      fields: 'id',
    });
    return folder.data.id!;
  }

  /**
   * Update the row in the sheet to mark the order as processed and store the PDF link.
   */
  private async markProcessed(rowIndex: number, pdfLink: string): Promise<void> {
    const sheets = await getSheets();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: this.env.SHEET_ID! });
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
    const processedCol = this.columnLetter(sheet, 'Processed?');
    const pdfCol = this.columnLetter(sheet, 'PDF Link');
    const readyCol = this.columnLetter(sheet, 'Ready for Delivery');
    const data = [
      { range: `${SHEET_NAME}!${processedCol}${rowIndex}`, values: [['Yes']] },
      { range: `${SHEET_NAME}!${pdfCol}${rowIndex}`, values: [[pdfLink]] },
      { range: `${SHEET_NAME}!${readyCol}${rowIndex}`, values: [['Yes']] },
    ];
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.env.SHEET_ID!,
      requestBody: { data, valueInputOption: 'USER_ENTERED' },
    });

    if (sheet?.properties?.sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.env.SHEET_ID!,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  startRowIndex: rowIndex - 1,
                  endRowIndex: rowIndex,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.9, green: 1, blue: 0.9 },
                  },
                },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      });
    }
  }

  /** Helper to map header names to column letters. */
  private columnLetter(sheet: any | undefined, header: string): string {
    const headers = sheet?.data?.[0]?.rowData?.[0]?.values?.map((v: any) => v.formattedValue) || [];
    const idx = headers.indexOf(header);
    let n = idx;
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  /** Send a playful Telegram summary after processing orders. */
  private async sendSummary(names: string[]) {
    await tgSend(
      `✨ ${names.length} new Soul Blueprints processed today (${names.join(', ')}).`
    );
  }
}

export async function runSoulBlueprintGenerator(env: SoulBlueprintEnv) {
  const gen = new SoulBlueprintGenerator(env);
  return gen.run();
}

