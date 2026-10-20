import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Stack, Group, Text, Button, Anchor, ActionIcon, Code, CopyButton, Tooltip, HoverCard, Alert } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconCopy, IconCheck, IconInfoCircle, IconReload } from '@tabler/icons-react';
import { Terminal, TerminalRef } from './Terminal';
import { Project } from '../../types/Project';
import { COPILOT_MCP_CONFIG_FILE, CodeAssistantSetupResult } from '../../types/CodeAssistant';

type McpTargetKey = 'author' | 'publisher' | 'dispatcher' | 'starter';

const MCP_CONNECTIONS: { key: McpTargetKey; label: string; hint: string; examples: string[] }[] = [
  {
    key: 'author', label: 'aem-author', hint: 'Read/write JCR content on the author instance.',
    examples: [
      'aem-author read node /content/wknd/us/en',
      'aem-author list children of /content',
      'aem-author query cq:Page under /content limit 10',
      'aem-author list all live copy configs in /content/wknd',
      'aem-author create node /content/wknd/foo type cq:Page',
      'aem-author system info',
    ],
  },
  {
    key: 'publisher', label: 'aem-publisher', hint: 'Read/write JCR content on the publisher instance.',
    examples: [
      'aem-publisher read node /content/wknd',
      'aem-publisher list children of /content',
      'aem-publisher query cq:Page under /content',
      'aem-publisher system info',
    ],
  },
  {
    key: 'dispatcher', label: 'aem-dispatcher', hint: 'Inspect dispatcher config files and the Docker container.',
    examples: [
      'aem-dispatcher read config default.farm',
      'aem-dispatcher read config dispatcher.any',
      'aem-dispatcher list files under conf.d',
      'aem-dispatcher container status',
    ],
  },
  {
    key: 'starter', label: 'aem-starter', hint: 'Control AEM-Starter itself: start/stop, logs, SSL, packages, backups.',
    examples: [
      'aem-starter status',
      'aem-starter start author in debug, wait until healthy',
      'aem-starter find "ERROR" in author error.log',
      'aem-starter enable ssl for author',
      'aem-starter install package /path/to/pkg.zip on author',
      'aem-starter backup before I try something risky',
      'aem-starter screenshot author',
    ],
  },
];

interface CodeAssistantTabProps {
  project: Project;
  visible?: boolean;
  assistant: 'claude' | 'copilot';
}

const ASSISTANTS = {
  claude: {
    name: 'Claude Code',
    command: 'claude',
    installUrl: 'https://docs.claude.com/en/docs/claude-code/setup',
    configFile: '.mcp.json',
    launchCommand: 'claude --permission-mode auto',
    checkAvailability: () => window.electronAPI.checkClaudeCode(),
    setup: (project: Project) => window.electronAPI.setupClaudeCodeMcp(project),
  },
  copilot: {
    name: 'GitHub Copilot',
    command: 'copilot',
    installUrl: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-getting-started',
    configFile: COPILOT_MCP_CONFIG_FILE,
    launchCommand: `copilot --additional-mcp-config @${COPILOT_MCP_CONFIG_FILE} --allow-tool=aem-author --allow-tool=aem-publisher --allow-tool=aem-dispatcher --allow-tool=aem-starter`,
    checkAvailability: () => window.electronAPI.checkCopilot(),
    setup: (project: Project) => window.electronAPI.setupCopilotMcp(project),
  },
};

type AssistantState = 'checking' | 'missing' | 'ready' | 'error';

export const CodeAssistantTab = ({ project, visible = true, assistant }: CodeAssistantTabProps) => {
  const config = ASSISTANTS[assistant];
  const [assistantState, setAssistantState] = useState<AssistantState>('checking');
  const [version, setVersion] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [reloading, setReloading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mcpInfo, setMcpInfo] = useState<CodeAssistantSetupResult | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const terminalRef = useRef<TerminalRef>(null);
  const launchedRef = useRef(false);
  const devPath = project.settings.dev?.path || '';

  // Show the collapsible panel when the tab is revealed.
  useEffect(() => {
    if (visible) setIsCollapsed(false);
  }, [visible]);

  // Wait for the 300ms sidebar transition before resizing the terminal.
  useEffect(() => {
    const timer = setTimeout(() => terminalRef.current?.resize(), 350);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const availability = await config.checkAvailability();
        if (cancelled) return;
        setVersion(availability.version);
        if (!availability.available) {
          setAssistantState('missing');
          return;
        }
        const result = await config.setup(project);
        if (cancelled) return;
        setMcpInfo(result);
        setErrorMessage(null);
        setAssistantState('ready');
      } catch (error) {
        console.error(`Failed to initialize ${config.name}:`, error);
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setAssistantState('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [config, project, initializationAttempt]);

  const handleTerminalReady = () => {
    setTerminalReady(true);
  };

  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      const result = await config.setup(project);
      setMcpInfo(result);
      setErrorMessage(null);
      launchedRef.current = false;
      setTerminalReady(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      console.error('Failed to refresh MCP config on reload:', error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setReloading(false);
    }
  }, [config, project]);

  useEffect(() => {
    if (launchedRef.current || !visible || !terminalReady || !mcpInfo || assistantState !== 'ready') return;
    const timer = setTimeout(() => {
      launchedRef.current = true;
      terminalRef.current?.resize();
      terminalRef.current?.writeToShell(`${config.launchCommand}\n`);
      terminalRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, terminalReady, mcpInfo, assistantState, config]);

  if (assistantState === 'missing' || assistantState === 'error') {
    return (
      <Stack gap="md" p="xl" align="center" justify="center" style={{ height: 'calc(100vh - 146px)' }}>
        <Text fw={700} size="lg">{config.name} {assistantState === 'missing' ? 'CLI not found' : 'setup failed'}</Text>
        <Text c="dimmed" ta="center" maw={520}>
          {assistantState === 'error' ? errorMessage : (
            <>This integration launches the <code>{config.command}</code> command in a terminal.
              Install the {config.name} CLI, then retry.</>
          )}
        </Text>
        {assistantState === 'missing' && (
          <>
            <Button
              rightSection={<IconExternalLink size={16} />}
              onClick={() => window.electronAPI.openUrl(config.installUrl)}
            >
              Install {config.name}
            </Button>
            <Anchor size="xs" c="dimmed" onClick={() => window.electronAPI.openUrl(config.installUrl)}>
              {config.installUrl}
            </Anchor>
          </>
        )}
        <Button variant="subtle" onClick={() => {
          launchedRef.current = false;
          setTerminalReady(false);
          setMcpInfo(null);
          setErrorMessage(null);
          setAssistantState('checking');
          setInitializationAttempt((attempt) => attempt + 1);
        }}>Retry</Button>
      </Stack>
    );
  }

  return (
    <Stack gap="0" style={{ height: 'calc(100vh - 146px)' }}>
      <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
        <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
          <Text size="xs" fw={700} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {config.name.toUpperCase()}{version ? ` - ${version}` : ''}
          </Text>
          <Box style={{ flex: 1 }} />
          <Tooltip label={`Reload MCP config + restart ${config.name}`} withArrow>
            <ActionIcon size="xs" variant="subtle" onClick={handleReload} loading={reloading} disabled={assistantState !== 'ready'} aria-label={`Reload ${config.name}`}>
              <IconReload size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      {errorMessage && <Alert color="red" title="MCP configuration failed">{errorMessage}</Alert>}

      {/* Main content area with collapsible sidebar, matching the Dev terminal:
          panel on the left, terminal on the right. */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
        {/* Collapsible Column - Left */}
        <Box style={{
          width: isCollapsed ? '40px' : '300px',
          transition: 'width 0.3s ease',
          borderRight: '1px solid #2C2E33',
          backgroundColor: '#1E1E1E',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Collapse/Expand Button - Integrated */}
          <Box style={{ position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)', zIndex: 10 }}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setIsCollapsed((c) => !c)}
              style={{ backgroundColor: 'rgba(58,58,58,1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
            >
              {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
            </ActionIcon>
          </Box>

          {!isCollapsed && (
            <Stack gap="sm" p="md" style={{ overflowY: 'auto', height: '100%' }}>
              <Text size="xs" fw={700} c="dimmed">MCP CONNECTIONS</Text>
              {MCP_CONNECTIONS.map((conn) => (
                <Group key={conn.key} gap={6} wrap="nowrap" align="center">
                  <Text size="xs" style={{ flex: 1 }}>{conn.label}</Text>
                  <HoverCard width={450} shadow="md" withArrow position="right" openDelay={100}>
                    <HoverCard.Target>
                      <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`${conn.label} examples`}>
                        <IconInfoCircle size={14} />
                      </ActionIcon>
                    </HoverCard.Target>
                    <HoverCard.Dropdown>
                      <Text size="xs" fw={700}>{conn.label}</Text>
                      <Text size="xs" c="dimmed" mb={6}>{conn.hint}</Text>
                      <Text size="xs" c="dimmed" mb={4}>Example prompts (just mention it):</Text>
                      <Code block style={{ fontSize: 10, lineHeight: 1.5 }}>
                        {[...conn.examples, `${conn.label} ...`].join('\n')}
                      </Code>
                    </HoverCard.Dropdown>
                  </HoverCard>
                </Group>
              ))}

              {mcpInfo && (
                <Stack gap={6} mt="sm" pt="sm" style={{ borderTop: '1px solid #2C2E33' }}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text size="xs" fw={700} c="dimmed">CONNECTION</Text>
                    <Text size="xs" c="teal">● 127.0.0.1:{mcpInfo.port}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    In-app MCP server (loopback). Connect another {config.name} session with the config below.
                    {assistant === 'copilot' && ' AEM MCP tools are pre-approved; other tools keep Copilot permission prompts.'}
                  </Text>

                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text size="xs" c="dimmed">{config.configFile}</Text>
                    <CopyButton value={JSON.stringify({ mcpServers: mcpInfo.endpoints }, null, 2)}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : `Copy ${config.configFile}`} withArrow>
                          <ActionIcon size="xs" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                  <Code block style={{ fontSize: 10, maxHeight: 160, overflow: 'auto' }}>
                    {JSON.stringify({ mcpServers: mcpInfo.endpoints }, null, 2)}
                  </Code>

                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text size="xs" c="dimmed">{assistant === 'claude' ? 'claude mcp add' : 'Launch in Development Path'}</Text>
                    <CopyButton value={assistant === 'claude'
                      ? Object.entries(mcpInfo.endpoints).map(([name, e]) => `claude mcp add --transport http ${name} ${e.url}`).join('\n')
                      : config.launchCommand}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : 'Copy commands'} withArrow>
                          <ActionIcon size="xs" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </Stack>
              )}
            </Stack>
          )}
        </Box>

        {/* Terminal Section - Right */}
        <Box style={{ flex: 1, height: 'calc(100vh - 252px)', display: 'flex', flexDirection: 'column', backgroundColor: '#1A1A1A' }}>
          <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
            {devPath && assistantState === 'ready' && (
              <Terminal key={reloadKey} ref={terminalRef} onReady={handleTerminalReady} visible={visible} fontSize={12} cwd={devPath} />
            )}
          </div>
        </Box>
      </Box>
    </Stack>
  );
};
