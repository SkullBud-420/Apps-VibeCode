import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

// Plugin que expõe /api/ai no servidor Vite (Node.js)
// A chave fica no servidor — nunca exposta no browser
function aiProxyPlugin(): Plugin {
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return; }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY não configurada no servidor.' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req as any) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig }),
            }
          );
          const data = await geminiRes.json();
          res.writeHead(geminiRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), aiProxyPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
