import TallyEmbed from '../../components/TallyEmbed';
import Link from 'next/link';

export default function FeedbackPage() {
  return (
    <section className="py-12">
      <h1 className="mb-4 text-center font-heading text-3xl">Feedback</h1>
      <TallyEmbed src="https://tally.so/r/nGeWRJ" title="Feedback Form" height={650} />
      <p className="mt-4 text-center text-sm text-brand-ink/80">
        I agree to the{' '}
        <Link href="/policy" className="underline">
          Messy &amp; Magnetic™ Terms of Use and Privacy Policy
        </Link>
        .
      </p>
    </section>
  );
}
