#!/usr/bin/env node
/**
 * server.js — servidor HTTP estático sem dependências.
 * Serve a interface web do jogo (index.html, style.css, src/*.js).
 *
 * Uso: node server.js [porta]     (padrão: 5173)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    const requested = urlPath === '/' ? '/index.html' : urlPath;

    // Impede path traversal: mantém tudo dentro de ROOT.
    const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Acesso negado');
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Erro interno');
    }
  }
});

server.listen(PORT, () => {
  console.log(`🎲 Miscigenação: Linha do Tempo`);
  console.log(`   Servidor rodando em http://localhost:${PORT}`);
  console.log('   Pressione Ctrl+C para encerrar.');
});