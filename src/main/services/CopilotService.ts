import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { Project } from '../../types/Project';
import { COPILOT_MCP_CONFIG_FILE, CodeAssistantAvailability, CodeAssistantSetupResult, McpEndpointConfig } from '../../types/CodeAssistant';
import { SystemCheck } from './SystemCheck';
import { getProjectMcpConnection } from './mcp/projectConnection';

export class CopilotService {
    static async checkAvailability(): Promise<CodeAssistantAvailability> {
        const version = await new SystemCheck().checkCopilotVersion();
        return { available: version !== null, version: version ?? undefined };
    }

    static async setup(project: Project): Promise<CodeAssistantSetupResult> {
        const connection = await getProjectMcpConnection(project);
        const endpoints: Record<string, McpEndpointConfig> = {};
        for (const [name, endpoint] of Object.entries(connection.endpoints)) {
            endpoints[name] = { ...endpoint, tools: ['*'] };
        }

        const devPath = project.settings.dev.path;
        const mcpConfigPath = path.join(devPath, COPILOT_MCP_CONFIG_FILE);
        fs.mkdirSync(devPath, { recursive: true });
        fs.writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers: endpoints }, null, 2), 'utf8');
        log.info('[CopilotService] Wrote', mcpConfigPath, 'targets', connection.targets, 'port', connection.port);
        return { ...connection, mcpConfigPath, endpoints };
    }
}
