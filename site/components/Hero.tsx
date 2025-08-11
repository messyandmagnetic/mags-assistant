import Link from 'next/link';

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
      <h1 className="text-4xl font-heading">Handcrafted for Homebodies</h1>
      <p className="max-w-prose text-brand-ink/80">
        Cozy goods and gifts inspired by countryside calm.
      </p>
      <div className="flex gap-4 pt-4">
        <Link
          href="/shop"
          className="rounded-md bg-brand-sage px-6 py-3 text-white"
        >
          Shop
        </Link>
        <Link
          href="/donate"
          className="rounded-md bg-brand-gold px-6 py-3 text-brand-ink"
        >
          Donate
        </Link>
      </div>
    </section>
  );
}
