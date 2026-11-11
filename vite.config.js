import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ollamaProxy = {
  '/ollama': {
    target: 'http://127.0.0.1:11434',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/ollama/, '')
  }
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: ollamaProxy },
  preview: { proxy: ollamaProxy }
});
