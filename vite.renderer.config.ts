import { defineConfig, type Plugin } from 'vite';
import svgr from 'vite-plugin-svgr';
import type { Plugin as EsbuildPlugin } from 'esbuild';
import { readFileSync, promises as fsPromises } from 'fs';
import { resolve } from 'path';

const STRIP_USE_CLIENT_REGEX = /^\s*['"]use client['"];?\s*/;

const stripUseClientDirectivePlugin = (): Plugin => ({
  name: 'strip-use-client-directive',
  enforce: 'pre',
  transform(code: string, id: string) {
    if (!id.includes('node_modules/@mantine/')) {
      return null;
    }

    if (!STRIP_USE_CLIENT_REGEX.test(code)) {
      return null;
    }

    return {
      code: code.replace(STRIP_USE_CLIENT_REGEX, ''),
      map: null
    };
  }
});

const stripUseClientDirectiveEsbuildPlugin = (): EsbuildPlugin => ({
  name: 'strip-use-client-directive',
  setup(build) {
    build.onLoad({ filter: /@mantine[\\/].*\.(?:mjs|js)$/ }, async (args) => {
      const source = await fsPromises.readFile(args.path, 'utf8');

      if (!STRIP_USE_CLIENT_REGEX.test(source)) {
        return undefined;
      }

      return {
        contents: source.replace(STRIP_USE_CLIENT_REGEX, ''),
        loader: 'js'
      };
    });
  }
});

// Read package.json to get version
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    svgr(),
    stripUseClientDirectivePlugin()
  ],
  define: {
    // Make package.json version available to renderer
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Monaco Editor (large dependency)
          monaco: ['monaco-editor', '@monaco-editor/react'],
          // Separate Mantine UI components
          mantine: ['@mantine/core', '@mantine/hooks'],
          // Separate terminal-related dependencies
          terminal: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          // Separate React and related
          react: ['react', 'react-dom'],
          // Keep react-arborist in its own chunk and untouched by aggressive minification
          arborist: ['react-arborist'],
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
  publicDir: 'public',
  optimizeDeps: {
    include: ['react-arborist'],
    esbuildOptions: {
      plugins: [stripUseClientDirectiveEsbuildPlugin()]
    }
  }
});
