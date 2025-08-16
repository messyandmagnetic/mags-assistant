import Hero from '../components/Hero';
import FeatureCards from '../components/FeatureCards';
import Testimonial from '../components/Testimonial';
import NewsletterSignup from '../components/NewsletterSignup';
import TallyEmbed from '../components/TallyEmbed';

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="py-12">
        <h2 className="mb-4 text-center font-heading text-3xl">Create My Soul Flow System</h2>
        <TallyEmbed
          src={process.env.NEXT_PUBLIC_TALLY_SOUL_FLOW || 'https://tally.so/embed/placeholder'}
          title="Create My Soul Flow System"
          height={650}
        />
      </section>
      <FeatureCards />
      <Testimonial />
      <NewsletterSignup />
    </>
  );
}
