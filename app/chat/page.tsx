'use client';
import ChatUI from '../../components/ChatUI';
import { useEffect, useState } from 'react';
import { COOKIE_NAME, verifyPassword, sessionCookie } from '../../lib/auth';

export default function ChatPage() {
  const [authed, setAuthed] = useState(false);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const hasPass = !verifyPassword('');
    if (!hasPass) {
      setAuthed(true);
      return;
    }
    setWarning(true);
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (key && verifyPassword(key)) {
      document.cookie = sessionCookie(key);
      setAuthed(true);
      return;
    }
    if (document.cookie.includes(`${COOKIE_NAME}=`)) {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    const clear = () => {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'read', title: 'chat:read', message: 'clear unread', links: [] }),
      });
    };
    clear();
    window.addEventListener('focus', clear);
    return () => window.removeEventListener('focus', clear);
  }, []);

  const [input, setInput] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyPassword(input)) {
      document.cookie = sessionCookie(input);
      setAuthed(true);
    }
  }

  if (!authed && warning) {
    return (
      <div className="max-w-sm mx-auto p-4">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input
            type="password"
            placeholder="Password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="border p-2"
          />
          <button type="submit" className="p-2 bg-black text-white">
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <ChatUI />
    </div>
  );
}
