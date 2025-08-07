export async function POST(req) {
  const body = await req.json();
  const command = body.command;
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
          { role: 'system', content: 'You are Mags, a powerful assistant designed to update Stripe product listings automatically.' },
          { role: 'user', content: command }
        ]
      })
    });

    const data = await openaiResponse.json();
    const reply = data.choices?.[0]?.message?.content || "No reply found.";

    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
