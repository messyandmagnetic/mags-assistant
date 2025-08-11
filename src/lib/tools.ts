import fs from 'fs/promises';
import path from 'path';

export type Lead = {
  name: string;
  url: string;
  brief?: string;
  matchScore?: number;
};

async function loadBrand() {
  const file = path.join(process.cwd(), 'src', 'memory', 'brand.json');
  const json = await fs.readFile(file, 'utf8');
  return JSON.parse(json);
}

export async function searchLeads(query?: string): Promise<Lead[]> {
  const brand = await loadBrand();
  // TODO: implement real search using grant directories
  console.log('searchLeads brand keywords', brand.mission, query);
  return [];
}

export async function proposeOutreach(leadId: string) {
  const brand = await loadBrand();
  // TODO: pull lead info from Notion and craft a message
  const draft = `${brand.donor_pitch_core}\n\nThank you,\nMessy & Magnetic`;
  return { ok: true, draft };
}

export async function sendOutreach(runId: string) {
  // TODO: send email or submit form
  console.log('sendOutreach called', runId);
  return { ok: true };
}
