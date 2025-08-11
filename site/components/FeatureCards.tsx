const features = [
  {
    title: 'Handmade Quality',
    text: 'Every item is crafted with care and attention to detail.',
  },
  {
    title: 'Natural Materials',
    text: 'We choose materials that are gentle on you and the earth.',
  },
  {
    title: 'Magnetic Charm',
    text: 'Designs that bring a touch of magic to everyday life.',
  },
];

export default function FeatureCards() {
  return (
    <section className="grid gap-6 py-12 md:grid-cols-3">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-lg bg-white/80 p-6 text-center shadow-sm"
        >
          <h3 className="mb-2 font-heading text-xl">{f.title}</h3>
          <p className="text-sm text-brand-ink/80">{f.text}</p>
        </div>
      ))}
    </section>
  );
}
