const QUIZ_FORM_ID = '3qlZQ9';
const FEEDBACK_FORM_ID = 'nGPKDo';

async function fetchAll(formId) {
  let page = 1;
  const out = [];
  const key = process.env.TALLY_API_KEY;
  while (true) {
    const url = `https://api.tally.so/forms/${formId}/responses?page=${page}&limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const js = await res.json();
    const items = js.data || js.responses || [];
    out.push(...items);
    if (!js.next_page) break;
    page++;
  }
  return out;
}

function parseQuizStats(list) {
  const prod = {};
  let sum = 0;
  let count = 0;
  for (const item of list) {
    const fields = item.data?.fields || item.data || item.fields || [];
    let product = '', score = '';
    if (Array.isArray(fields)) {
      for (const f of fields) {
        const key = (f.key || f.id || f.label || '').toString().toLowerCase();
        const v = f.value || f.answer || '';
        if (key === 'product_choice') product = v;
        if (key === 'score') score = v;
      }
    } else if (fields && typeof fields === 'object') {
      product = fields.product_choice || '';
      score = fields.score || '';
    }
    if (product) prod[product] = (prod[product] || 0) + 1;
    if (score) { sum += Number(score); count++; }
  }
  const top = Object.entries(prod).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'n/a';
  const avg = count ? (sum / count).toFixed(1) : '0';
  return { top, avg };
}

(async () => {
  if (!process.env.TALLY_API_KEY) {
    console.log('TALLY_API_KEY missing');
    return;
  }
  const quiz = await fetchAll(QUIZ_FORM_ID);
  const feedback = await fetchAll(FEEDBACK_FORM_ID);
  const stats = parseQuizStats(quiz);
  const msg = `[Mags] Daily digest\nQuiz submissions: ${quiz.length}\nFeedback submissions: ${feedback.length}\nTop product: ${stats.top}\nAvg score: ${stats.avg}`;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg }),
    });
  } else {
    console.log(msg);
  }
})();
