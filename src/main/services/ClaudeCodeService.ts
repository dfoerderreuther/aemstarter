import { Project } from '../../types/Project';
import fs from 'fs';
import path from 'path';
import { SystemCheck } from './SystemCheck';
import log from 'electron-log';

export interface ClaudeCodeAvailability {
    available: boolean;
    version?: string;
}

export interface ClaudeCodeSetupResult {
    mcpDir: string;
    mcpConfigPath: string;
    serverPath: string;
    targets: string[];
}

/**
 * Scaffolds the Claude Code MCP integration for a project.
 *
 * Transport is stdio: Claude Code itself spawns the MCP server processes from the
 * project-local .mcp.json. This service only (a) copies the pre-built, self-contained
 * MCP server bundle into the project's ./mcp folder and (b) writes .mcp.json into the
 * dev path (where `claude` runs), with one entry per enabled target.
 */
export class ClaudeCodeService {

    /** Folder name of the latest bundled MCP server build (ships in resources). */
    private static readonly LATEST_BUILD = 'v1';

    /** Absolute path to the bundled MCP server build, resolved for dev vs packaged app. */
    private static vendorDir(): string {
        const base = process.env.NODE_ENV === 'development'
            ? path.join(__dirname, '../../resources/mcp-server')
            : process.resourcesPath;
        return path.join(base, this.LATEST_BUILD);
    }

    static async checkAvailability(): Promise<ClaudeCodeAvailability> {
        const systemCheck = new SystemCheck();
        const version = await systemCheck.checkClaudeCodeVersion();
        return { available: version !== null, version: version ?? undefined };
    }

    /**
     * Copy the bundled server into ./mcp (if missing or version changed) and write
     * .mcp.json for the currently enabled targets. Idempotent.
     */
    static setup(project: Project): ClaudeCodeSetupResult {
        const settings = project.settings;
        const devPath = settings.dev?.path;
        if (!devPath) {
            throw new Error('Development Path is not set for this project');
        }

        const mcpDir = path.join(project.folderPath, 'mcp');
        const serverPath = path.join(mcpDir, 'server.cjs');
        const versionMarker = path.join(mcpDir, '.version');

        // Copy the bundled server if it's missing or an older build is installed.
        const folder = this.LATEST_BUILD;
        const vendorServer = path.join(this.vendorDir(), 'server.cjs');
        const currentMarker = fs.existsSync(versionMarker)
            ? fs.readFileSync(versionMarker, 'utf8').trim()
            : '';
        if (!fs.existsSync(serverPath) || currentMarker !== folder) {
            if (!fs.existsSync(vendorServer)) {
                throw new Error(`Bundled MCP server not found at ${vendorServer}. Run "npm run mcp:build".`);
            }
            fs.mkdirSync(mcpDir, { recursive: true });
            fs.copyFileSync(vendorServer, serverPath);
            fs.writeFileSync(versionMarker, folder, 'utf8');
            log.info('[ClaudeCodeService] Installed MCP server bundle', folder, '->', serverPath);
        }

        const targetsSetting = settings.dev?.claudeCodeMcpTargets || { author: true, publisher: true, dispatcher: true };
        const mcpServers: Record<string, unknown> = {};
        const enabled: string[] = [];

        if (targetsSetting.author) {
            enabled.push('aem-author');
            mcpServers['aem-author'] = {
                command: 'node',
                args: [serverPath, '--target=author'],
                env: {
                    MCP_TARGET: 'author',
                    AEM_HOST: 'localhost',
                    AEM_PORT: String(settings.author?.port ?? 4502),
                    AEM_USER: 'admin',
                    AEM_PASSWORD: 'admin',
                },
            };
        }
        if (targetsSetting.publisher) {
            enabled.push('aem-publisher');
            mcpServers['aem-publisher'] = {
                command: 'node',
                args: [serverPath, '--target=publisher'],
                env: {
                    MCP_TARGET: 'publisher',
                    AEM_HOST: 'localhost',
                    AEM_PORT: String(settings.publisher?.port ?? 4503),
                    AEM_USER: 'admin',
                    AEM_PASSWORD: 'admin',
                },
            };
        }
        if (targetsSetting.dispatcher) {
            enabled.push('aem-dispatcher');
            mcpServers['aem-dispatcher'] = {
                command: 'node',
                args: [serverPath, '--target=dispatcher'],
                env: {
                    MCP_TARGET: 'dispatcher',
                    DISPATCHER_DIR: path.join(project.folderPath, 'dispatcher'),
                    DISPATCHER_PORT: String(settings.dispatcher?.port ?? 80),
                },
            };
        }

        const mcpConfigPath = path.join(devPath, '.mcp.json');
        fs.mkdirSync(devPath, { recursive: true });
        fs.writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers }, null, 2), 'utf8');
        log.info('[ClaudeCodeService] Wrote', mcpConfigPath, 'with targets', enabled);

        return { mcpDir, mcpConfigPath, serverPath, targets: enabled };
    }
}
