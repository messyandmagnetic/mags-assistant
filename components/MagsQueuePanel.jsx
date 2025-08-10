import { useState, useEffect } from 'https://esm.sh/react@18';

export default function MagsQueuePanel({ magsKey }) {
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');
  const [runner, setRunner] = useState('browserless');
  const [jobs, setJobs] = useState([]);
  const [out, setOut] = useState('');

  async function call(path, method = 'GET', body) {
    const res = await fetch(path, {
      method,
      headers: { 'x-mags-key': magsKey, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return json;
  }

  async function load() {
    const r = await call('/api/queue/peek');
    setJobs(r.jobs || []);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    const r = await call('/api/queue/add', 'POST', { text, when, runner });
    setOut(JSON.stringify(r, null, 2));
    setText('');
    setWhen('');
    await load();
  }

  async function runNow() {
    const ghRepo = localStorage.getItem('ghRepo');
    const ghToken = localStorage.getItem('ghToken');
    if (!ghRepo || !ghToken) {
      alert('Set ghRepo and ghToken in localStorage');
      return;
    }
    await fetch(`https://api.github.com/repos/${ghRepo}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${ghToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'mags-run-queue' }),
    });
  }

  return (
    <div style={{border:'1px solid #ddd', padding:12, borderRadius:8, marginTop:16}}>
      <h3>Queue</h3>
      <div>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Command" style={{width:'60%'}}/>
        <input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} style={{marginLeft:4}}/>
      </div>
      <div style={{marginTop:8}}>
        <label>
          <input type="radio" name="runner" value="browserless" checked={runner==='browserless'} onChange={()=>setRunner('browserless')}/> Browserless
        </label>
        <label style={{marginLeft:8}}>
          <input type="radio" name="runner" value="playwright" checked={runner==='playwright'} onChange={()=>setRunner('playwright')}/> Playwright
        </label>
      </div>
      <button onClick={add} style={{marginTop:8}}>Add</button>
      <button onClick={runNow} style={{marginLeft:8}}>Run now</button>
      <pre style={{whiteSpace:'pre-wrap', marginTop:12}}>{out}</pre>
      <ul style={{marginTop:12}}>
        {jobs.map(j=>
          <li key={j.id}>{j.text} [{j.status}] {j.when ? j.when : ''}</li>
        )}
      </ul>
    </div>
  );
}
