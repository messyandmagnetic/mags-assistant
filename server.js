import { createServer } from 'http';
import { parse } from 'url';
import { join, extname } from 'path';
import { readFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
const publicDir = join(process.cwd(), 'public');

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (_) {
        resolve({});
      }
    });
  });
}

async function sendFile(res, filePath, contentType = 'text/html') {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

createServer(async (req, res) => {
  let { pathname } = parse(req.url, true);
  console.log(`${req.method} ${pathname}`);

  if (pathname === '/watch') {
    pathname = '/watch.html';
  }

  if (pathname.startsWith('/api/')) {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.body = await readBody(req);
      }
      if (!res.status) {
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
      }
      if (!res.json) {
        res.json = (obj) => {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify(obj));
        };
      }
      const mod = await import('./api/router.js');
      await mod.default(req, res);
    } catch (err) {
      console.error('api error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Internal Server Error' }));
    }
    return;
  }

  let filePath = join(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (!existsSync(filePath) && !extname(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (existsSync(htmlPath)) filePath = htmlPath;
  }
  if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
    await sendFile(res, filePath);
    return;
  }
  const indexFile = join(filePath, 'index.html');
  if (existsSync(indexFile)) {
    await sendFile(res, indexFile);
    return;
  }
  const notFound = join(publicDir, '404.html');
  if (existsSync(notFound)) {
    await sendFile(res, notFound);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}).listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});

