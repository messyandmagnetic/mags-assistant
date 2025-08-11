'use client';
import { useState } from 'react';

export default function ClipUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: data });
      const json = await res.json();
      setStatus(json.ok ? 'Uploaded!' : json.error || 'Upload failed');
    } catch (err) {
      setStatus('Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={upload} className="mb-4 flex flex-col gap-2">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button
        type="submit"
        disabled={!file || loading}
        className="p-2 bg-black text-white"
      >
        {loading ? 'Uploading…' : 'Upload'}
      </button>
      {status && <div className="text-sm">{status}</div>}
    </form>
  );
}
