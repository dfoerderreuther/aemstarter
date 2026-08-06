/**
 * Per-project in-app MCP server.
 *
 * Hosts every MCP endpoint for one project on a single loopback HTTP port:
 *   /mcp/author, /mcp/publisher, /mcp/dispatcher  — AEM content / dispatcher tools
 *   /mcp/control                                  — AEM-Starter control tools
 *
 * Security (dev machine, no auth): bound to 127.0.0.1 only, and every request is
 * checked for a loopback Origin / Host to defeat the browser DNS-rebinding / CSRF
 * vector — the one real threat for a localhost HTTP server.
 */
import http from 'node:http';
import { AddressInfo } from 'node:net';
import log from 'electron-log';
import { McpEndpoint, JsonRpcMessage } from './McpEndpoint';
import { McpTool } from './McpTypes';

/** 1 MB is plenty for a JSON-RPC tool call; reject anything larger. */
const MAX_BODY_BYTES = 1024 * 1024;

export type EndpointMap = Record<string, () => McpTool[]>;

export class AemStarterMcpServer {
    private server: http.Server | null = null;
    private port = 0;
    private readonly endpoints = new Map<string, McpEndpoint>();

    constructor(
        private readonly projectId: string,
        endpoints: EndpointMap,
        private readonly name = 'aem-starter',
    ) {
        for (const [path, getTools] of Object.entries(endpoints)) {
            this.endpoints.set(`/mcp/${path}`, new McpEndpoint(`${this.name}-${path}`, getTools));
        }
    }

    isRunning(): boolean {
        return this.server !== null;
    }

    getPort(): number {
        return this.port;
    }

    async start(): Promise<number> {
        if (this.server) return this.port;
        const server = http.createServer((req, res) => {
            this.onRequest(req, res).catch((err) => {
                log.error('[AemStarterMcpServer] unhandled request error:', err);
                if (!res.headersSent) this.sendJson(res, 500, { error: 'internal error' });
            });
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        this.server = server;
        this.port = (server.address() as AddressInfo).port;
        log.info(`[AemStarterMcpServer] listening on http://127.0.0.1:${this.port} (project ${this.projectId})`);
        return this.port;
    }

    async stop(): Promise<void> {
        const server = this.server;
        if (!server) return;
        this.server = null;
        this.port = 0;
        await new Promise<void>((resolve) => server.close(() => resolve()));
        log.info(`[AemStarterMcpServer] stopped (project ${this.projectId})`);
    }

    /** Reject requests whose Origin/Host is not loopback (browser CSRF / DNS rebinding). */
    private isLoopbackRequest(req: http.IncomingMessage): boolean {
        const isLoopbackHost = (value: string | undefined): boolean => {
            if (!value) return true; // no header — non-browser client (e.g. Claude Code)
            const host = value.split(':')[0].toLowerCase();
            return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
        };
        const origin = req.headers['origin'];
        if (typeof origin === 'string' && origin.length > 0) {
            try {
                if (!isLoopbackHost(new URL(origin).hostname)) return false;
            } catch {
                return false;
            }
        }
        return isLoopbackHost(req.headers['host']);
    }

    private async onRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.isLoopbackRequest(req)) {
            this.sendJson(res, 403, { error: 'forbidden origin' });
            return;
        }

        const method = req.method || 'GET';
        if (method === 'OPTIONS') {
            res.writeHead(204, { Allow: 'POST, DELETE' }).end();
            return;
        }

        const pathname = (req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
        const endpoint = this.endpoints.get(pathname);
        if (!endpoint) {
            this.sendJson(res, 404, { error: `no MCP endpoint at ${pathname}` });
            return;
        }

        // Session termination: nothing to clean up in stateless mode.
        if (method === 'DELETE') {
            res.writeHead(204).end();
            return;
        }

        // We do not offer a server-initiated SSE stream on GET.
        if (method === 'GET') {
            this.sendJson(res, 405, {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32000, message: 'Method Not Allowed: this endpoint does not offer an SSE stream' },
            }, { Allow: 'POST, DELETE' });
            return;
        }

        if (method !== 'POST') {
            this.sendJson(res, 405, { error: 'method not allowed' }, { Allow: 'POST, DELETE' });
            return;
        }

        let body: string;
        try {
            body = await this.readBody(req);
        } catch (err) {
            this.sendJson(res, 413, { error: err instanceof Error ? err.message : 'body too large' });
            return;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch {
            this.sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
            return;
        }

        const messages: JsonRpcMessage[] = Array.isArray(parsed) ? parsed as JsonRpcMessage[] : [parsed as JsonRpcMessage];
        const responses = (await Promise.all(messages.map((m) => endpoint.handle(m)))).filter((r) => r !== null);

        if (responses.length === 0) {
            // All messages were notifications — acknowledge without a body.
            res.writeHead(202).end();
            return;
        }

        const payload = Array.isArray(parsed) ? responses : responses[0];
        this.sendJson(res, 200, payload);
    }

    private readBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;
            req.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > MAX_BODY_BYTES) {
                    reject(new Error('request body too large'));
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });
    }

    private sendJson(res: http.ServerResponse, status: number, payload: unknown, extraHeaders: Record<string, string> = {}): void {
        const text = JSON.stringify(payload);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text), ...extraHeaders });
        res.end(text);
    }
}
