import { Project } from '../../types/Project';
import fs from 'fs';
import path from 'path';
import { SystemCheck } from './SystemCheck';
import { McpServerRegister } from './mcp/McpServerRegister';
import log from 'electron-log';

export interface ClaudeCodeAvailability {
    available: boolean;
    version?: string;
}

export interface McpEndpointConfig {
    type: 'http';
    url: string;
}

export interface ClaudeCodeSetupResult {
    mcpConfigPath: string;
    /** Loopback port the in-app MCP server is listening on. */
    port: number;
    /** Base URL of the in-app MCP server, e.g. http://127.0.0.1:53421 */
    url: string;
    /** Names of the mcpServers entries written to .mcp.json. */
    targets: string[];
    /** The mcpServers block written to .mcp.json. */
    endpoints: Record<string, McpEndpointConfig>;
}

/**
 * Wires the Claude Code MCP integration for a project.
 *
 * Transport is a single in-app HTTP/SSE MCP server hosted by the Electron main
 * process (see McpServerRegister / AemStarterMcpServer), bound to loopback on a
 * free port. This service (a) ensures that server is running and (b) writes a
 * url-based .mcp.json into the dev path (where `claude` runs) with one entry per
 * enabled target plus the always-on `aem-starter` control endpoint.
 *
 * The old stdio bundle model (a copied ./mcp/server.cjs spawned by Claude Code)
 * is retired; any stale ./mcp folder from an earlier version is removed.
 */
export class ClaudeCodeService {

    private static readonly HOST = '127.0.0.1';

    static async checkAvailability(): Promise<ClaudeCodeAvailability> {
        const systemCheck = new SystemCheck();
        const version = await systemCheck.checkClaudeCodeVersion();
        return { available: version !== null, version: version ?? undefined };
    }

    /**
     * Ensure the in-app MCP server is running and write .mcp.json for the
     * currently enabled targets. Idempotent.
     */
    static async setup(project: Project): Promise<ClaudeCodeSetupResult> {
        const settings = project.settings;
        const devPath = settings.dev?.path;
        if (!devPath) {
            throw new Error('Development Path is not set for this project');
        }

        const server = await McpServerRegister.ensureStarted(project);
        const port = server.getPort();
        const baseUrl = `http://${this.HOST}:${port}`;
        const endpoint = (endpointPath: string): McpEndpointConfig => ({ type: 'http', url: `${baseUrl}/mcp/${endpointPath}` });

        // All four connections are always exposed: the three AEM content/dispatcher
        // endpoints plus the aem-starter control endpoint.
        const mcpServers: Record<string, McpEndpointConfig> = {
            'aem-author': endpoint('author'),
            'aem-publisher': endpoint('publisher'),
            'aem-dispatcher': endpoint('dispatcher'),
            'aem-starter': endpoint('control'),
        };
        const enabled = Object.keys(mcpServers);

        const mcpConfigPath = path.join(devPath, '.mcp.json');
        fs.mkdirSync(devPath, { recursive: true });
        fs.writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers }, null, 2), 'utf8');
        log.info('[ClaudeCodeService] Wrote', mcpConfigPath, 'targets', enabled, 'port', port);

        // Retire the old stdio bundle if a previous version installed it.
        const legacyMcpDir = path.join(project.folderPath, 'mcp');
        try {
            if (fs.existsSync(legacyMcpDir)) {
                fs.rmSync(legacyMcpDir, { recursive: true, force: true });
                log.info('[ClaudeCodeService] Removed legacy stdio MCP bundle at', legacyMcpDir);
            }
        } catch (err) {
            log.warn('[ClaudeCodeService] Could not remove legacy MCP bundle:', err);
        }

        return { mcpConfigPath, port, url: baseUrl, targets: enabled, endpoints: mcpServers };
    }
}
