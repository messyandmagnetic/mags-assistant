'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function RetreatPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/donation')
      .then((res) => res.json())
      .then((data) => setUrl(data.url))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12">
      <h1 className="mb-4 text-center font-heading text-3xl">Coyote Commons Retreat</h1>
      <p className="mb-4 text-brand-ink/80">
        A sanctuary in the high desert for rest, creativity, and communal magic.
      </p>
      <p className="mb-6 text-brand-ink/80">
        Address: 20.535 Acres – CRES 425, Coyote, NM 87012
      </p>
      {loading ? (
        <p>Loading donation options...</p>
      ) : url ? (
        <div className="mb-8 text-center">
          <Link href={url} className="rounded-md bg-brand-sage px-6 py-3 text-white">
            Donate to the Retreat
          </Link>
        </div>
      ) : (
        <p className="text-brand-ink/80">
          Add a donation product in Stripe to enable support.
        </p>
      )}
      <h2 className="mb-2 font-heading text-2xl">Gift / Sponsor Ideas</h2>
      <ul className="list-disc pl-5 text-brand-ink/80">
        <li>Native plants and trees</li>
        <li>Outdoor kitchen supplies</li>
        <li>Composting setup</li>
      </ul>
    </section>
  );
}
