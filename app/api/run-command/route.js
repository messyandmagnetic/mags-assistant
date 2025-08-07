export async function POST(req) {
  const body = await req.json();
  const command = body.command || "(no command)";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are Mags. Turn user commands into concrete actions. Reply briefly.' },
          { role: 'user', content: command }
        ]
      })
    });

    const data = await openaiResponse.json();
    const reply = data?.choices?.[0]?.message?.content ?? 'No reply.';

    return new Response(JSON.stringify({ result: reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
