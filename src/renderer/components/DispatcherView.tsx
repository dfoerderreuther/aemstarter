import { Project } from "../../types/Project";
import { TextInput, Group, Stack, Paper, Text, Box, ActionIcon, Button } from '@mantine/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal, TerminalRef } from './Terminal';
import { IconX, IconChevronLeft, IconChevronRight, IconTextSize, IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons-react';

interface DispatcherViewProps {
  project: Project;
  visible?: boolean;
}

export const DispatcherView = ({ project, visible = true }: DispatcherViewProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [terminalFontSize, setTerminalFontSize] = useState(9);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const hasShownDispatcherOutputRef = useRef(false);
  const terminalRef = useRef<XTerm | null>(null);
  const terminalComponentRef = useRef<TerminalRef>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  // Reset hasShownDispatcherOutput when dispatcher is stopped
  useEffect(() => {
    if (!isRunning) {
      hasShownDispatcherOutputRef.current = false;
    }
  }, [isRunning]);

  // Check dispatcher status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await window.electronAPI.getDispatcherStatus(project);
        setIsRunning(status.isRunning);
      } catch (error) {
        console.error('Error checking dispatcher status:', error);
      }
    };
    checkStatus();
  }, [project]);

  // Listen for dispatcher status updates
  useEffect(() => {
    const cleanup = window.electronAPI.onDispatcherStatus((data) => {
      console.log(`[DispatcherView] Received status update:`, data);
      if (data.projectId === project.id) {
        console.log(`[DispatcherView] Updating status for project ${project.id}: isRunning=${data.isRunning}`);
        setIsRunning(data.isRunning);
        setIsStarting(false);
        setIsStopping(false);
      } else {
        console.log(`[DispatcherView] Ignoring status update for different project: ${data.projectId} (current: ${project.id})`);
      }
    });

    return cleanup;
  }, [project.id]);

  // Helper function to highlight filtered text with red background
  const highlightFilteredText = (text: string, filter: string): string => {
    if (!filter) return text;
    
    // ANSI escape codes for red background and reset
    const redBg = '\x1b[41m';    // Basic red background
    const reset = '\x1b[0m';     // Reset formatting
    
    // Case-insensitive replacement
    const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, `${redBg}$1${reset}`);
  };

  // Create log data handler with proper dependency tracking
  const handleLogData = useCallback((data: { projectId: string; data: string }) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Only process logs for this specific project
    if (data.projectId === project.id) {
      // Apply filter if filterText is set
      if (filterText && !data.data.toLowerCase().includes(filterText.toLowerCase())) {
        return; // Skip this log entry if it doesn't contain the filter text
      }

      // Clear terminal and show header when we get first dispatcher output
      if (!hasShownDispatcherOutputRef.current) {
        terminal.clear();
        terminal.writeln(`Dispatcher - Live Log Stream:`);
        if (filterText) {
          terminal.writeln(`Filter: "${filterText}"`);
        }
        terminal.writeln('----------------------------');
        hasShownDispatcherOutputRef.current = true;
      }

      // Write the log line with highlighting
      const highlightedText = highlightFilteredText(data.data, filterText);
      terminal.writeln(highlightedText);
      
      // Auto-scroll to bottom to show latest logs
      terminal.scrollToBottom();
    }
  }, [project.id, filterText]);

  // Set up log data listener with proper cleanup and updates
  useEffect(() => {
    if (!terminalRef.current) return;

    // Clean up any existing listener
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Set up new listener with current handleLogData
    const cleanup = window.electronAPI.onDispatcherLogData(handleLogData);
    cleanupRef.current = cleanup;

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [handleLogData]);

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal;
    terminal.writeln(`Dispatcher - Log Monitor`);
  };

  // Handle text size toggle (cycles through 9, 11, 13, 16)
  const handleToggleTextSize = () => {
    const sizes = [9, 11, 13, 16];
    const currentIndex = sizes.indexOf(terminalFontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setTerminalFontSize(sizes[nextIndex]);
  };

  // Handle collapse/expand with terminal resize
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    
    // Trigger terminal resize after CSS transition completes
    setTimeout(() => {
      if (terminalComponentRef.current) {
        terminalComponentRef.current.resize();
      }
    }, 350); // Slightly longer than the 300ms CSS transition
  };

  // Handle start dispatcher
  const handleStartDispatcher = async () => {
    setIsStarting(true);
    try {
      await window.electronAPI.startDispatcher(project);
    } catch (error) {
      console.error('Error starting dispatcher:', error);
      setIsStarting(false);
    }
  };

  // Handle stop dispatcher
  const handleStopDispatcher = async () => {
    setIsStopping(true);
    try {
      await window.electronAPI.stopDispatcher(project);
    } catch (error) {
      console.error('Error stopping dispatcher:', error);
      setIsStopping(false);
    }
  };

  // Handle flush dispatcher
  const handleFlushDispatcher = async () => {
    try {
      await window.electronAPI.flushDispatcher(project);
    } catch (error) {
      console.error('Error flushing dispatcher:', error);
    }
  };

  return (
    <>
      <Stack gap="0" style={{ height: '100%' }}>
        <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
          <Group justify="space-between" align="center">
            <Text size="xs" fw={700} c="dimmed">
              DISPATCHER
            </Text>
            <Group gap="xs" align="center">
                <TextInput
                  placeholder="Filter logs..."
                  value={filterText}
                  onChange={(event) => setFilterText(event.currentTarget.value)}
                  size="xs"
                  style={{ width: '200px' }}
                  rightSection={
                    filterText ? (
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={() => setFilterText('')}
                        style={{ cursor: 'pointer' }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    ) : null
                  }
                />
                <Button size="xs" onClick={handleToggleTextSize} title={`Font size: ${terminalFontSize}px`} variant="outline"
                leftSection={<IconTextSize size={12} />}>
                  {terminalFontSize}
                </Button>
            </Group>
          </Group>
        </Box>

        {/* Main content area with collapsible sidebar */}
        <Box style={{ 
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* Collapsible Left Column */}
          <Box style={{
            width: isCollapsed ? '20px' : '200px',
            transition: 'width 0.3s ease',
            borderRight: '1px solid #2C2E33',
            backgroundColor: '#1E1E1E',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Collapse/Expand Button */}
            <Box>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleToggleCollapse}
                style={{ width: '100%' }}
              >
                {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
              </ActionIcon>
            </Box>

            {/* Column Content */}
            {!isCollapsed && (
              <Stack gap="sm" p="sm" style={{ flex: 1, overflow: 'auto' }}>
                {/* Dispatcher Controls */}
                <Paper p="sm" style={{ backgroundColor: '#2C2E33' }}>
                  <Stack gap="xs">
                    <Text size="xs" fw={500} c="dimmed">Controls</Text>
                    
                    <Button
                      size="xs"
                      color="green"
                      leftSection={<IconPlayerPlay size={12} />}
                      onClick={handleStartDispatcher}
                      disabled={isRunning || isStarting || isStopping}
                      loading={isStarting}
                      style={{ width: '100%' }}
                    >
                      Start
                    </Button>
                    
                    <Button
                      size="xs"
                      color="red"
                      leftSection={<IconPlayerStop size={12} />}
                      onClick={handleStopDispatcher}
                      disabled={!isRunning || isStarting || isStopping}
                      loading={isStopping}
                      style={{ width: '100%' }}
                    >
                      Stop
                    </Button>
                    
                    <Button
                      size="xs"
                      color="blue"
                      variant="outline"
                      leftSection={<IconRefresh size={12} />}
                      onClick={handleFlushDispatcher}
                      disabled={!isRunning || isStarting || isStopping}
                      style={{ width: '100%' }}
                    >
                      Flush Cache
                    </Button>
                  </Stack>
                </Paper>

                {/* Status */}
                <Paper p="sm" style={{ backgroundColor: '#2C2E33' }}>
                  <Stack gap="xs">
                    <Text size="xs" fw={500} c="dimmed">Status</Text>
                    <Text size="xs" c={isRunning ? 'green' : 'red'}>
                      {isRunning ? 'Running' : 'Stopped'}
                    </Text>
                  </Stack>
                </Paper>
              </Stack>
            )}
          </Box>

          {/* Terminal Section */}
          <Paper shadow="xs" p="sm" style={{ 
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column', 
            backgroundColor: '#1A1A1A',
            borderRadius: 0
          }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Terminal onReady={handleTerminalReady} visible={visible} fontSize={terminalFontSize} ref={terminalComponentRef} />
            </div>
          </Paper>
        </Box>
      </Stack>
    </>
  );
};