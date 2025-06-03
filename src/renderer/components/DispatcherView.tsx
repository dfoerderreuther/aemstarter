import { Project } from "../../types/Project";
import { TextInput, Group, Stack, Paper, Text, Box, ActionIcon, Select } from '@mantine/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal, TerminalRef } from './Terminal';
import { IconX, IconChevronLeft, IconChevronRight, IconTextSize, IconEraser } from '@tabler/icons-react';
import { Screenshot } from "./Screenshot";

interface DispatcherViewProps {
  project: Project;
  visible?: boolean;
  viewMode?: 'tabs' | 'columns';
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DispatcherView = ({ 
  project, 
  visible = true, 
  viewMode = 'tabs',
  isCollapsed = false,
  onToggleCollapse = () => {}
}: DispatcherViewProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [terminalFontSize, setTerminalFontSize] = useState(9);

  const hasShownDispatcherOutputRef = useRef(false);
  const terminalRef = useRef<XTerm | null>(null);
  const terminalComponentRef = useRef<TerminalRef>(null);
  const cleanupRef = useRef<(() => void) | null>(null);


  // Resize terminal after collapse state changes (CSS transition completes)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (terminalComponentRef.current) {
        terminalComponentRef.current.resize();
      }
    }, 350); // Slightly longer than the 300ms CSS transition

    return () => clearTimeout(timer);
  }, [isCollapsed]);

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
      if (data.projectId === project.id) {
        setIsRunning(data.isRunning);

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

  // Handle text size change from dropdown
  const handleFontSizeChange = (value: string | null) => {
    if (value) {
      setTerminalFontSize(parseInt(value));
    }
  };

  // Handle clear terminal
  const handleClearTerminal = () => {
    if (terminalRef.current) {
      terminalRef.current.clear();
      hasShownDispatcherOutputRef.current = false;
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
                  style={{ width: viewMode === 'columns' ? '150px' : '200px' }}
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
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={handleClearTerminal}
                  title="Clear terminal"
                  style={{ cursor: 'pointer' }}
                >
                  <IconEraser size={14} />
                </ActionIcon>
                <Select
                  size="xs"
                  value={terminalFontSize.toString()}
                  onChange={handleFontSizeChange}
                  data={[
                    { value: '9', label: '9px' },
                    { value: '11', label: '11px' },
                    { value: '13', label: '13px' },
                    { value: '16', label: '16px' }
                  ]}
                  style={{ width: '32px' }}
                  variant="subtle"
                  comboboxProps={{ withinPortal: true, width: 80 }}
                  leftSection={<IconTextSize size={14} />}
                  styles={{
                    input: {
                      cursor: 'pointer',
                      caretColor: 'transparent',
                      color: 'transparent',
                      padding: '0 8px',
                      textAlign: 'center'
                    },
                    section: {
                      pointerEvents: 'none'
                    },
                    dropdown: {
                      minWidth: '80px'
                    }
                  }}
                />
            </Group>
          </Group>
        </Box>

        {/* Main content area with collapsible sidebar */}
        <Box style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: viewMode === 'columns' ? 'column' : 'row',
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* Collapsible Column - Left in tabs mode, Top in columns mode */}
          <Box style={{
            width: viewMode === 'columns' ? '100%' : (isCollapsed ? '20px' : '200px'),
            height: viewMode === 'columns' ? (isCollapsed ? '30px' : '200px') : '100%',
            transition: viewMode === 'columns' ? 'height 0.3s ease' : 'width 0.3s ease',
            borderRight: viewMode === 'columns' ? 'none' : '1px solid #2C2E33',
            borderBottom: viewMode === 'columns' ? '1px solid #2C2E33' : 'none',
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
                onClick={onToggleCollapse}
                style={{ width: '100%' }}
              >
                {viewMode === 'columns' ? 
                  (isCollapsed ? <IconChevronRight style={{ transform: 'rotate(90deg)' }} size={16} /> : <IconChevronLeft style={{ transform: 'rotate(90deg)' }} size={16} />) :
                  (isCollapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />)
                }
              </ActionIcon>
            </Box>

            {/* Column Content */}
            {!isCollapsed && (
              <Stack gap="sm" p="sm" style={{ 
                flex: 1, 
                overflow: 'auto',
                display: 'flex',
                flexDirection: viewMode === 'columns' ? 'row' : 'column'
              }}>
                <Box style={{ 
                  width: '175px',
                  height: '140px',
                  flex: 'none',
                  alignSelf: 'center'
                }}>
                  <Screenshot project={project} instance="dispatcher" isRunning={isRunning} />
                </Box>
                
                {/* Future menu items can be added here in a Stack */}
                <Stack gap="sm" style={{ 
                  flex: 'none',
                  width: '175px',
                  minWidth: 0
                }}>
                  {/* Additional dispatcher-specific menus can be added here */}
                </Stack>
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