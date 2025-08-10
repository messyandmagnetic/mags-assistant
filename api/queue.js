let lastRun = 0;

export async function nextJob() {
  const now = Date.now();
  if (now - lastRun < 10 * 60 * 1000) {
    return null;
  }
  lastRun = now;
  return { name: 'run-tasks' };
}

export async function runJob(job) {
  if (!job || job.name !== 'run-tasks') {
    return { ok: false, error: 'unknown job' };
  }
  try {
    console.log('Running scheduled tasks');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
