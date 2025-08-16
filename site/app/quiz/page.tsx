import TallyEmbed from '../../components/TallyEmbed';

export default function QuizPage() {
  return (
    <section className="py-12">
      <h1 className="mb-4 text-center font-heading text-3xl">Soul Flow Quiz</h1>
      <TallyEmbed
        src={process.env.NEXT_PUBLIC_TALLY_SOUL_FLOW || 'https://tally.so/embed/placeholder'}
        title="Create My Soul Flow System"
        height={650}
      />
    </section>
  );
}
