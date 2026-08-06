/**
 * Control tools: drive AEM-Starter itself (lifecycle, settings, logs, packages,
 * backups, automation) for one project. Thin wrappers over the same managers and
 * services the Electron IPC handlers use — no logic is re-implemented here.
 *
 * The project is resolved fresh on every call so tools always act on current
 * state. Read-only tools are ungated; mutating tools are gated behind the
 * per-project "claudeCodeControl" setting (see isControlAllowed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import { ProjectSettings, SslProxySettings } from '../../../types/Project';
import { ProjectManagerRegister } from '../../ProjectManagerRegister';
import { AemInstanceManagerRegister } from '../../AemInstanceManagerRegister';
import { DispatcherManagerRegister } from '../../DispatcherManagerRegister';
import { HttpsServiceRegister } from '../../HttpsServiceRegister';
import { PackageManager } from '../PackageManager';
import { BackupService } from '../BackupService';
import { ReplicationSettings } from '../ReplicationSettings';
import { Automation } from '../automation/Automation';
import {
    McpTool,
    McpToolArgs,
    textResult,
    imageResult,
    requireString,
    optionalString,
    optionalNumber,
    optionalBoolean,
} from './McpTypes';
import { getProjectOrThrow, resolveAemConfig } from './mcpConfig';

type Instance = 'author' | 'publisher';
type SslType = 'author' | 'publisher' | 'dispatcher';

const SSL_DEFAULT_PORT: Record<SslType, number> = { author: 8502, publisher: 8503, dispatcher: 443 };

function requireInstance(args: McpToolArgs, key = 'instance'): Instance {
    const value = requireString(args, key);
    if (value !== 'author' && value !== 'publisher') {
        throw new Error(`${key} must be "author" or "publisher"`);
    }
    return value;
}

/** Whether mutating control tools are permitted for this project. */
function isControlAllowed(projectId: string): boolean {
    const project = getProjectOrThrow(projectId);
    // Default to allowed unless explicitly disabled; the toggle lives alongside
    // the Claude Code MCP settings.
    return project.settings.dev?.claudeCodeControl !== false;
}

function assertControlAllowed(projectId: string): void {
    if (!isControlAllowed(projectId)) {
        throw new Error('Control operations are disabled for this project (settings.dev.claudeCodeControl = false).');
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...target };
    for (const [key, value] of Object.entries(source)) {
        const existing = out[key];
        if (isPlainObject(value) && isPlainObject(existing)) {
            out[key] = deepMerge(existing, value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

export function buildControlTools(projectId: string): McpTool[] {
    return [
        {
            name: 'starter_status',
            description: 'Report running state, pid and debug flag for author and publisher, plus dispatcher status.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const project = getProjectOrThrow(projectId);
                const aem = AemInstanceManagerRegister.getInstanceManager(project);
                const dispatcher = DispatcherManagerRegister.getManager(project);
                const forInstance = (instance: Instance) => ({
                    running: aem.isInstanceRunning(instance),
                    pid: aem.getInstancePid(instance),
                    debug: aem.isInstanceInDebugMode(instance),
                    port: instance === 'publisher' ? project.settings.publisher?.port : project.settings.author?.port,
                });
                return textResult({
                    project: { id: project.id, name: project.name },
                    author: forInstance('author'),
                    publisher: forInstance('publisher'),
                    dispatcher: dispatcher.getDispatcherStatus(),
                });
            },
        },
        {
            name: 'starter_start',
            description: 'Start an AEM instance or the dispatcher. For author/publisher, set debug=true to start in debug mode.',
            inputSchema: {
                type: 'object',
                properties: {
                    instance: { type: 'string', enum: ['author', 'publisher', 'dispatcher'], description: 'What to start' },
                    debug: { type: 'boolean', description: 'Start author/publisher in debug mode (ignored for dispatcher)', default: false },
                },
                required: ['instance'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const project = getProjectOrThrow(projectId);
                const which = requireString(args, 'instance');
                if (which === 'dispatcher') {
                    await DispatcherManagerRegister.getManager(project).startDispatcher();
                    return textResult('dispatcher starting');
                }
                const instance = requireInstance(args);
                const debug = optionalBoolean(args, 'debug') ?? false;
                await AemInstanceManagerRegister.getInstanceManager(project).startInstance(instance, debug ? 'debug' : 'start');
                return textResult(`${instance} starting${debug ? ' (debug)' : ''}`);
            },
        },
        {
            name: 'starter_stop',
            description: 'Stop an AEM instance, the dispatcher, or everything. Use instance="all" to stop author, publisher and dispatcher.',
            inputSchema: {
                type: 'object',
                properties: {
                    instance: { type: 'string', enum: ['author', 'publisher', 'dispatcher', 'all'], description: 'What to stop' },
                },
                required: ['instance'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const project = getProjectOrThrow(projectId);
                const which = requireString(args, 'instance');
                const aem = AemInstanceManagerRegister.getInstanceManager(project);
                const dispatcher = DispatcherManagerRegister.getManager(project);
                if (which === 'all') {
                    await aem.killAllInstances();
                    if (dispatcher.isDispatcherRunning()) await dispatcher.stopDispatcher();
                    return textResult('stopping author, publisher and dispatcher');
                }
                if (which === 'dispatcher') {
                    await dispatcher.stopDispatcher();
                    return textResult('dispatcher stopping');
                }
                const instance = requireInstance(args);
                await aem.stopInstance(instance);
                return textResult(`${instance} stopping`);
            },
        },
        {
            name: 'starter_health',
            description: 'Return the latest health status for author, publisher and dispatcher.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const project = getProjectOrThrow(projectId);
                const aem = AemInstanceManagerRegister.getInstanceManager(project);
                const dispatcher = DispatcherManagerRegister.getManager(project);
                return textResult({
                    author: aem.getHealthStatus('author'),
                    publisher: aem.getHealthStatus('publisher'),
                    dispatcher: dispatcher.getHealthStatus(),
                });
            },
        },
        {
            name: 'starter_wait_for_healthy',
            description: 'Block until an author/publisher instance responds OK on its OSGi bundles endpoint, or the timeout elapses. Useful right after starter_start.',
            inputSchema: {
                type: 'object',
                properties: {
                    instance: { type: 'string', enum: ['author', 'publisher'] },
                    timeoutMs: { type: 'number', description: 'Max wait in ms (default 120000)', default: 120000 },
                },
                required: ['instance'],
            },
            handler: async (args: McpToolArgs) => {
                const instance = requireInstance(args);
                const timeoutMs = optionalNumber(args, 'timeoutMs') ?? 120000;
                const deadline = Date.now() + timeoutMs;
                let lastError = 'not started';
                while (Date.now() < deadline) {
                    const cfg = resolveAemConfig(projectId, instance);
                    try {
                        const res = await fetch(`${cfg.base}/system/console/bundles.json`, { headers: { Authorization: cfg.auth } });
                        if (res.ok) {
                            const json = await res.json() as { status?: unknown };
                            return textResult({ instance, healthy: true, status: json.status });
                        }
                        lastError = `${res.status} ${res.statusText}`;
                    } catch (err) {
                        lastError = err instanceof Error ? err.message : String(err);
                    }
                    await new Promise((r) => setTimeout(r, 3000));
                }
                return textResult({ instance, healthy: false, lastError, waitedMs: timeoutMs });
            },
        },
        {
            name: 'starter_find_in_logs',
            description: 'Search a log file of an author/publisher instance. Returns matching lines with line numbers. Omit pattern to tail the last lines.',
            inputSchema: {
                type: 'object',
                properties: {
                    instance: { type: 'string', enum: ['author', 'publisher'] },
                    pattern: { type: 'string', description: 'Case-insensitive regular expression. Omit to just tail the file.' },
                    logFile: { type: 'string', description: 'Log file name under crx-quickstart/logs (default "error.log")' },
                    maxMatches: { type: 'number', description: 'Max lines to return (default 200)', default: 200 },
                },
                required: ['instance'],
            },
            handler: async (args: McpToolArgs) => {
                const instance = requireInstance(args);
                const project = getProjectOrThrow(projectId);
                const logFile = optionalString(args, 'logFile') ?? 'error.log';
                if (logFile.includes('/') || logFile.includes('\\') || logFile.includes('..')) {
                    throw new Error('logFile must be a plain file name');
                }
                const maxMatches = optionalNumber(args, 'maxMatches') ?? 200;
                const pattern = optionalString(args, 'pattern');
                const logPath = path.join(project.folderPath, instance, 'crx-quickstart', 'logs', logFile);
                if (!fs.existsSync(logPath)) {
                    const available = AemInstanceManagerRegister.getInstanceManager(project).getAvailableLogFiles(instance);
                    throw new Error(`Log file not found: ${logFile}. Available: ${available.join(', ')}`);
                }
                const lines = fs.readFileSync(logPath, 'utf8').split('\n');
                let matched: { line: number; text: string }[];
                if (pattern) {
                    const regex = new RegExp(pattern, 'i');
                    matched = [];
                    for (let i = 0; i < lines.length; i++) {
                        if (regex.test(lines[i])) matched.push({ line: i + 1, text: lines[i] });
                    }
                } else {
                    matched = lines.map((text, i) => ({ line: i + 1, text }));
                }
                const truncated = matched.length > maxMatches;
                const returned = matched.slice(-maxMatches);
                return textResult({ logFile, totalMatches: matched.length, truncated, matches: returned });
            },
        },
        {
            name: 'starter_screenshot',
            description: 'Capture and return a screenshot of an author/publisher instance so it can be viewed.',
            inputSchema: {
                type: 'object',
                properties: { instance: { type: 'string', enum: ['author', 'publisher'] } },
                required: ['instance'],
            },
            handler: async (args: McpToolArgs) => {
                const instance = requireInstance(args);
                const project = getProjectOrThrow(projectId);
                const screenshotPath = await AemInstanceManagerRegister.getInstanceManager(project).takeScreenshot(instance);
                if (!screenshotPath || !fs.existsSync(screenshotPath)) {
                    throw new Error('Screenshot could not be captured');
                }
                const base64 = fs.readFileSync(screenshotPath).toString('base64');
                return imageResult(base64, 'image/png');
            },
        },
        {
            name: 'starter_get_settings',
            description: 'Return the full project settings plus global settings (SDK/license paths).',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const project = getProjectOrThrow(projectId);
                return textResult({
                    project: project.settings,
                    global: ProjectManagerRegister.getManager().getGlobalSettings(),
                });
            },
        },
        {
            name: 'starter_set_settings',
            description: 'Deep-merge a partial ProjectSettings patch into the project and persist it. Mutating — gated by claudeCodeControl. Returns the merged settings.',
            inputSchema: {
                type: 'object',
                properties: {
                    settings: { type: 'object', description: 'Partial ProjectSettings to merge (e.g. { "author": { "port": 4502 } })' },
                },
                required: ['settings'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const patch = args['settings'];
                if (!isPlainObject(patch)) throw new Error('settings must be an object');
                if ('ssl' in patch || 'https' in patch) {
                    throw new Error('SSL/HTTPS is a runtime service, not just config — use starter_ssl_proxy (action: start/stop/status) instead of set_settings.');
                }
                const project = getProjectOrThrow(projectId);
                const merged = deepMerge(project.settings as unknown as Record<string, unknown>, patch) as unknown as ProjectSettings;
                const updated = ProjectManagerRegister.getManager().updateProjectSettings(project.id, merged);
                if (!updated) throw new Error('Failed to persist settings');
                AemInstanceManagerRegister.updateProjectReference(updated);
                DispatcherManagerRegister.updateProjectReference(updated);
                HttpsServiceRegister.updateProjectReference(updated);
                return textResult(updated.settings);
            },
        },
        {
            name: 'starter_flush_dispatcher',
            description: 'Clear the dispatcher cache.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                assertControlAllowed(projectId);
                const project = getProjectOrThrow(projectId);
                DispatcherManagerRegister.getManager(project).clearCache();
                return textResult('dispatcher cache cleared');
            },
        },
        {
            name: 'starter_ssl_proxy',
            description: 'Manage the HTTPS (SSL) proxies for author (:8502), publisher (:8503) and dispatcher (:443). This is a runtime service — it writes the correct ssl settings AND starts/stops the proxy. Do NOT use starter_set_settings for SSL. action: start | stop | status. targets: optional subset (default all).',
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['start', 'stop', 'status'] },
                    targets: {
                        type: 'array',
                        description: 'Which proxies (default: all three)',
                        items: { type: 'string', enum: ['author', 'publisher', 'dispatcher'] },
                    },
                },
                required: ['action'],
            },
            handler: async (args: McpToolArgs) => {
                const action = requireString(args, 'action');
                const project = getProjectOrThrow(projectId);
                const service = HttpsServiceRegister.getService(project);
                const mainWindow = BrowserWindow.getAllWindows()[0];
                if (mainWindow) service.setMainWindow(mainWindow);

                if (action === 'status') {
                    return textResult({
                        running: await service.isSslProxyRunning(),
                        enabled: service.getEnabledSslProxyTypes(),
                        proxies: service.getRunningProxies(),
                    });
                }

                assertControlAllowed(projectId);

                const rawTargets = Array.isArray(args['targets']) ? (args['targets'] as unknown[]) : [];
                const targets: SslType[] = rawTargets
                    .filter((t): t is SslType => t === 'author' || t === 'publisher' || t === 'dispatcher');
                const affected: SslType[] = targets.length > 0 ? targets : ['author', 'publisher', 'dispatcher'];

                // Build a valid ssl block ({ enabled, port } per type), preserving
                // any existing ports and flipping only the requested targets.
                const existing = project.settings.ssl;
                const enable = action === 'start';
                const forType = (type: SslType): SslProxySettings => {
                    const prev = existing?.[type];
                    const port = prev?.port ?? SSL_DEFAULT_PORT[type];
                    const wasEnabled = prev?.enabled ?? false;
                    return { enabled: affected.includes(type) ? enable : wasEnabled, port };
                };
                const ssl = { author: forType('author'), publisher: forType('publisher'), dispatcher: forType('dispatcher') };
                const merged: ProjectSettings = { ...project.settings, ssl };

                const updated = ProjectManagerRegister.getManager().updateProjectSettings(project.id, merged);
                if (!updated) throw new Error('Failed to persist SSL settings');
                HttpsServiceRegister.updateProjectReference(updated);
                AemInstanceManagerRegister.updateProjectReference(updated);
                DispatcherManagerRegister.updateProjectReference(updated);

                // Restart the proxy set: stop everything, then start whatever is now enabled.
                await service.stopSslProxy();
                if (service.isAnySslProxyEnabled()) {
                    await service.startSslProxy();
                }

                return textResult({
                    action,
                    affected,
                    running: await service.isSslProxyRunning(),
                    enabled: service.getEnabledSslProxyTypes(),
                    proxies: service.getRunningProxies(),
                });
            },
        },
        {
            name: 'starter_list_packages',
            description: 'List content packages known to the project.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const project = getProjectOrThrow(projectId);
                return textResult(await new PackageManager(project).listPackages());
            },
        },
        {
            name: 'starter_install_package',
            description: 'Install a package on author or publisher. package can be a local package name, a local file path, or an http(s) URL.',
            inputSchema: {
                type: 'object',
                properties: {
                    instance: { type: 'string', enum: ['author', 'publisher'] },
                    package: { type: 'string', description: 'Package name, file path, or URL' },
                },
                required: ['instance', 'package'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const instance = requireInstance(args);
                const pkg = requireString(args, 'package');
                const project = getProjectOrThrow(projectId);
                const manager = new PackageManager(project);
                let name = pkg;
                if (pkg.startsWith('http://') || pkg.startsWith('https://')) {
                    name = await manager.downloadWebPackage(pkg);
                } else if (pkg.includes('/') || pkg.includes('\\')) {
                    name = await manager.importPackage(pkg);
                }
                await manager.installPackage(instance, name);
                return textResult(`installed ${name} on ${instance}`);
            },
        },
        {
            name: 'starter_list_backups',
            description: 'List available backups for the project.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const project = getProjectOrThrow(projectId);
                return textResult(await new BackupService(project).listBackups());
            },
        },
        {
            name: 'starter_create_backup',
            description: 'Create a backup of the project instances.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Backup name' },
                    compress: { type: 'boolean', description: 'Compress the backup (default true)', default: true },
                    description: { type: 'string', description: 'Optional description' },
                },
                required: ['name'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const name = requireString(args, 'name');
                const compress = optionalBoolean(args, 'compress') ?? true;
                const description = optionalString(args, 'description');
                const project = getProjectOrThrow(projectId);
                await new BackupService(project).backup(name, compress, description);
                return textResult(`backup "${name}" created`);
            },
        },
        {
            name: 'starter_restore_backup',
            description: 'Restore the project from a named backup. Mutating and destructive to current state — gated by claudeCodeControl.',
            inputSchema: {
                type: 'object',
                properties: { name: { type: 'string', description: 'Backup name to restore' } },
                required: ['name'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const name = requireString(args, 'name');
                const project = getProjectOrThrow(projectId);
                await new BackupService(project).restore(name);
                return textResult(`restored from backup "${name}"`);
            },
        },
        {
            name: 'starter_setup_replication',
            description: 'Wire up replication for the given instance (author, publisher or dispatcher).',
            inputSchema: {
                type: 'object',
                properties: { instance: { type: 'string', enum: ['author', 'publisher', 'dispatcher'] } },
                required: ['instance'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const instance = requireString(args, 'instance');
                if (instance !== 'author' && instance !== 'publisher' && instance !== 'dispatcher') {
                    throw new Error('instance must be author, publisher or dispatcher');
                }
                const project = getProjectOrThrow(projectId);
                const result = await ReplicationSettings.getInstance().setReplication(project, instance);
                return textResult(result ?? 'replication configured');
            },
        },
        {
            name: 'starter_list_automation_tasks',
            description: 'List the automation task types that starter_run_automation_task can run.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => textResult(Automation.getTaskTypes()),
        },
        {
            name: 'starter_run_automation_task',
            description: 'Run a named automation task (see starter_list_automation_tasks).',
            inputSchema: {
                type: 'object',
                properties: {
                    task: { type: 'string', description: 'Automation task type' },
                },
                required: ['task'],
            },
            handler: async (args: McpToolArgs) => {
                assertControlAllowed(projectId);
                const task = requireString(args, 'task');
                if (!Automation.getTaskTypes().includes(task)) {
                    throw new Error(`Unknown task "${task}". Available: ${Automation.getTaskTypes().join(', ')}`);
                }
                const project = getProjectOrThrow(projectId);
                await Automation.run(project, task);
                return textResult(`automation task "${task}" completed`);
            },
        },
    ];
}
