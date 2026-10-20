import { Project } from '../../types/Project';
import fs from 'fs';
import path from 'path';
import { SystemCheck } from './SystemCheck';
import { getProjectMcpConnection } from './mcp/projectConnection';
import { CodeAssistantAvailability, CodeAssistantSetupResult } from '../../types/CodeAssistant';
import log from 'electron-log';

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

    static async checkAvailability(): Promise<CodeAssistantAvailability> {
        const systemCheck = new SystemCheck();
        const version = await systemCheck.checkClaudeCodeVersion();
        return { available: version !== null, version: version ?? undefined };
    }

    /**
     * Ensure the in-app MCP server is running and write .mcp.json for the
     * currently enabled targets. Idempotent.
     */
    static async setup(project: Project): Promise<CodeAssistantSetupResult> {
        const settings = project.settings;
        const devPath = settings.dev?.path;
        if (!devPath) {
            throw new Error('Development Path is not set for this project');
        }

        const connection = await getProjectMcpConnection(project);
        const mcpServers = connection.endpoints;

        const mcpConfigPath = path.join(devPath, '.mcp.json');
        fs.mkdirSync(devPath, { recursive: true });
        fs.writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers }, null, 2), 'utf8');
        log.info('[ClaudeCodeService] Wrote', mcpConfigPath, 'targets', connection.targets, 'port', connection.port);

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

        return { mcpConfigPath, ...connection };
    }
}
