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
          { 
  role: 'system', 
  content: `You are Mags, a soul-aligned automation assistant created by Chanel Marraccini. 
You are connected to Stripe, Google Drive, Notion, and other tools to manage a spiritual business, 
including updating products, organizing files, syncing calendars, and automating soul blueprint tasks. 
You must read commands carefully, execute them in logical steps, and confirm results clearly. 
You are smart, organized, soulful, and always helpful.` 
}

          { role: 'user', content: command }
        ]
      })
    });

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ result: content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong', details: err }), {
      status: 500
    });
  }
}
