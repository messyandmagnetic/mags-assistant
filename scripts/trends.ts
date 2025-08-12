import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const db = process.env.NOTION_DB_TRENDS || '';

async function fetchHN() {
  const r = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page');
  const j = await r.json();
  return j.hits.slice(0,3).map((h:any)=>({title:h.title, url:h.url || h.story_url}));
}

async function fetchGitHub() {
  const r = await fetch('https://gh-trending-api.de.a9sapp.eu/repositories');
  const j = await r.json();
  return j.slice(0,3).map((repo:any)=>({title:repo.repositoryName, url:repo.url}));
}

async function fetchNYT() {
  const r = await fetch('https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml');
  const text = await r.text();
  const matches = [...text.matchAll(/<item>\s*<title><!\[CDATA\[(.*?)\]\]><\/title>\s*<link>(.*?)<\/link>/g)];
  return matches.slice(0,3).map(m=>({title:m[1], url:m[2]}));
}

async function save(items:any[], source:string) {
  for (const it of items) {
    await notion.pages.create({
      parent:{database_id:db},
      properties:{
        Name:{title:[{text:{content:it.title}}]},
        Source:{select:{name:source}},
        Link:{url:it.url}
      }
    });
  }
}

async function main() {
  if (!process.env.NOTION_TOKEN || !db) {
    console.error('Missing Notion env');
    return;
  }
  await save(await fetchHN(),'HN');
  await save(await fetchGitHub(),'GitHub');
  await save(await fetchNYT(),'NYT');
  console.log('Trends saved');
}

main().catch(err=>{console.error(err);process.exit(1);});
