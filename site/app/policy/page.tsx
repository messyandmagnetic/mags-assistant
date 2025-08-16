import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messy & Magnetic™ – Privacy Policy & Terms of Use',
  description:
    'Messy & Magnetic™ Privacy Policy and Terms of Use for all digital products, soul readings, rhythm systems, and retreat programs.',
  viewport: 'width=device-width, initial-scale=1',
  robots: { index: true, follow: true },
  alternates: { canonical: '/policy' },
};

export default function PolicyPage() {
  return (
    <section className="px-4 py-12">
      <div className="prose mx-auto max-w-3xl text-brand-ink/80 prose-pastel">
        <h1>Privacy Policy</h1>
        <p>
          Messy &amp; Magnetic™ respects your privacy. This policy outlines what
          data we collect, how we use it, and how you can opt out.
        </p>
        <p>
          We collect basic info via forms (name, email, birthday, etc.) for the
          purpose of delivering personalized soul readings and rhythm tools. We
          never sell your data. We use secure tools like Stripe, Tally, Google
          Sheets, and automated systems (like GPT or Mags) to fulfill orders and
          improve the experience. By submitting any form on this site, you agree
          to this use of your data. We store order data securely and limit access
          to essential team members only.
        </p>
        <p>
          If you request deletion of your data, contact{' '}
          <a href="mailto:messyandmagnetic@gmail.com" className="underline">
            messyandmagnetic@gmail.com
          </a>{' '}
          and we will remove your info from our system within 7 business days.
        </p>
        <h2>Terms of Use</h2>
        <p>
          By using any products, readings, or tools from Messy &amp;
          Magnetic™, you agree that these are intended for personal insight,
          self-awareness, and spiritual support only. We are not a substitute for
          licensed therapy, medical advice, or financial counsel. All content is
          original or based on public esoteric systems (e.g. Astrology, Human
          Design) interpreted through our own language. You agree not to
          redistribute these materials commercially.
        </p>
        <p>
          We reserve the right to modify these terms and will notify users of
          major changes via the site footer or email when relevant.
        </p>
        <p>
          For any questions or feedback, contact{' '}
          <a href="mailto:messyandmagnetic@gmail.com" className="underline">
            messyandmagnetic@gmail.com
          </a>
        </p>
      </div>
    </section>
  );
}

