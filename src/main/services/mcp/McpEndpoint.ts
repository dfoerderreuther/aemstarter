/**
 * Minimal MCP (Model Context Protocol) endpoint over JSON-RPC 2.0.
 *
 * Implements just the slice AEM-Starter needs: initialize, tools/list,
 * tools/call, ping, plus the initialized notification. Responses are plain
 * JSON-RPC objects — the HTTP layer (AemStarterMcpServer) returns them as
 * `application/json`, the "JSON response" mode of MCP Streamable HTTP, so no SSE
 * stream is required. We control the client (Claude Code), which supports this.
 */
import log from 'electron-log';
import { McpTool } from './McpTypes';

const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export interface JsonRpcMessage {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: { code: number; message: string };
}

export class McpEndpoint {
    constructor(
        private readonly name: string,
        private readonly getTools: () => McpTool[],
    ) {}

    /**
     * Handle a single JSON-RPC message. Returns a response object, or null when
     * the message is a notification (no reply expected).
     */
    async handle(msg: JsonRpcMessage): Promise<JsonRpcResponse | null> {
        const id = msg.id ?? null;
        const method = msg.method;
        const params = msg.params ?? {};

        if (!method) {
            return id === null ? null : this.error(id, -32600, 'Invalid request: missing method');
        }

        try {
            switch (method) {
                case 'initialize': {
                    const requested = params['protocolVersion'];
                    const protocolVersion = typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
                        ? requested
                        : DEFAULT_PROTOCOL_VERSION;
                    return this.result(id, {
                        protocolVersion,
                        capabilities: { tools: { listChanged: false } },
                        serverInfo: { name: this.name, version: '2.0.0' },
                    });
                }
                case 'notifications/initialized':
                case 'initialized':
                    return null; // notification — no response
                case 'ping':
                    return this.result(id, {});
                case 'tools/list':
                    return this.result(id, {
                        tools: this.getTools().map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
                    });
                case 'tools/call': {
                    const toolName = params['name'];
                    const tool = this.getTools().find((t) => t.name === toolName);
                    if (!tool) return this.error(id, -32602, `Unknown tool: ${String(toolName)}`);
                    const rawArgs = params['arguments'];
                    const args = (rawArgs && typeof rawArgs === 'object') ? rawArgs as Record<string, unknown> : {};
                    try {
                        const res = await tool.handler(args);
                        return this.result(id, res);
                    } catch (err) {
                        // Tool execution errors are reported as a result with isError,
                        // not as a protocol-level JSON-RPC error.
                        const message = err instanceof Error ? err.message : String(err);
                        log.warn(`[McpEndpoint:${this.name}] tool ${tool.name} failed:`, message);
                        return this.result(id, { content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
                    }
                }
                default:
                    // Unknown notification (no id) is ignored; unknown request errors.
                    return id === null ? null : this.error(id, -32601, `Method not found: ${method}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.error(`[McpEndpoint:${this.name}] error handling ${method}:`, message);
            return this.error(id, -32603, message);
        }
    }

    private result(id: string | number | null, result: unknown): JsonRpcResponse {
        return { jsonrpc: '2.0', id, result };
    }

    private error(id: string | number | null, code: number, message: string): JsonRpcResponse {
        return { jsonrpc: '2.0', id, error: { code, message } };
    }
}
