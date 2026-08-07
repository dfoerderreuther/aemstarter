import { useState, useRef, useEffect } from 'react';
import { Box, Stack, Group, Text, Button, Anchor, ActionIcon, Code, CopyButton, Tooltip, HoverCard } from '@mantine/core';
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
  const [mcpInfo, setMcpInfo] = useState<McpInfo | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);

  const terminalRef = useRef<TerminalRef>(null);
  const launchedRef = useRef(false);
  const devPath = project.settings.dev?.path || '';

  // Show the collapsible panel when the tab is revealed.
  useEffect(() => {
    if (visible) setIsCollapsed(false);
  }, [visible]);

  // Resize the terminal after the collapse transition completes (same as the
  // Dev terminal — the CSS transition is 300ms).
  useEffect(() => {
    const timer = setTimeout(() => terminalRef.current?.resize(), 350);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  // Preflight (is `claude` installed?) + write .mcp.json with all four MCP
  // connections. Runs once the tab is mounted.
  useEffect(() => {
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
  }, []);

  const handleTerminalReady = () => {
    setTerminalReady(true);
  };

  // Auto-launch the Claude CLI once, but only after the terminal is live AND
  // .mcp.json has been written, so the new session picks up the MCP servers.
  useEffect(() => {
    if (launchedRef.current || !terminalReady || !mcpInfo) return;
    launchedRef.current = true;
    setTimeout(() => {
      terminalRef.current?.resize();
      terminalRef.current?.writeToShell(`${CLAUDE_LAUNCH_CMD}\n`);
      terminalRef.current?.focus();
    }, 400);
  }, [terminalReady, mcpInfo]);

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

      {/* Main content area with collapsible sidebar — mirrors the Dev terminal:
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

        {/* Terminal Section - Right */}
        <Box style={{ flex: 1, height: 'calc(100vh - 252px)', display: 'flex', flexDirection: 'column', backgroundColor: '#1A1A1A' }}>
          <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
            {devPath && (
              <Terminal ref={terminalRef} onReady={handleTerminalReady} visible={visible} fontSize={12} cwd={devPath} />
            )}
          </div>
        </Box>
      </Box>
    </Stack>
  );
};
