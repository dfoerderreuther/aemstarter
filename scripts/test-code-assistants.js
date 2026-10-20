const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const log = { info() {}, warn() {}, error() {} };

// Compile the real services while replacing Electron and AEM process dependencies.
function loadSource(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const localRequire = Module.createRequire(filename);
  loaded.require = (id) => {
    if (id === 'electron-log') return log;
    return Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : localRequire(id);
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  loaded._compile(outputText, filename);
  return loaded.exports;
}

const types = loadSource('src/types/CodeAssistant.ts');
const endpoint = loadSource('src/main/services/mcp/McpEndpoint.ts');
const server = loadSource('src/main/services/mcp/AemStarterMcpServer.ts', { './McpEndpoint': endpoint });
const tools = () => [{
  name: 'status',
  description: 'Test status',
  inputSchema: { type: 'object', properties: {} },
  handler: async () => ({ content: [{ type: 'text', text: 'ready' }] }),
}];
const { McpServerRegister } = loadSource('src/main/services/mcp/McpServerRegister.ts', {
  './AemStarterMcpServer': server,
  './aemTools': { buildAemTools: tools },
  './dispatcherTools': { buildDispatcherTools: tools },
  './controlTools': { buildControlTools: tools },
  './mcpConfig': {},
});
const connection = loadSource('src/main/services/mcp/projectConnection.ts', {
  './McpServerRegister': { McpServerRegister },
});
const systemCheck = {
  SystemCheck: class {
    async checkClaudeCodeVersion() { return '2.0.0'; }
    async checkCopilotVersion() { return 'GitHub Copilot CLI 1.0.101-0.'; }
  },
};
const mocks = {
  '../../types/CodeAssistant': types,
  './SystemCheck': systemCheck,
  './mcp/projectConnection': connection,
};
const { CopilotService } = loadSource('src/main/services/CopilotService.ts', mocks);
const { ClaudeCodeService } = loadSource('src/main/services/ClaudeCodeService.ts', mocks);
const { ProjectSettingsService } = loadSource('src/main/services/ProjectSettingsService.ts');

after(() => McpServerRegister.stopAll());

function createProject(t) {
  const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aem-starter-assistant-'));
  t.after(() => fs.rmSync(folderPath, { recursive: true, force: true }));
  const project = { id: folderPath, name: 'Test project', folderPath };
  project.settings = ProjectSettingsService.getDefaultSettings(project);
  return project;
}

test('Copilot setup writes four HTTP endpoints without changing existing MCP files', async (t) => {
  const project = createProject(t);
  project.settings.dev.path = path.join(project.folderPath, 'development with spaces');
  fs.mkdirSync(project.settings.dev.path);
  const existingConfig = path.join(project.settings.dev.path, '.mcp.json');
  fs.writeFileSync(existingConfig, '{"mcpServers":{"custom":{"url":"https://example.com"}}}');
  const original = fs.readFileSync(existingConfig, 'utf8');
  const result = await CopilotService.setup(project);
  assert.equal(result.mcpConfigPath, path.join(project.settings.dev.path, types.COPILOT_MCP_CONFIG_FILE));
  assert.deepEqual(result.targets, ['aem-author', 'aem-publisher', 'aem-dispatcher', 'aem-starter']);
  assert.ok(result.port > 0);
  assert.equal(fs.readFileSync(existingConfig, 'utf8'), original);
  assert.deepEqual(JSON.parse(fs.readFileSync(result.mcpConfigPath, 'utf8')), { mcpServers: result.endpoints });
  for (const [index, name] of result.targets.entries()) {
    assert.deepEqual(result.endpoints[name], {
      type: 'http',
      url: `${result.url}/mcp/${['author', 'publisher', 'dispatcher', 'control'][index]}`,
      tools: ['*'],
    });
    const response = await fetch(result.endpoints[name].url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.tools[0].name, 'status');
  }
});

test('concurrent Claude and Copilot setup share one server and preserve config formats', async (t) => {
  const project = createProject(t);
  const [claude, copilot, repeated] = await Promise.all([
    ClaudeCodeService.setup(project), CopilotService.setup(project), CopilotService.setup(project),
  ]);
  assert.equal(claude.port, copilot.port);
  assert.equal(copilot.port, repeated.port);
  assert.notEqual(claude.mcpConfigPath, copilot.mcpConfigPath);
  assert.equal(claude.endpoints['aem-author'].tools, undefined);
  assert.deepEqual(copilot.endpoints['aem-author'].tools, ['*']);
  assert.deepEqual(JSON.parse(fs.readFileSync(claude.mcpConfigPath, 'utf8')), { mcpServers: claude.endpoints });
});

test('projects have isolated MCP ports and reload refreshes a restarted server port', async (t) => {
  const project = createProject(t);
  const other = createProject(t);
  const first = await CopilotService.setup(project);
  const second = await CopilotService.setup(other);
  assert.notEqual(first.port, second.port);
  await McpServerRegister.get(project.id).stop();
  const refreshed = await CopilotService.setup(project);
  assert.equal(refreshed.port, McpServerRegister.get(project.id).getPort());
  assert.deepEqual(JSON.parse(fs.readFileSync(refreshed.mcpConfigPath, 'utf8')), { mcpServers: refreshed.endpoints });
});

test('setup reports missing development paths and config write failures', async (t) => {
  const project = createProject(t);
  project.settings.dev.path = '';
  await assert.rejects(CopilotService.setup(project), /Development Path is not set/);
  const file = path.join(project.folderPath, 'not-a-directory');
  fs.writeFileSync(file, 'keep');
  project.settings.dev.path = file;
  await assert.rejects(CopilotService.setup(project), /EEXIST|ENOTDIR/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
});

test('legacy settings default Copilot off and saved integrations remain independent', (t) => {
  const project = createProject(t);
  const settingsPath = path.join(project.folderPath, 'settings.json');
  delete project.settings.dev.copilotEnabled;
  fs.writeFileSync(settingsPath, JSON.stringify(project.settings));
  assert.equal(ProjectSettingsService.getSettings(project).dev.copilotEnabled, false);
  const settings = ProjectSettingsService.getSettings(project);
  settings.dev.copilotEnabled = true;
  settings.dev.claudeCodeEnabled = false;
  settings.dev.claudeCodeControl = false;
  ProjectSettingsService.saveSettings(project, settings);
  const restored = ProjectSettingsService.getSettings(project);
  assert.equal(restored.dev.copilotEnabled, true);
  assert.equal(restored.dev.claudeCodeEnabled, false);
  assert.equal(restored.dev.claudeCodeControl, false);
});

test('CLI detection selects the version line and supports missing installations', async () => {
  let installed = true;
  const commands = [];
  const output = (command) => {
    commands.push(command);
    if (!installed) throw new Error('command not found');
    return { stdout: 'GitHub Copilot CLI 1.0.101-0.\nRun copilot update to check for updates.\n' };
  };
  const { SystemCheck } = loadSource('src/main/services/SystemCheck.ts', {
    './JavaService': {},
    '../enhancedExecAsync': { enhancedExecAsync: async (command) => output(command) },
    child_process: {
      execFile: (_shell, args, _options, callback) => {
        try { callback(null, output(args[1])); } catch (error) { callback(error); }
      },
    },
  });
  const check = new SystemCheck();
  assert.equal(await check.checkCopilotVersion(), 'GitHub Copilot CLI 1.0.101-0.');
  assert.ok(commands.every(command => command === 'copilot --version'));
  const service = loadSource('src/main/services/CopilotService.ts', {
    ...mocks, './SystemCheck': { SystemCheck },
  }).CopilotService;
  assert.deepEqual(await service.checkAvailability(), { available: true, version: 'GitHub Copilot CLI 1.0.101-0.' });
  installed = false;
  assert.deepEqual(await service.checkAvailability(), { available: false, version: undefined });
});
