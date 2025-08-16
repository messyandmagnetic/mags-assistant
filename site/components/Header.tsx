import Link from 'next/link';

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 md:p-6">
      <Link href="/" className="font-heading text-2xl text-brand-ink">
        Messy &amp; Magnetic
      </Link>
      <nav className="hidden space-x-4 md:block">
        <Link href="/shop" className="hover:text-brand-sage">
          Shop
        </Link>
        <Link href="/quiz" className="hover:text-brand-sage">
          Quiz
        </Link>
        <Link href="/retreat" className="hover:text-brand-sage">
          Retreat
        </Link>
        <Link href="/contact" className="hover:text-brand-sage">
          Contact
        </Link>
      </nav>
    </header>
  );
}
