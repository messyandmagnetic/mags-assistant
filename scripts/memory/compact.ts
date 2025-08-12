import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const db = process.env.NOTION_DB_MEMORY || '';
const repo = process.env.GITHUB_REPOSITORY || '';
const token = process.env.GITHUB_TOKEN || '';

async function archiveDone(){
  const { results } = await notion.databases.query({
    database_id: db,
    filter: { property: 'Status', select: { equals: 'Done' } }
  });
  for(const page of results){
    await notion.pages.update({page_id:page.id, archived:true});
  }
  return results.length;
}

async function run(){
  if(!process.env.NOTION_TOKEN || !db){
    console.error('Missing Notion env');
    return;
  }
  const archived = await archiveDone();
  const summary = `Archived ${archived} done items.`;
  console.log(summary);
  if(!token||!repo) return;
  const body = summary;
  const issues = await fetch(`https://api.github.com/repos/${repo}/issues?state=open`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
  let issue = issues.find((i:any)=>i.title==='Memory Report');
  if(!issue){
    await fetch(`https://api.github.com/repos/${repo}/issues`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({title:'Memory Report',body})});
  }else{
    await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/comments`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({body})});
  }
}

run().catch(err=>{console.error(err);process.exit(1);});
