'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DonatePage() {
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
    <section className="py-12 text-center">
      <h1 className="mb-4 font-heading text-3xl">Support our work</h1>
      {loading ? (
        <p>Loading...</p>
      ) : url ? (
        <Link href={url} className="rounded-md bg-brand-sage px-6 py-3 text-white">
          Donate
        </Link>
      ) : (
        <p className="text-brand-ink/80">
          Add a donation product in Stripe to enable this button.
        </p>
      )}
    </section>
  );
}
