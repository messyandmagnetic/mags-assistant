import Link from 'next/link';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  children: ReactNode;
  className?: string;
}

export default function Button({ href, children, className = '', ...props }: Props) {
  const base = `rounded-md bg-brand-sage px-6 py-3 text-white hover:bg-brand-sage/90 ${className}`;
  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button className={base} {...props}>
      {children}
    </button>
  );
}
