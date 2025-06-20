import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node-pty'] // Keep external for Electron - native modules should not be bundled
    }
  }
});
