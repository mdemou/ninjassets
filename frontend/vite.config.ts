import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'app'),
    },
  },
  plugins: [reactRouter(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/session': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/user': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
