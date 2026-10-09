import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const base = process.env.SITE_ORIGIN === 'https://kubarr.com' ? '/' : '/kubarr-website/';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(base)) throw new Error('not found');
    const name = pathname.slice(base.length);
    const file = resolve(root, name.endsWith('/') || name === '' ? `${name}index.html` : name);
    if (!file.startsWith(`${root}${sep}`)) throw new Error('not found');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8` });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(8000, '127.0.0.1', () => console.log(`Serving http://localhost:8000${base}`));
