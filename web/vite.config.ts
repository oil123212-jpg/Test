import { defineConfig } from 'vite';
export default defineConfig({
  server: { headers: { 'Permissions-Policy': 'microphone=(self), camera=()', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } },
  preview: { headers: { 'Permissions-Policy': 'microphone=(self), camera=()', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" } },
});
