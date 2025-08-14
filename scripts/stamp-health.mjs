import fs from 'node:fs/promises';
const p = 'public/health.json';
let s = await fs.readFile(p, 'utf8');
s = s.replace('__BUILD_TIME__', new Date().toISOString());
await fs.writeFile(p, s);
console.log('Stamped', p);
