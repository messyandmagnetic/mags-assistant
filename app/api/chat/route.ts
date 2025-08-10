import { NextRequest } from 'next/server';
import { createOpenAIClient, buildSystemPrompt } from '../../../lib/ai';
import { checkAuth } from '../../../lib/auth';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return new Response('Unauthorized', { status: 401 });
  }
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const client = createOpenAIClient();
  const system = { role: 'system', content: buildSystemPrompt() };
  try {
    const upstream = await client.streamChat({
      model: 'gpt-4o-mini',
      messages: [system, ...messages],
      stream: true,
    });
    return new Response(upstream.body, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    console.error('chat error', err);
    return new Response('Upstream error', { status: 500 });
  }
}
