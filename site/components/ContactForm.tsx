'use client';

import { useState } from 'react';
import Button from './Button';

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'info',
        title: 'Contact form',
        message: `From ${formData.get('name')} (${formData.get('email')}): ${formData.get('message')}`,
        links: [],
      }),
    });
    if (res.ok) {
      setStatus('success');
      e.currentTarget.reset();
    } else {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
      <input
        name="name"
        type="text"
        required
        placeholder="Your name"
        className="w-full rounded-md border border-brand-sage px-3 py-2"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="w-full rounded-md border border-brand-sage px-3 py-2"
      />
      <textarea
        name="message"
        required
        placeholder="Your message"
        className="w-full rounded-md border border-brand-sage px-3 py-2"
        rows={4}
      />
      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending...' : 'Send'}
      </Button>
      {status === 'success' && (
        <p className="text-green-600">Thanks! We&apos;ll be in touch.</p>
      )}
      {status === 'error' && (
        <p className="text-red-600">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
