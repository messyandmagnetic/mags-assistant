export default function NewsletterSignup() {
  return (
    <section className="py-12 text-center">
      <h2 className="mb-4 font-heading text-2xl">Stay in the loop</h2>
      <form className="mx-auto flex max-w-md gap-2">
        <input
          type="email"
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-brand-sage px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-brand-sage px-4 py-2 text-white"
        >
          Sign Up
        </button>
      </form>
    </section>
  );
}
