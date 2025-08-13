// Minimal node script to print a preview URL or empty string
const fetch = global.fetch || ((...a)=>import('node-fetch').then(m=>m.default(...a)));

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const sha = process.env.GITHUB_SHA || "";
const pr = process.env.GITHUB_REF_NAME?.match(/^refs\/pull\/(\d+)\/merge$/)?.[1] ||
           process.env.GITHUB_HEAD_REF || "";
if (!token || !projectId) {
  console.error("Missing VERCEL_TOKEN or VERCEL_PROJECT_ID");
  process.stdout.write("");
  process.exit(0);
}

const api = new URL("https://api.vercel.com/v6/deployments");
api.searchParams.set("projectId", projectId);
api.searchParams.set("state", "READY");
api.searchParams.set("limit", "20");

(async () => {
  const res = await fetch(api, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    console.error("Vercel API error", res.status, body);
    process.stdout.write("");
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.deployments) ? data.deployments : data;
  // Try match current commit
  let d = items.find(d => d?.meta?.githubCommitSha === sha);
  // Else match PR id or branch
  if (!d && pr) d = items.find(d => String(d?.meta?.githubPrId || "") === String(pr));
  // Else newest READY preview
  if (!d) d = items.find(d => d?.readyState === "READY" && d?.target === "preview");
  if (!d) {
    console.log("No READY preview deployment found yet.");
    process.stdout.write("");
    return;
  }
  const url = d.url?.startsWith("http") ? d.url : `https://${d.url}`;
  process.stdout.write(url);
})();
