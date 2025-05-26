import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Monaco Editor (large dependency)
          monaco: ['monaco-editor', '@monaco-editor/react'],
          // Separate Mantine UI components
          mantine: ['@mantine/core', '@mantine/hooks'],
          // Separate terminal-related dependencies
          terminal: ['@xterm/xterm', '@xterm/addon-fit', 'xterm', 'xterm-addon-fit'],
          // Separate React and related
          react: ['react', 'react-dom'],
          // Separate emotion styling
          emotion: ['@emotion/react', '@emotion/styled'],
          // Separate utility libraries
          utils: ['uuid', 'adm-zip', 'extract-zip', 'zip-a-folder']
        }
      }
    },
    // Increase chunk size warning limit to 1000kb since we're dealing with a desktop app
    chunkSizeWarningLimit: 1000,
    // Enable source maps for better debugging
    sourcemap: true
  },
  publicDir: 'public'
});
