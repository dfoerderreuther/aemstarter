/**
 * Per-project registry of in-app MCP servers, mirroring the other *Register
 * singletons. One AemStarterMcpServer per project, keyed by project id, so each
 * project's Claude session connects to its own loopback port.
 */
import log from 'electron-log';
import { Project } from '../../../types/Project';
import { AemStarterMcpServer } from './AemStarterMcpServer';
import { buildAemTools } from './aemTools';
import { buildDispatcherTools } from './dispatcherTools';
import { buildControlTools } from './controlTools';
import { resolveAemConfig, resolveDispatcherConfig } from './mcpConfig';

export class McpServerRegister {
    private static servers: Map<string, AemStarterMcpServer> = new Map();

    /** Ensure the project's MCP server is running; returns it (with a live port). */
    static async ensureStarted(project: Project): Promise<AemStarterMcpServer> {
        let server = this.servers.get(project.id);
        if (!server) {
            server = new AemStarterMcpServer(project.id, {
                author: () => buildAemTools(() => resolveAemConfig(project.id, 'author')),
                publisher: () => buildAemTools(() => resolveAemConfig(project.id, 'publisher')),
                dispatcher: () => buildDispatcherTools(() => resolveDispatcherConfig(project.id)),
                control: () => buildControlTools(project.id),
            });
            this.servers.set(project.id, server);
        }
        await server.start();
        return server;
    }

    static get(projectId: string): AemStarterMcpServer | undefined {
        return this.servers.get(projectId);
    }

    static async stopAll(): Promise<void> {
        const servers = [...this.servers.values()];
        this.servers.clear();
        await Promise.all(servers.map((s) => s.stop().catch((err) => log.error('[McpServerRegister] stop failed:', err))));
    }
}
