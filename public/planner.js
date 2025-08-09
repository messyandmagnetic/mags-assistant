const $ = (s) => document.querySelector(s);
const fields = ['caption','trend','hook','cta','hashtags','safety'];
const data = JSON.parse(localStorage.getItem('plannerDraft') || '{}');
fields.forEach(f => {
  const el = $('#' + f);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = Boolean(data[f]);
    el.addEventListener('change', save);
  } else {
    el.value = data[f] || '';
    el.addEventListener('input', save);
  }
});

function save() {
  const obj = {};
  fields.forEach(f => {
    const el = $('#' + f);
    obj[f] = el.type === 'checkbox' ? el.checked : el.value;
  });
  localStorage.setItem('plannerDraft', JSON.stringify(obj));
}

$('#download').addEventListener('click', () => {
  const obj = JSON.parse(localStorage.getItem('plannerDraft') || '{}');
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plan.json';
  a.click();
});

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#caption').value);
    alert('Copied');
  } catch (err) {
    console.error(err);
  }
});
