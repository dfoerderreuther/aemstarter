import { Project } from "../../types/Project";
import { TextInput, Group, Stack, Paper, Text, Box, ActionIcon, MultiSelect, Button } from '@mantine/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal, TerminalRef } from './Terminal';
import { Screenshot } from './Screenshot';
import { OakRunMenu } from './OakRunMenu';
import { PackageMenu } from './PackageMenu';
import { IconX, IconChevronLeft, IconChevronRight, IconTextSize } from '@tabler/icons-react';
import { SettingsMenu } from "./SettingsMenu";

interface AemInstanceViewProps {
  instance: 'author' | 'publisher';
  project: Project;
  visible?: boolean;
}

export const AemInstanceView = ({ instance, project, visible = true }: AemInstanceViewProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [availableLogFiles, setAvailableLogFiles] = useState<string[]>(['error.log']);
  const [selectedLogFiles, setSelectedLogFiles] = useState<string[]>(['error.log']);
  const [filterText, setFilterText] = useState('');

  const [terminalFontSize, setTerminalFontSize] = useState(9);
  const hasShownAemOutputRef = useRef(false);
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
  }, [])

  // Reset hasShownAemOutput when instance is stopped
  useEffect(() => {
    if (!isRunning) {
      hasShownAemOutputRef.current = false;
    }
  }, [isRunning]);

  // Check instance status on mount and load available log files
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const running = await window.electronAPI.isAemInstanceRunning(project, instance);
        setIsRunning(running);
        
        // Load available log files
        const logFiles = await window.electronAPI.getAvailableLogFiles(project, instance);
        setAvailableLogFiles(logFiles);
        
        // Load previously selected log files
        const selectedFiles = await window.electronAPI.getSelectedLogFiles(project, instance);
        setSelectedLogFiles(selectedFiles);
      } catch (error) {
        console.error('Error checking instance status:', error);
      }
    };
    checkStatus();
  }, [project, instance]);

  useEffect(() => {
    const cleanup = window.electronAPI.onAemPidStatus((data) => {
      if (data.projectId === project.id && data.instanceType === instance) {
        setIsRunning(data.isRunning);
      }
    });

    return cleanup;
  }, [project.id, instance]);

  // Handle log file selection changes
  const handleLogFileChange = async (newSelectedFiles: string[]) => {
    setSelectedLogFiles(newSelectedFiles);
    
    try {
      await window.electronAPI.updateLogFiles(project, instance, newSelectedFiles);
    } catch (error) {
      console.error('Error updating log files:', error);
    }
  };

  // Refresh available log files when dropdown opens
  const handleInputFocus = async () => {
    try {
      const logFiles = await window.electronAPI.getAvailableLogFiles(project, instance);
      setAvailableLogFiles(logFiles);
    } catch (error) {
      console.error('Error refreshing log files:', error);
    }
  };

  // Helper function to highlight filtered text with red background
  const highlightFilteredText = (text: string, filter: string): string => {
    if (!filter) return text;
    
    // ANSI escape codes for red background and reset
    // Using the most basic ANSI codes
    const redBg = '\x1b[41m';    // Basic red background
    const reset = '\x1b[0m';     // Reset formatting
    
    // Case-insensitive replacement
    const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, `${redBg}$1${reset}`);
  };

  // Create log data handler with proper dependency tracking
  const handleLogData = useCallback((data: { projectId: string; instanceType: string; data: string }) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Only process logs for this specific project and instance
    if (data.projectId === project.id && data.instanceType === instance) {
      // Apply filter if filterText is set
      if (filterText && !data.data.toLowerCase().includes(filterText.toLowerCase())) {
        return; // Skip this log entry if it doesn't contain the filter text
      }

      // Clear terminal and show header when we get first AEM output
      if (!hasShownAemOutputRef.current) {
        terminal.clear();
        terminal.writeln(`AEM ${instance} instance - Live Log Stream:`);
        if (filterText) {
          terminal.writeln(`Filter: "${filterText}"`);
        }
        terminal.writeln('----------------------------');
        hasShownAemOutputRef.current = true;
      }

      // Write the log line with highlighting
      const highlightedText = highlightFilteredText(data.data, filterText);
      terminal.writeln(highlightedText);
      
      // Auto-scroll to bottom to show latest logs
      terminal.scrollToBottom();
    }
  }, [project.id, instance, filterText]);

  // Set up log data listener with proper cleanup and updates
  useEffect(() => {
    if (!terminalRef.current) return;

    // Clean up any existing listener
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Set up new listener with current handleLogData
    const cleanup = window.electronAPI.onAemLogData(handleLogData);
    cleanupRef.current = cleanup;

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [handleLogData]);

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal;
    terminal.writeln(`AEM ${instance} instance - Log Monitor`);
  };

  // Handle text size toggle (cycles through 11, 13, 16)
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

  return (
    <>
      <Stack gap="0" style={{ height: '100%' }}>
        <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
          <Group justify="space-between" align="center">
            <Text size="xs" fw={700} c="dimmed">
              {instance.toUpperCase()} INSTANCE 
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
                <MultiSelect
                  placeholder="Select log files to monitor"
                  data={availableLogFiles}
                  value={selectedLogFiles}
                  onChange={handleLogFileChange}
                  size="xs"
                  searchable
                  clearable
                  maxDropdownHeight={200}
                  onFocus={handleInputFocus}
                  style={{ width: '400px' }}
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
                <Screenshot
                  project={project}
                  instance={instance}
                  isRunning={isRunning}
                />

                <PackageMenu
                  project={project}
                  instance={instance}
                  isRunning={isRunning}
                />




                <OakRunMenu
                  project={project}
                  instance={instance}
                  isRunning={isRunning}
                  onLogFileSwitch={handleLogFileChange}
                />
                <SettingsMenu 
                  project={project}
                  instance={instance}
                  isRunning={isRunning}
                />
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