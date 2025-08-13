#!/usr/bin/env node
// @ts-nocheck
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function readSources() {
  const file = path.join(root, 'ops/context/sources.yml');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('-')) out.push(t.replace(/^-+\s*/, ''));
  }
  return out;
}

function parseEnvNames() {
  const names = new Set();
  for (const f of ['.env.example', '.env.sample']) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=/);
      if (m) names.add(m[1]);
    }
  }
  return Array.from(names).sort();
}

function scanWorkerRoutes() {
  const dir = path.join(root, 'worker');
  if (!fs.existsSync(dir)) return [];
  const routes = new Set();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const re = /['"](\/[a-zA-Z0-9\/-]+)['"]/g;
    let m;
    while ((m = re.exec(content))) {
      const r = m[1];
      if (r.startsWith('/')) routes.add(r);
    }
  }
  return Array.from(routes).sort();
}

function scanVercelEndpoints() {
  const endpoints = new Set();
  const vercelPath = path.join(root, 'vercel.json');
  if (fs.existsSync(vercelPath)) {
    try {
      const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
      if (Array.isArray(vercel.routes)) {
        for (const r of vercel.routes) {
          if (r.src) endpoints.add(r.src);
          if (r.path) endpoints.add(r.path);
        }
      }
      if (Array.isArray(vercel.cron)) {
        for (const c of vercel.cron) {
          if (c.path) endpoints.add(`cron:${c.path}`);
          else if (c.url) endpoints.add(`cron:${c.url}`);
        }
      }
    } catch {}
  }
  const apiDirs = ['api', 'pages/api', 'app/api'];
  for (const dir of apiDirs) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    (function walk(d) {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else endpoints.add('/' + path.relative(root, p).replace(/\\/g, '/').replace(/^pages\//, '').replace(/^app\//, '').replace(/\.ts$|\.js$/, ''));
      }
    })(full);
  }
  return Array.from(endpoints).sort();
}

async function getRecentPRs() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log('PR fetch skipped (missing token or repo)');
    return [];
  }
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const url = `https://api.github.com/repos/${repo}/pulls?state=closed&per_page=20&sort=updated&direction=desc`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      console.log('PR fetch failed');
      return [];
    }
    const arr = await res.json();
    return arr
      .filter((pr) => pr.merged_at && pr.merged_at >= since)
      .map((pr) => `- ${pr.title}`);
  } catch (e) {
    console.log('PR fetch error');
    return [];
  }
}

function readRuntimeFiles() {
  const dir = path.join(root, '.runtime');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
}

function mdToHtml(md) {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/^\- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');
  return html;
}

(async function main() {
  readSources(); // currently unused but ensures file is parsed

  const workerRoutes = scanWorkerRoutes();
  const vercelEndpoints = scanVercelEndpoints();
  const envNames = parseEnvNames();
  const prLines = await getRecentPRs();
  readRuntimeFiles(); // not used but triggers skip log if missing

  const workerBase = 'https://tight-snow-2840.messyandmagnetic.workers.dev';

  const projectContext = `# PROJECT_CONTEXT—messyandmagnetic

## Mission & Current Objective
Coyote Commons land acquisition, donor + bridge-financing push.

## Active Endpoints
### Worker
${workerRoutes.map((r) => `- ${workerBase}${r}`).join('\n') || '- none'}

### Vercel
${vercelEndpoints.map((r) => `- ${r}`).join('\n') || '- none'}

## Environments & Secrets
${envNames.map((n) => `- ${n}`).join('\n') || '- none'}

## Stripe Links
| Link | Env Var | Present |
| --- | --- | --- |
| One-time | GENERAL_ONE_TIME_HINT | ${envNames.includes('GENERAL_ONE_TIME_HINT') ? 'set' : 'TODO'} |
| Monthly | GENERAL_MONTHLY_HINT | ${envNames.includes('GENERAL_MONTHLY_HINT') ? 'set' : 'TODO'} |
| Filing 250 | FILING_250_HINT | ${envNames.includes('FILING_250_HINT') ? 'set' : 'TODO'} |

## Gmail label/filter plan
Label: Land Outreach  
Keywords: Laurie, Coyote, land, grant, donor, funding, financing, nonprofit

## Notion targets
- HQ page id: TODO
- Donor DB id: TODO

## Runbook – daily loop
- Scan Stripe
- Check Gmail label
- Create follow-ups
- Send Telegram digest

## Open issues
${prLines.join('\n') || 'none'}

## Manual steps
- Review recent PRs and deployments manually.
`;

  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'PROJECT_CONTEXT—messyandmagnetic.md'), projectContext.trim() + '\n');

  const quickStart = `# QUICK_START—current_step

## What's next
1. Verify worker /health
2. Run land scan
3. Run land summary
4. Review donor leads
5. Update Notion database
6. Send Telegram digest
7. Audit Stripe links
8. Review CI failures
9. Triage open PRs
10. Plan next actions

## Current errors
- None observed.

## cURL tests
\n# Health\ncurl -s ${workerBase}/health\n\n# Scan\ncurl -s -X POST -H "X-Fetch-Pass: $FETCH_PASS" ${workerBase}/land/scan\n\n# Summary\ncurl -s -X POST -H "X-Fetch-Pass: $FETCH_PASS" ${workerBase}/land/summary\n`;
  fs.writeFileSync(path.join(root, 'docs', 'QUICK_START—current_step.md'), quickStart.trim() + '\n');

  const links = `# LINKS—endpoints-and-dashboards

- Cloudflare Worker: ${workerBase}
- Vercel site: https://mags-assistant.vercel.app
- Vercel dashboard: https://vercel.com/messyandmagnetic/mags-assistant
- Stripe webhook: https://assistant.messyandmagnetic.com/api/stripe-webhook
- Notion HQ page: TODO
- Telegram bot: https://t.me/TODO
`;
  fs.writeFileSync(path.join(root, 'docs', 'LINKS—endpoints-and-dashboards.md'), links.trim() + '\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Project Context</title><style>body{font-family:sans-serif;padding:20px;line-height:1.6}hr{margin:2rem 0}</style></head><body>${mdToHtml(projectContext)}<hr/>${mdToHtml(quickStart)}<hr/>${mdToHtml(links)}</body></html>`;
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'context.html'), html);

  if (process.env.NOTION_TOKEN && process.env.NOTION_HQ_PAGE_ID) {
    console.log('Notion mirror skipped (not implemented)');
  } else {
    console.log('Notion mirror skipped (missing token)');
  }
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY_P1) {
    console.log('Drive mirror skipped (not implemented)');
  } else {
    console.log('Drive mirror skipped (missing token)');
  }

  console.log('Context build complete');
})();

