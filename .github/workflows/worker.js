import fs from 'fs';

async function run() {
  if (!fs.existsSync('job.json')) {
    console.log('no job.json');
    return;
  }
  const jobData = JSON.parse(fs.readFileSync('job.json', 'utf8'));
  if (!jobData.ok || !jobData.job) {
    console.log('no job');
    return;
  }
  const job = jobData.job;
  const usePW = process.env.RUN_WITH_PLAYWRIGHT === 'true';
  let status = 'Done';
  let result = '';
  let viewerURL = '';
  try {
    if (usePW) {
      // placeholder for Playwright execution
      result = 'ran with Playwright';
    } else {
      const res = await fetch(`${process.env.API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mags-Key': process.env.MAGS_KEY || '',
        },
        body: JSON.stringify({ command: job.command }),
      });
      result = await res.text();
    }
  } catch (e) {
    status = 'Failed';
    result = e.message;
  }
  await fetch(`${process.env.API_BASE}/api/queue/finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Key': process.env.WORKER_KEY || '',
    },
    body: JSON.stringify({ id: job.id, status, result, viewerURL }),
  });
}

run();
