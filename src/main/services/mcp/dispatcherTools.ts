/**
 * Dispatcher tools: inspect the local dispatcher config folder and the Docker
 * container serving it. Config resolved lazily from live project settings.
 *
 * Ported from the former stdio bundle (resources/mcp-server/src/server.mjs).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { McpTool, McpToolArgs, textResult, requireString, optionalString } from './McpTypes';

const execFileAsync = promisify(execFile);

export interface DispatcherConfig {
    dir: string;
    port: string;
}

function resolveWithin(baseDir: string, relative: string): string {
    if (!baseDir) throw new Error('Dispatcher folder is not configured');
    const resolved = path.resolve(baseDir, relative);
    if (resolved !== path.resolve(baseDir) && !resolved.startsWith(path.resolve(baseDir) + path.sep)) {
        throw new Error('Path escapes the dispatcher folder');
    }
    return resolved;
}

export function buildDispatcherTools(getConfig: () => DispatcherConfig): McpTool[] {
    return [
        {
            name: 'dispatcher_read_config',
            description: 'Read a dispatcher config file (e.g. dispatcher.any, or any file under the dispatcher config folder). Path is relative to the dispatcher folder.',
            inputSchema: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'Relative path to the config file, e.g. config/conf.dispatcher.d/available_farms/default.farm' },
                },
                required: ['file'],
            },
            handler: async (args: McpToolArgs) => {
                const { dir } = getConfig();
                const resolved = resolveWithin(dir, requireString(args, 'file'));
                return textResult(await fs.readFile(resolved, 'utf8'));
            },
        },
        {
            name: 'dispatcher_list_files',
            description: 'List files in a folder under the dispatcher directory (defaults to the dispatcher root). Useful to explore config and cache.',
            inputSchema: {
                type: 'object',
                properties: {
                    folder: { type: 'string', description: 'Relative folder path (default ".")', default: '.' },
                },
            },
            handler: async (args: McpToolArgs) => {
                const { dir } = getConfig();
                const resolved = resolveWithin(dir, optionalString(args, 'folder') ?? '.');
                const entries = await fs.readdir(resolved, { withFileTypes: true });
                return textResult(entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)));
            },
        },
        {
            name: 'dispatcher_container_status',
            description: 'Report the Docker container(s) serving the dispatcher on its configured port.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const { port } = getConfig();
                try {
                    const { stdout } = await execFileAsync('docker', [
                        'ps',
                        '--format',
                        '{{.ID}} {{.Image}} {{.Status}} {{.Ports}}',
                    ]);
                    const lines = stdout.split('\n').filter(Boolean);
                    const matching = lines.filter((l) => l.includes(`:${port}->`));
                    return textResult({ port, containers: matching.length ? matching : lines });
                } catch (err) {
                    throw new Error(`docker ps failed: ${err instanceof Error ? err.message : String(err)}`);
                }
            },
        },
    ];
}
