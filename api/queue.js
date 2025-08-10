let lastRun = 0;

export async function claimJob() {
  const now = Date.now();
  if (now - lastRun < 10 * 60 * 1000) {
    return null;
  }
  lastRun = now;
  return { jobId: 'run-tasks', payload: {} };
}

export async function runJob(job) {
  if (!job || job.jobId !== 'run-tasks') {
    return { ok: false, error: 'unknown job' };
  }
  try {
    console.log('Running scheduled tasks');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function completeJob(job) {
  // no-op for now
  return { ok: true };
}
