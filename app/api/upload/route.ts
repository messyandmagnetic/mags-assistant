import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { runClipFinder } from '../../../lib/clipFinder';
import { generateCaptions } from '../../../lib/captions';
import { enqueueTask } from '../../../lib/notion';
import { sendTelegram } from '../../../lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const dir = path.join(process.cwd(), 'tmp');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${Date.now()}-${file.name}`);
    await writeFile(filePath, buffer);

    const clip = await runClipFinder(filePath);
    const { captions, hashtags } = await generateCaptions(file.name);

    try {
      await enqueueTask({
        task: 'Approve clip',
        type: 'content',
        data: { filePath, clip, captions, hashtags },
      });
    } catch {}

    try {
      await sendTelegram(`New clip uploaded:\n${captions[0] || ''}\n${hashtags}`);
    } catch {}

    return NextResponse.json({ ok: true, captions, hashtags });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
