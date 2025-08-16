import Link from 'next/link';

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
      <h1 className="text-4xl font-heading">Messy &amp; Magnetic™</h1>
      <p className="max-w-prose text-brand-ink/80">
        A validating, warm, intuitive, and magical space to spark your soul flow.
      </p>
      <div className="flex flex-wrap justify-center gap-4 pt-4">
        <Link
          href="/shop"
          className="rounded-md bg-brand-sage px-6 py-3 text-white"
        >
          Shop
        </Link>
        <Link
          href="/quiz"
          className="rounded-md bg-brand-gold px-6 py-3 text-brand-ink"
        >
          Quiz
        </Link>
        <Link
          href="/retreat"
          className="rounded-md bg-brand-blush px-6 py-3 text-brand-ink"
        >
          Retreat
        </Link>
        <Link
          href="/contact"
          className="rounded-md bg-brand-ink px-6 py-3 text-white"
        >
          Contact
        </Link>
      </div>
    </section>
  );
}
