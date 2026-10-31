import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: { proxy: { '/api/realtime': { target: 'http://127.0.0.1:3000', ws: true } }, headers: { 'Permissions-Policy': 'microphone=(self), camera=()', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } },
  preview: { headers: { 'Permissions-Policy': 'microphone=(self), camera=()', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" } },
});
