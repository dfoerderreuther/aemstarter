import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Stack, Group, Text, Button, Anchor, Loader, ActionIcon, Code, CopyButton, Tooltip, HoverCard } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconCopy, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { Terminal, TerminalRef } from './Terminal';
import { Project } from '../../types/Project';

interface McpInfo {
  port: number;
  url: string;
  endpoints: Record<string, { type: string; url: string }>;
}

type McpTargetKey = 'author' | 'publisher' | 'dispatcher' | 'starter';

// Example prompts shown in the (i) popover for each MCP connection. Just mention
// the connection by name in the Claude prompt — no slash syntax for tools.
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

interface ClaudeCodeTabProps {
  project: Project;
  visible?: boolean;
  onProjectUpdated?: (updatedProject: Project) => void;
}

const CLAUDE_INSTALL_URL = 'https://docs.claude.com/en/docs/claude-code/setup';

// Launch Claude in auto permission mode so MCP-driven steering runs without
// per-action prompts.
const CLAUDE_LAUNCH_CMD = 'claude --permission-mode auto';

type ClaudeState = 'checking' | 'missing' | 'ready';

export const ClaudeCodeTab = ({ project, visible = true }: ClaudeCodeTabProps) => {
  const [claudeState, setClaudeState] = useState<ClaudeState>('checking');
  const [claudeVersion, setClaudeVersion] = useState<string | undefined>();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activated, setActivated] = useState(false);
  const [mcpInfo, setMcpInfo] = useState<McpInfo | null>(null);

  const terminalRef = useRef<TerminalRef>(null);
  const launchedRef = useRef(false);
  const devPath = project.settings.dev?.path || '';

  // Only spin up the terminal / MCP setup once the tab has actually been shown.
  useEffect(() => {
    if (visible) setActivated(true);
  }, [visible]);

  useEffect(() => {
    if (visible) setIsCollapsed(false);
  }, [visible]);

  // Preflight + MCP scaffolding when the tab is first activated. All four MCP
  // connections are always enabled — the server writes them all into .mcp.json.
  useEffect(() => {
    if (!activated) return;
    let cancelled = false;
    (async () => {
      try {
        const availability = await window.electronAPI.checkClaudeCode();
        if (cancelled) return;
        setClaudeVersion(availability.version);
        if (!availability.available) {
          setClaudeState('missing');
          return;
        }
        const result = await window.electronAPI.setupClaudeCodeMcp(project);
        if (cancelled) return;
        setMcpInfo(result);
        setClaudeState('ready');
      } catch (error) {
        console.error('Failed to initialize Claude Code:', error);
        if (!cancelled) setClaudeState('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [activated]);

  const handleTerminalReady = useCallback(() => {
    // Auto-launch the Claude Code CLI once, in the dev path where .mcp.json lives.
    if (launchedRef.current) return;
    launchedRef.current = true;
    setTimeout(() => {
      terminalRef.current?.writeToShell(`${CLAUDE_LAUNCH_CMD}\n`);
      terminalRef.current?.focus();
    }, 400);
  }, []);

  if (claudeState === 'missing') {
    return (
      <Stack gap="md" p="xl" align="center" justify="center" style={{ height: 'calc(100vh - 146px)' }}>
        <Text fw={700} size="lg">Claude Code CLI not found</Text>
        <Text c="dimmed" ta="center" maw={520}>
          The Claude Code integration launches the <code>claude</code> command in a terminal.
          Install the Claude Code CLI, then reopen this tab.
        </Text>
        <Button
          rightSection={<IconExternalLink size={16} />}
          onClick={() => window.electronAPI.openUrl(CLAUDE_INSTALL_URL)}
        >
          Install Claude Code
        </Button>
        <Anchor size="xs" c="dimmed" onClick={() => window.electronAPI.openUrl(CLAUDE_INSTALL_URL)}>
          {CLAUDE_INSTALL_URL}
        </Anchor>
      </Stack>
    );
  }

  return (
    <Stack gap="0" style={{ height: 'calc(100vh - 146px)' }}>
      <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
        <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
          <Text size="xs" fw={700} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            CLAUDE CODE{claudeVersion ? ` — ${claudeVersion}` : ''}
          </Text>
          <Box style={{ flex: 1 }} />
        </Group>
      </Box>

      <Box style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
        {/* Big column: Claude Code terminal */}
        <Box style={{ flex: 1, height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', backgroundColor: '#1A1A1A' }}>
          <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
            {activated && claudeState === 'ready' && devPath ? (
              <Terminal ref={terminalRef} onReady={handleTerminalReady} visible={visible} fontSize={12} cwd={devPath} />
            ) : (
              <Group justify="center" align="center" style={{ height: '100%' }}>
                <Loader size="sm" />
                <Text c="dimmed" size="sm">Preparing MCP connections…</Text>
              </Group>
            )}
          </div>
        </Box>

        {/* Thin column: MCP server config */}
        <Box style={{
          width: isCollapsed ? '40px' : '280px',
          transition: 'width 0.3s ease',
          borderLeft: '1px solid #2C2E33',
          backgroundColor: '#1E1E1E',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <Box style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setIsCollapsed((c) => !c)}
              style={{ backgroundColor: 'rgba(58,58,58,1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
            >
              {isCollapsed ? <IconChevronLeft size={14} /> : <IconChevronRight size={14} />}
            </ActionIcon>
          </Box>

          {!isCollapsed && (
            <Stack gap="sm" p="md" pt={44}>
              <Text size="xs" fw={700} c="dimmed">MCP CONNECTIONS</Text>
              {MCP_CONNECTIONS.map((conn) => (
                <Group key={conn.key} gap={6} wrap="nowrap" align="center">
                  <Text size="xs" style={{ flex: 1 }}>{conn.label}</Text>
                  <HoverCard width={450} shadow="md" withArrow position="left" openDelay={100}>
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
                    In-app MCP server (loopback). Connect another Claude session with the config below.
                  </Text>

                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text size="xs" c="dimmed">.mcp.json</Text>
                    <CopyButton value={JSON.stringify({ mcpServers: mcpInfo.endpoints }, null, 2)}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : 'Copy .mcp.json'} withArrow>
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
                    <Text size="xs" c="dimmed">claude mcp add</Text>
                    <CopyButton value={Object.entries(mcpInfo.endpoints).map(([name, e]) => `claude mcp add --transport http ${name} ${e.url}`).join('\n')}>
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
      </Box>
    </Stack>
  );
};
