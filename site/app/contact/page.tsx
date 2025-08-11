import ContactForm from '../../components/ContactForm';
import Section from '../../components/Section';

export default function ContactPage() {
  return (
    <Section>
      <h1 className="mb-4 font-heading text-3xl">Contact</h1>
      <p className="mb-4 text-brand-ink/80">
        Have a question or just want to say hi? Send us a message below.
      </p>
      <ContactForm />
    </Section>
  );
}
