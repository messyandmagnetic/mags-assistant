import Link from 'next/link';

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 md:p-6">
      <Link href="/" className="font-heading text-2xl text-brand-ink">
        Messy &amp; Magnetic
      </Link>
      <nav className="hidden space-x-4 md:block">
        <Link href="/about" className="hover:text-brand-sage">About</Link>
        <Link href="/shop" className="hover:text-brand-sage">Shop</Link>
        <Link href="/donate" className="hover:text-brand-sage">Donate</Link>
        <Link href="/contact" className="hover:text-brand-sage">Contact</Link>
      </nav>
      <Link
        href="https://assistant.messyandmagnetic.com/chat"
        className="ml-4 rounded-md bg-brand-sage px-3 py-2 text-sm text-white"
      >
        Chat with Mags
      </Link>
    </header>
  );
}
