import Hero from '../components/Hero';
import FeatureCards from '../components/FeatureCards';
import Testimonial from '../components/Testimonial';
import Section from '../components/Section';
import Button from '../components/Button';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Section>
        <FeatureCards />
      </Section>
      <Section>
        <Testimonial />
      </Section>
      <Section className="text-center">
        <Button href="/contact">Get in touch</Button>
      </Section>
    </>
  );
}
