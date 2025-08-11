import { getAboutContent } from '../../lib/notion';

export default async function AboutPage() {
  const content = await getAboutContent();
  return (
    <section className="py-12">
      <h1 className="mb-4 font-heading text-3xl">About</h1>
      <p className="text-brand-ink/80">{content}</p>
    </section>
  );
}
