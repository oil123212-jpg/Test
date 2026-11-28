import { serveBooks } from './scripts/book-store.mjs';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [{
    name: 'book-database',
    configureServer(server) { server.middlewares.use((req,res,next) => { if (!serveBooks(req,res)) next(); }); },
    configurePreviewServer(server) { server.middlewares.use((req,res,next) => { if (!serveBooks(req,res)) next(); }); },
  }],
  base: process.env.VITE_BASE_PATH || '/',
  server: { proxy: { '/api/realtime': { target: 'http://127.0.0.1:3000', ws: true }, '/api/life-guide': { target: 'http://127.0.0.1:3000' } }, headers: { 'Permissions-Policy': 'microphone=(self), camera=(), on-device-speech-recognition=(self)', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } },
  preview: { headers: { 'Permissions-Policy': 'microphone=(self), camera=(), on-device-speech-recognition=(self)', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" } },
});
