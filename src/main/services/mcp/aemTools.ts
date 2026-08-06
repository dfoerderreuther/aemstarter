/**
 * AEM content / JCR tools, resolved against a running author or publisher
 * instance. Config (base URL + auth) is resolved lazily on each call from live
 * project settings, so port changes are picked up without a restart.
 *
 * Ported from the former stdio bundle (resources/mcp-server/src/server.mjs).
 */
import { McpTool, McpToolArgs, textResult, requireString, optionalNumber } from './McpTypes';

export interface AemConfig {
    base: string;
    auth: string;
}

async function aemFetch(cfg: AemConfig, pathname: string, init: RequestInit = {}): Promise<string> {
    const url = pathname.startsWith('http') ? pathname : `${cfg.base}${pathname}`;
    const res = await fetch(url, {
        ...init,
        headers: { Authorization: cfg.auth, ...(init.headers || {}) },
    });
    const body = await res.text();
    if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText} for ${url}\n${body.slice(0, 2000)}`);
    }
    return body;
}

function toStringRecord(value: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = String(v);
        }
    }
    return out;
}

export function buildAemTools(getConfig: () => AemConfig): McpTool[] {
    return [
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
            handler: async (args: McpToolArgs) => {
                const jcrPath = requireString(args, 'path');
                const depth = optionalNumber(args, 'depth') ?? 1;
                const clean = jcrPath.replace(/\/+$/, '') || '/';
                return textResult(await aemFetch(getConfig(), `${clean}.${depth}.json`));
            },
        },
        {
            name: 'aem_list_children',
            description: 'List the immediate child node names of a JCR path.',
            inputSchema: {
                type: 'object',
                properties: { path: { type: 'string', description: 'JCR path, e.g. /content' } },
                required: ['path'],
            },
            handler: async (args: McpToolArgs) => {
                const jcrPath = requireString(args, 'path');
                const clean = jcrPath.replace(/\/+$/, '') || '/';
                const body = await aemFetch(getConfig(), `${clean}.1.json`);
                const json = JSON.parse(body) as Record<string, unknown>;
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
            handler: async (args: McpToolArgs) => {
                const params = new URLSearchParams(toStringRecord(args['predicates']));
                return textResult(await aemFetch(getConfig(), `/bin/querybuilder.json?${params.toString()}`));
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
            handler: async (args: McpToolArgs) => {
                const jcrPath = requireString(args, 'path');
                const form = new URLSearchParams();
                for (const [k, v] of Object.entries(toStringRecord(args['properties']))) {
                    form.append(k, v);
                }
                const body = await aemFetch(getConfig(), jcrPath, {
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
                properties: { path: { type: 'string', description: 'JCR path to delete' } },
                required: ['path'],
            },
            handler: async (args: McpToolArgs) => {
                const jcrPath = requireString(args, 'path');
                const form = new URLSearchParams({ ':operation': 'delete' });
                const body = await aemFetch(getConfig(), jcrPath, {
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
                const cfg = getConfig();
                const body = await aemFetch(cfg, '/system/console/bundles.json');
                const json = JSON.parse(body) as { status?: unknown; s?: unknown };
                return textResult({ base: cfg.base, status: json.status, s: json.s });
            },
        },
    ];
}
