import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
  base:
    mode === 'pages' ? `${(process.env.PAGES_BASE_PATH ?? '/velodex').replace(/\/$/, '')}/` : '/',
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist' },
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
}));
