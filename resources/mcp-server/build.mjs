/**
 * Bundles src/server.mjs into a self-contained CommonJS file per supported
 * @modelcontextprotocol/sdk major version, e.g. ./v1/server.cjs.
 *
 * The bundle inlines the SDK (and its deps) so nothing has to be npm-installed
 * at runtime — the app just copies the matching vX folder into a project's
 * ./mcp folder ("ship pre-installed"). Run: npm install && npm run build.
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Map an SDK major to the output folder Claude Code / the app reference.
const TARGETS = [{ out: 'v1' }];

for (const t of TARGETS) {
  await build({
    entryPoints: [path.join(dir, 'src', 'server.mjs')],
    outfile: path.join(dir, t.out, 'server.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    minify: false,
    banner: { js: '// AEM Starter MCP server — generated bundle, do not edit.' },
  });
  console.log(`Built ${t.out}/server.cjs`);
}
