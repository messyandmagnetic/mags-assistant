'use client';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Inter, Fraunces } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const fraunces = Fraunces({ subsets: ['latin'] });

interface Item {
  id: string;
  title: string;
  status: string;
  lastLog?: string;
  updated?: string;
  url?: string;
}

export default function PlannerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/queue/list')
      .then((r) => r.json())
      .then((data) => setItems(data.results || []))
      .finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: 'Queued', label: 'Queue' },
    { key: 'Running', label: 'Running' },
    { key: 'Done', label: 'Done' },
  ];

  return (
    <>
      <Head>
        <link rel="stylesheet" href="/brand.css" />
      </Head>
      <div className={`${inter.className} min-h-screen bg-[#FBF6EF] text-[#2B2B2B] p-4`}>
        <h1 className={`${fraunces.className} text-2xl mb-4`}>Planner</h1>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cols.map((c) => (
              <div key={c.key}>
                <h2 className={`${fraunces.className} text-xl mb-2`}>{c.label}</h2>
                <div className="flex flex-col gap-2">
                  {items
                    .filter((i) => i.status === c.key)
                    .map((i) => (
                      <a
                        key={i.id}
                        href={i.url}
                        className="block rounded shadow bg-white p-2"
                      >
                        <div className="font-semibold">{i.title}</div>
                        {i.lastLog && (
                          <div className="text-sm">{i.lastLog}</div>
                        )}
                        {i.updated && (
                          <div className="text-xs text-gray-500">{new Date(i.updated).toLocaleString()}</div>
                        )}
                      </a>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
