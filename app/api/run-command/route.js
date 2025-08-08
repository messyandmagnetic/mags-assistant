import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { command } = await req.json();
    if (!command) {
      return NextResponse.json({ error: 'Missing command' }, { status: 400 });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are Mags, a helpful assistant.' },
        { role: 'user', content: command }
      ]
    });
    const message = completion.choices?.[0]?.message?.content?.trim() || '';
    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
