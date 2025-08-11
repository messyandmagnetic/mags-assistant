export async function generateCaptions(topic: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { captions: [`Caption for ${topic}`], hashtags: '#clip' };
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write engaging social media captions and hashtags and respond in JSON.',
        },
        {
          role: 'user',
          content: `Generate three caption variants and a line of hashtags for a video titled "${topic}".`,
        },
      ],
    }),
  });
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  try {
    const parsed = JSON.parse(content);
    return {
      captions: parsed.captions || [],
      hashtags: parsed.hashtags || '',
    };
  } catch {
    return { captions: [content || ''], hashtags: '' };
  }
}
