import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatBubble from '../components/ChatBubble';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Messy & Magnetic',
  description: 'Validating, warm, intuitive, magical.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}> 
      <head>
        <link
          rel="icon"
          href="/favicon.svg"
          type="image/svg+xml"
          title="Messy & Magnetic soul sparkle icon"
        />
      </head>
      <body>
        <Header />
        <main className="mx-auto max-w-5xl px-4">{children}</main>
        <Footer />
        <ChatBubble />
      </body>
    </html>
  );
}
