// Basic grants scouting via CF worker and Notion

const workerName = process.env.CF_WORKER_NAME;
const notionToken = process.env.NOTION_TOKEN;
const notionDb = process.env.NOTION_DB_GRANTS;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChat = process.env.TELEGRAM_CHAT_ID;

let leads = [];
if (workerName) {
  try {
    const res = await fetch(`https://${workerName}.workers.dev/grants/scout`);
    if (res.ok) {
      leads = await res.json();
    }
  } catch (err) {
    console.error('Worker fetch failed', err);
  }
}

if (!Array.isArray(leads)) leads = [];

for (const lead of leads) {
  lead.tags = ['land','healing','indigenous','fast-turnaround','agriculture','retreat','New Mexico'];
  lead.fit = lead.fit || 3;
}

if (notionToken && notionDb && leads.length) {
  const notionUrl = 'https://api.notion.com/v1/pages';
  for (const lead of leads.slice(0,3)) {
    const body = {
      parent: { database_id: notionDb },
      properties: {
        Name: { title: [{ text: { content: lead.title || lead.name || 'Untitled' } }] },
        FitScore: { number: lead.fit },
        Tags: { multi_select: lead.tags.map(t=>({ name: t })) }
      }
    };
    try {
      await fetch(notionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error('Notion write failed', err);
    }
  }
}

if (telegramToken && telegramChat && leads.length) {
  const top = leads.slice(0,3).map(l=>`• ${l.title || l.name} (Fit ${l.fit}/5)`).join('\n');
  const text = `\uD83C\uDF31 Grant leads\n${top}`;
  try {
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChat, text })
    });
  } catch (err) {
    console.error('Telegram send failed', err);
  }
} else {
  console.log('No leads or Telegram credentials, skipping digest send.');
}
