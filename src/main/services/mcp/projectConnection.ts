import { Project } from '../../../types/Project';
import { CodeAssistantSetupResult, McpEndpointConfig } from '../../../types/CodeAssistant';
import { McpServerRegister } from './McpServerRegister';

export async function getProjectMcpConnection(project: Project): Promise<Omit<CodeAssistantSetupResult, 'mcpConfigPath'>> {
    if (!project.settings.dev?.path) {
        throw new Error('Development Path is not set for this project');
    }

    const server = await McpServerRegister.ensureStarted(project);
    const port = server.getPort();
    const url = `http://127.0.0.1:${port}`;
    const endpoint = (target: string): McpEndpointConfig => ({ type: 'http', url: `${url}/mcp/${target}` });
    const endpoints = {
        'aem-author': endpoint('author'),
        'aem-publisher': endpoint('publisher'),
        'aem-dispatcher': endpoint('dispatcher'),
        'aem-starter': endpoint('control'),
    };
    return { port, url, targets: Object.keys(endpoints), endpoints };
}
