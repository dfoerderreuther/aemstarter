/**
 * AEM Starter MCP server.
 *
 * A single stdio MCP server whose toolset is scoped by the --target argument
 * (or MCP_TARGET env var): author | publisher | dispatcher.
 *
 * Launched by Claude Code itself via the project's .mcp.json — this process is
 * never spawned or supervised by the AEM Starter app. All configuration arrives
 * through environment variables set in that .mcp.json entry.
 *
 * Author / publisher talk to the running AEM instance over HTTP with the AEM SDK
 * default admin/admin credentials. Dispatcher tools inspect the local dispatcher
 * folder and Docker container.
 *
 * Requires Node 18+ (global fetch), which Claude Code already mandates.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Config from env / args
// ---------------------------------------------------------------------------

function parseTarget() {
  const arg = process.argv.find((a) => a.startsWith('--target='));
  const fromArg = arg ? arg.split('=')[1] : undefined;
  const target = (fromArg || process.env.MCP_TARGET || 'author').toLowerCase();
  if (!['author', 'publisher', 'dispatcher'].includes(target)) {
    throw new Error(`Invalid --target: ${target}`);
  }
  return target;
}

const TARGET = parseTarget();

const AEM = {
  host: process.env.AEM_HOST || 'localhost',
  port: process.env.AEM_PORT || (TARGET === 'publisher' ? '4503' : '4502'),
  user: process.env.AEM_USER || 'admin',
  password: process.env.AEM_PASSWORD || 'admin',
};
const AEM_BASE = `http://${AEM.host}:${AEM.port}`;
const AEM_AUTH = 'Basic ' + Buffer.from(`${AEM.user}:${AEM.password}`).toString('base64');

const DISPATCHER = {
  dir: process.env.DISPATCHER_DIR || '',
  port: process.env.DISPATCHER_PORT || '80',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text }] };
}

function errorResult(message) {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

async function aemFetch(pathname, init = {}) {
  const url = pathname.startsWith('http') ? pathname : `${AEM_BASE}${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: AEM_AUTH, ...(init.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}\n${body.slice(0, 2000)}`);
  }
  return body;
}

// ---------------------------------------------------------------------------
// Tool definitions per target
// ---------------------------------------------------------------------------

const AEM_TOOLS = [
  {
    name: 'aem_get_node',
    description: 'Read a JCR node and its properties as JSON. Use for pages, components, config nodes, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'JCR path, e.g. /content/mysite/en' },
        depth: { type: 'number', description: 'Traversal depth (default 1)', default: 1 },
      },
      required: ['path'],
    },
    handler: async ({ path: jcrPath, depth = 1 }) => {
      const clean = String(jcrPath).replace(/\/+$/, '') || '/';
      const body = await aemFetch(`${clean}.${depth}.json`);
      return textResult(body);
    },
  },
  {
    name: 'aem_list_children',
    description: 'List the immediate child node names of a JCR path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'JCR path, e.g. /content' },
      },
      required: ['path'],
    },
    handler: async ({ path: jcrPath }) => {
      const clean = String(jcrPath).replace(/\/+$/, '') || '/';
      const body = await aemFetch(`${clean}.1.json`);
      const json = JSON.parse(body);
      const children = Object.keys(json).filter((k) => json[k] && typeof json[k] === 'object');
      return textResult(children);
    },
  },
  {
    name: 'aem_query',
    description: 'Run a QueryBuilder query. Pass QueryBuilder predicates as key/value pairs, e.g. { "path": "/content", "type": "cq:Page", "p.limit": "10" }.',
    inputSchema: {
      type: 'object',
      properties: {
        predicates: {
          type: 'object',
          description: 'QueryBuilder predicate parameters',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['predicates'],
    },
    handler: async ({ predicates }) => {
      const params = new URLSearchParams(predicates);
      const body = await aemFetch(`/bin/querybuilder.json?${params.toString()}`);
      return textResult(body);
    },
  },
  {
    name: 'aem_create_or_update_node',
    description: 'Create or update a JCR node via the Sling POST servlet. Properties are written as-is. Use jcr:primaryType to set the node type.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Target JCR path' },
        properties: {
          type: 'object',
          description: 'Property name/value pairs to set',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['path', 'properties'],
    },
    handler: async ({ path: jcrPath, properties }) => {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(properties || {})) {
        form.append(k, String(v));
      }
      const body = await aemFetch(jcrPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form.toString(),
      });
      return textResult(body || 'OK');
    },
  },
  {
    name: 'aem_delete_node',
    description: 'Delete a JCR node via the Sling POST servlet (:operation=delete).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'JCR path to delete' },
      },
      required: ['path'],
    },
    handler: async ({ path: jcrPath }) => {
      const form = new URLSearchParams({ ':operation': 'delete' });
      const body = await aemFetch(jcrPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form.toString(),
      });
      return textResult(body || 'OK');
    },
  },
  {
    name: 'aem_system_info',
    description: 'Report basic instance health: OSGi bundle status summary from the running instance.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const body = await aemFetch('/system/console/bundles.json');
      const json = JSON.parse(body);
      return textResult({ base: AEM_BASE, status: json.status, s: json.s });
    },
  },
];

const DISPATCHER_TOOLS = [
  {
    name: 'dispatcher_read_config',
    description: 'Read a dispatcher config file (e.g. dispatcher.any, or any file under the dispatcher config folder). Path is relative to the dispatcher folder.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Relative path to the config file, e.g. config/conf.dispatcher.d/available_farms/default.farm' },
      },
      required: ['file'],
    },
    handler: async ({ file }) => {
      if (!DISPATCHER.dir) throw new Error('Dispatcher folder is not configured');
      const resolved = path.resolve(DISPATCHER.dir, file);
      if (!resolved.startsWith(path.resolve(DISPATCHER.dir))) {
        throw new Error('Path escapes the dispatcher folder');
      }
      const content = await fs.readFile(resolved, 'utf8');
      return textResult(content);
    },
  },
  {
    name: 'dispatcher_list_files',
    description: 'List files in a folder under the dispatcher directory (defaults to the dispatcher root). Useful to explore config and cache.',
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Relative folder path (default ".")', default: '.' },
      },
    },
    handler: async ({ folder = '.' }) => {
      if (!DISPATCHER.dir) throw new Error('Dispatcher folder is not configured');
      const resolved = path.resolve(DISPATCHER.dir, folder);
      if (!resolved.startsWith(path.resolve(DISPATCHER.dir))) {
        throw new Error('Path escapes the dispatcher folder');
      }
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return textResult(entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)));
    },
  },
  {
    name: 'dispatcher_container_status',
    description: 'Report the Docker container(s) serving the dispatcher on its configured port.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      try {
        const { stdout } = await execFileAsync('docker', [
          'ps',
          '--format',
          '{{.ID}} {{.Image}} {{.Status}} {{.Ports}}',
        ]);
        const lines = stdout.split('\n').filter(Boolean);
        const matching = lines.filter((l) => l.includes(`:${DISPATCHER.port}->`));
        return textResult({ port: DISPATCHER.port, containers: matching.length ? matching : lines });
      } catch (err) {
        throw new Error(`docker ps failed: ${err.message}`);
      }
    },
  },
];

const TOOLS = TARGET === 'dispatcher' ? DISPATCHER_TOOLS : AEM_TOOLS;
const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

// ---------------------------------------------------------------------------
// Server wiring
// ---------------------------------------------------------------------------

const server = new Server(
  { name: `aem-${TARGET}`, version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOL_MAP.get(request.params.name);
  if (!tool) return errorResult(`Unknown tool: ${request.params.name}`);
  try {
    return await tool.handler(request.params.arguments || {});
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[aem-mcp] fatal:', err);
  process.exit(1);
});
