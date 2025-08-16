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
          src="https://tally.so/r/w268rj"
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
