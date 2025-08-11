import Link from 'next/link';

export default function ChatBubble() {
  return (
    <Link
      href="https://assistant.messyandmagnetic.com/chat"
      aria-label="Chat with Mags"
      className="fixed bottom-4 right-4 rounded-full bg-brand-sage p-3 text-white shadow-lg"
    >
      <span className="sr-only">Chat with Mags</span>
      💬
    </Link>
  );
}
