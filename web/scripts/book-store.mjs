import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const dbPath = fileURLToPath(new URL('../data/books.sqlite', import.meta.url));

export function loadBooks(path = dbPath) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const books = Object.create(null);
    for (const { title, speaker, body } of db.prepare(
      'SELECT title, speaker, body FROM books JOIN lines ON books.id = lines.book_id ORDER BY books.id, lines.position'
    ).iterate()) (books[title] ??= []).push([speaker, body]);
    if (!Object.keys(books).length) throw new Error('Empty catalog');
    return books;
  } finally { db.close(); }
}

export function serveBooks(req, res) {
  if (req.url?.split('?')[0] !== '/api/books') return false;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.headers.origin === 'https://oil123212-jpg.github.io')
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  if (!['GET','HEAD'].includes(req.method)) {
    res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return true;
  }
  try {
    const catalog = loadBooks();
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(catalog));
  } catch {
    res.writeHead(503); res.end(JSON.stringify({error:'책장을 열 수 없어요.'}));
  }
  return true;
}
