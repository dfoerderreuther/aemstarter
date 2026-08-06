/**
 * Shared types + result helpers for the in-app MCP server.
 *
 * Tools are plain objects (name / description / JSON-schema / handler); no SDK
 * dependency. The handler returns MCP tool-result content that McpEndpoint
 * serializes into a JSON-RPC `tools/call` result.
 */

export interface McpContent {
    type: 'text' | 'image';
    /** Present for type === 'text'. */
    text?: string;
    /** Base64 payload, present for type === 'image'. */
    data?: string;
    /** MIME type, present for type === 'image'. */
    mimeType?: string;
}

export interface McpToolResult {
    content: McpContent[];
    isError?: boolean;
}

export type McpToolArgs = Record<string, unknown>;

export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (args: McpToolArgs) => Promise<McpToolResult>;
}

export function textResult(value: unknown): McpToolResult {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return { content: [{ type: 'text', text }] };
}

export function imageResult(base64: string, mimeType = 'image/png'): McpToolResult {
    return { content: [{ type: 'image', data: base64, mimeType }] };
}

export function errorResult(message: string): McpToolResult {
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

/** Narrow an arg to a required string. */
export function requireString(args: McpToolArgs, key: string): string {
    const value = args[key];
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Missing required string argument: ${key}`);
    }
    return value;
}

export function optionalString(args: McpToolArgs, key: string): string | undefined {
    const value = args[key];
    return typeof value === 'string' ? value : undefined;
}

export function optionalNumber(args: McpToolArgs, key: string): number | undefined {
    const value = args[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
    return undefined;
}

export function optionalBoolean(args: McpToolArgs, key: string): boolean | undefined {
    const value = args[key];
    return typeof value === 'boolean' ? value : undefined;
}
