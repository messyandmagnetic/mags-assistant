import Hero from '../components/Hero';
import FeatureCards from '../components/FeatureCards';
import Testimonial from '../components/Testimonial';
import NewsletterSignup from '../components/NewsletterSignup';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureCards />
      <Testimonial />
      <NewsletterSignup />
    </>
  );
}
