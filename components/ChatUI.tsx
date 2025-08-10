'use client';
import { useEffect, useRef, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('mags-chat-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('mags-chat-history', JSON.stringify(messages));
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  async function send(prompt?: string) {
    const content = prompt ?? input.trim();
    if (!content) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value);
        setMessages([...newMessages, { role: 'assistant', content: assistant }]);
      }
    } catch (err: any) {
      console.error(err);
      setMessages([...newMessages, { role: 'assistant', content: 'Error: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  }

  const quick = [
    { label: 'Sync Stripe \u2194 Notion', prompt: 'Sync Stripe and Notion (two-way)' },
    { label: 'Generate product image', prompt: 'Generate on-brand image for selected product' },
    { label: 'Audit Stripe products', prompt: 'Audit Stripe products and propose fixes' },
    { label: 'Create Notion task', prompt: 'Create a Notion task from this chat' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div
              className="inline-block rounded px-3 py-2 whitespace-pre-wrap shadow-sm"
              style={{ background: m.role === 'user' ? '#FBF6EF' : '#9BB5A3', color: '#2B2B2B' }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-500">Thinking…</div>}
      </div>
      <div className="p-2 border-t">
        <div className="flex gap-2 mb-2 overflow-x-auto">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.prompt)}
              className="text-sm px-2 py-1 border rounded"
            >
              {q.label}
            </button>
          ))}
        </div>
        <textarea
          className="w-full border rounded p-2 resize-none focus:outline-none"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          onClick={() => send()}
          className="mt-2 px-4 py-1 rounded"
          style={{ background: '#D8B26E', color: '#2B2B2B' }}
          disabled={loading}
        >
          Send
        </button>
      </div>
    </div>
  );
}
