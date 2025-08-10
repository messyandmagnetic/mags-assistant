import Head from 'next/head';
import { Inter, Fraunces } from 'next/font/google';
import { getNotion } from '../../lib/clients/notion';

const inter = Inter({ subsets: ['latin'] });
const fraunces = Fraunces({ subsets: ['latin'] });

function readProp(page: any, name: string) {
  const prop = page.properties[name];
  if (!prop) return '';
  if (prop.type === 'title') return prop.title[0]?.plain_text || '';
  if (prop.type === 'rich_text') return prop.rich_text[0]?.plain_text || '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'date') return prop.date?.start || '';
  return '';
}

export default async function PlannerPage() {
  const notion = getNotion();
  const db = process.env.NOTION_QUEUE_DB!;
  const res = await notion.databases.query({ database_id: db });
  const cols: Record<string, any[]> = { Queue: [], Running: [], Done: [] };
  for (const p of res.results) {
    const status = readProp(p, 'Status') || 'Queue';
    if (!cols[status]) cols[status] = [];
    cols[status].push(p);
  }

  const order = ['Queue', 'Running', 'Done'];

  return (
    <>
      <Head>
        <link rel="stylesheet" href="/brand.css" />
      </Head>
      <div
        className={`${inter.className} min-h-screen bg-[#FBF6EF] text-[#2B2B2B] p-4`}
      >
        <h1 className={`${fraunces.className} text-2xl mb-4`}>Planner</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {order.map((key) => (
            <div key={key}>
              <h2 className={`${fraunces.className} text-xl mb-2`}>{key}</h2>
              <div className="flex flex-col gap-2">
                {cols[key]?.map((p) => {
                  const title = readProp(p, 'Task');
                  const last =
                    readProp(p, 'Last Log') || readProp(p, 'Last Error');
                  const updated =
                    readProp(p, 'Last Updated') ||
                    readProp(p, 'Date Updated') ||
                    '';
                  return (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      className="block rounded shadow bg-white p-2 border"
                    >
                      <div className="font-semibold">{title}</div>
                      {last && <div className="text-sm">{last}</div>}
                      {updated && (
                        <div className="text-xs text-gray-500">{updated}</div>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

