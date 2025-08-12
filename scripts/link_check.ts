import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const repo = process.env.GITHUB_REPOSITORY || '';
const token = process.env.GITHUB_TOKEN || '';

function collectLinks(): string[] {
  const links = new Set<string>();
  // public/check.html
  const check = readFileSync('public/check.html', 'utf8');
  for (const m of check.matchAll(/href="(https?:[^"#]+)"/g)) links.add(m[1]);
  // markdown files
  function walk(dir:string){
    for (const f of readdirSync(dir,{withFileTypes:true})){
      if (f.name.startsWith('.')) continue;
      const p = join(dir,f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.md')){
        const text = readFileSync(p,'utf8');
        for (const m of text.matchAll(/https?:[^\)\s]+/g)) links.add(m[0]);
      }
    }
  }
  walk('.');
  return Array.from(links);
}

async function check(url:string){
  try{
    const r = await fetch(url,{method:'HEAD'});
    if(!r.ok) return `${url} -> ${r.status}`;
  }catch(e){
    return `${url} -> error`;
  }
  return '';
}

async function run(){
  const links = collectLinks();
  const broken:string[] = [];
  for(const l of links){
    const res = await check(l);
    if(res) broken.push(res);
  }
  if(broken.length===0){
    console.log('no broken links');
    return;
  }
  const body = `Broken links:\n\n${broken.join('\n')}`;
  const issues = await fetch(`https://api.github.com/repos/${repo}/issues?state=open`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
  let issue = issues.find((i:any)=>i.title==='Link Breakage');
  if(!issue){
    issue = await fetch(`https://api.github.com/repos/${repo}/issues`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({title:'Link Breakage',body})}).then(r=>r.json());
  }else{
    await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/comments`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({body})});
  }
  console.log('reported', broken.length, 'links');
}

run().catch(err=>{console.error(err);process.exit(1);});
