'use client';
import { useEffect, useState } from 'react';
import ChatUI from '../../components/ChatUI';
import { COOKIE_NAME, verifyPassword, passwordEnabled, sessionCookie } from '../../lib/auth';

export default function ChatPage() {
  const [authed, setAuthed] = useState(false);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const hasPass = passwordEnabled();
    if (!hasPass) {
      setWarning(true);
      setAuthed(true);
      return;
    }
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
    if (authed) {
      fetch('/api/chat/unread?clear=1').catch(() => {});
    }
  }, [authed]);

  const [input, setInput] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyPassword(input)) {
      document.cookie = sessionCookie(input);
      setAuthed(true);
    }
  }

  if (!authed) {
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
      {warning && (
        <div className="bg-yellow-100 text-center text-sm p-2">
          Warning: CHAT_PASSWORD is not set; chat is public.
        </div>
      )}
      <ChatUI />
    </div>
  );
}
