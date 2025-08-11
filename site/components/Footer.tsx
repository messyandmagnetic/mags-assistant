import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 flex flex-col items-center gap-2 p-6 text-sm text-brand-ink">
      <nav className="flex gap-4">
        <Link href="/about" className="hover:text-brand-sage">About</Link>
        <Link href="/donate" className="hover:text-brand-sage">Donate</Link>
        <Link href="/contact" className="hover:text-brand-sage">Contact</Link>
      </nav>
      <p>
        Email: <a href="mailto:hello@example.com" className="underline">hello@example.com</a>
      </p>
    </footer>
  );
}
