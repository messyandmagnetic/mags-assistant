import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 flex flex-col items-center gap-2 p-6 text-sm text-brand-ink">
      <nav className="flex flex-wrap justify-center gap-4">
        <Link href="/shop" className="hover:underline">
          Shop
        </Link>
        <Link href="/quiz" className="hover:underline">
          Quiz
        </Link>
        <Link href="/retreat" className="hover:underline">
          Retreat
        </Link>
        <Link href="/contact" className="hover:underline">
          Contact
        </Link>
        <a
          href="https://messymagnetic-privacy-policy.super.site"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy &amp; Terms
        </a>
      </nav>
      <p>
        Email:{' '}
        <a href="mailto:hello@messyandmagnetic.com" className="underline">
          hello@messyandmagnetic.com
        </a>
      </p>
    </footer>
  );
}
