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
        <Link href="/policy" className="hover:underline">
          Privacy &amp; Terms
        </Link>
      </nav>
      <p>EIN 39-3539757 &bull; Retreat: Coyote, NM</p>
      <p>
        Email{' '}
        <a href="mailto:hello@messyandmagnetic.com" className="underline">
          hello@messyandmagnetic.com
        </a>
      </p>
    </footer>
  );
}
