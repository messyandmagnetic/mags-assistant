import TallyEmbed from '../../components/TallyEmbed';

export default function QuizPage() {
  return (
    <section className="py-12">
      <h1 className="mb-4 text-center font-heading text-3xl">Soul Flow Quiz</h1>
      <TallyEmbed
        src="https://tally.so/r/w268rj"
        title="Create My Soul Flow System"
        height={650}
      />
    </section>
  );
}
