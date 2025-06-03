import { Project } from "../../types/Project";
import { TextInput, Group, Stack, Paper, Text, Box, ActionIcon, Select, Menu, Button } from '@mantine/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal, TerminalRef } from './Terminal';
import { Screenshot } from './Screenshot';
import { OakRunMenu } from './OakRunMenu';
import { PackageMenu } from './PackageMenu';
import { IconX, IconChevronLeft, IconChevronRight, IconTextSize, IconEraser, IconExternalLink } from '@tabler/icons-react';
import { SettingsMenu } from "./SettingsMenu";
import { LogFileSelector } from './LogFileSelector';

interface AemInstanceViewProps {
  instance: 'author' | 'publisher';
  project: Project;
  visible?: boolean;
  viewMode?: 'tabs' | 'columns';
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AemInstanceView = ({ 
  instance, 
  project, 
  visible = true, 
  viewMode = 'tabs',
  isCollapsed = false,
  onToggleCollapse = () => {}
}: AemInstanceViewProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [availableLogFiles, setAvailableLogFiles] = useState<string[]>(['error.log']);
  const [selectedLogFiles, setSelectedLogFiles] = useState<string[]>(['error.log']);
  const [filterText, setFilterText] = useState('');
  const [projectSettings, setProjectSettings] = useState<any>(null);

  const [terminalFontSize, setTerminalFontSize] = useState(9);
  const hasShownAemOutputRef = useRef(false);
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

  // Load project settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.getProjectSettings(project);
        setProjectSettings(settings);
      } catch (error) {
        console.error('Error loading project settings:', error);
      }
    };
    loadSettings();
  }, [project]);

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

  // Browser navigation functions
  const handleOpenAem = async () => {
    if (!projectSettings) return;
    const port = projectSettings[instance]?.port || (instance === 'author' ? 4502 : 4503);
    try {
      await window.electronAPI.openUrl(`http://localhost:${port}`);
    } catch (error) {
      console.error('Error opening AEM URL:', error);
    }
  };

  const handleOpenCrxDe = async () => {
    if (!projectSettings) return;
    const port = projectSettings[instance]?.port || (instance === 'author' ? 4502 : 4503);
    try {
      await window.electronAPI.openUrl(`http://localhost:${port}/crx/de`);
    } catch (error) {
      console.error('Error opening CRX/DE URL:', error);
    }
  };

  const handleOpenConsole = async () => {
    if (!projectSettings) return;
    const port = projectSettings[instance]?.port || (instance === 'author' ? 4502 : 4503);
    try {
      await window.electronAPI.openUrl(`http://localhost:${port}/system/console`);
    } catch (error) {
      console.error('Error opening Console URL:', error);
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
      hasShownAemOutputRef.current = false;
    }
  };

  return (
    <>
      <Stack gap="0" style={{ height: '100%' }}>
        <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
          <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
            <Text size="xs" fw={700} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {instance.toUpperCase()} INSTANCE 
            </Text>
            <Box style={{ flex: 1 }} />
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
            <LogFileSelector
              availableFiles={availableLogFiles}
              selectedFiles={selectedLogFiles}
              onChange={handleLogFileChange}
              onFocus={handleInputFocus}
              size="xs"
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
            width: viewMode === 'columns' ? '100%' : (isCollapsed ? '40px' : '160px'),
            height: viewMode === 'columns' ? (isCollapsed ? '40px' : '160px') : '100%',
            transition: viewMode === 'columns' ? 'height 0.3s ease' : 'width 0.3s ease',
            borderRight: viewMode === 'columns' ? 'none' : '1px solid #2C2E33',
            borderBottom: viewMode === 'columns' ? '1px solid #2C2E33' : 'none',
            backgroundColor: '#1E1E1E',
            display: 'flex',
            flexDirection: viewMode === 'columns' ? 'column' : 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Collapse/Expand Button - Integrated */}
            <Box style={{
              position: 'absolute',
              top: viewMode === 'columns' ? '8px' : '50%',
              right: viewMode === 'columns' ? '8px' : '8px',
              transform: viewMode === 'columns' ? 'none' : 'translateY(-50%)',
              zIndex: 10
            }}>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={onToggleCollapse}
                style={{ 
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px'
                }}
              >
                {viewMode === 'columns' ? 
                  (isCollapsed ? 
                    <IconChevronRight style={{ transform: 'rotate(90deg)' }} size={14} /> : 
                    <IconChevronLeft style={{ transform: 'rotate(90deg)' }} size={14} />
                  ) :
                  (isCollapsed ? 
                    <IconChevronRight size={14} /> : 
                    <IconChevronLeft size={14} />
                  )
                }
              </ActionIcon>
            </Box>

            {/* Column Content */}
            {!isCollapsed && (
              <Box p="sm" style={{ 
                flex: 1, 
                overflow: 'auto',
                display: 'flex',
                flexDirection: viewMode === 'columns' ? 'row' : 'column',
                gap: '12px',
                alignItems: viewMode === 'columns' ? 'flex-start' : 'stretch'
              }}>
                {/* Screenshot Block */}
                <Box style={{ 
                  width: '150px',
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start'
                }}>
                  <Screenshot
                    project={project}
                    instance={instance}
                    isRunning={isRunning}
                  />
                </Box>

                {/* Links Block */}
                <Box style={{ 
                  width: '120px',
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  borderLeft: viewMode === 'columns' ? '1px dashed rgba(255,255,255,0.2)' : 'none',
                  borderTop: viewMode === 'columns' ? 'none' : '1px dashed rgba(255,255,255,0.2)',
                  paddingLeft: viewMode === 'columns' ? '12px' : '0',
                  paddingTop: viewMode === 'columns' ? '0' : '12px'
                }}>
                  <Stack gap="xs" style={{ width: '100%', alignItems: 'flex-start' }}>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={handleOpenAem}
                      disabled={!isRunning}
                      leftSection={<IconExternalLink size={12} />}
                      style={{ 
                        justifyContent: 'flex-start',
                        padding: '4px 8px',
                        height: 'auto',
                        fontWeight: 400
                      }}
                      styles={{
                        root: {
                          '&:focus': { outline: 'none', boxShadow: 'none' },
                          '&:focus-visible': { outline: '1px solid rgba(255,255,255,0.3)' }
                        }
                      }}
                    >
                      AEM
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={handleOpenCrxDe}
                      disabled={!isRunning}
                      leftSection={<IconExternalLink size={12} />}
                      style={{ 
                        justifyContent: 'flex-start',
                        padding: '4px 8px',
                        height: 'auto',
                        fontWeight: 400
                      }}
                      styles={{
                        root: {
                          '&:focus': { outline: 'none', boxShadow: 'none' },
                          '&:focus-visible': { outline: '1px solid rgba(255,255,255,0.3)' }
                        }
                      }}
                    >
                      CRX/DE
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={handleOpenConsole}
                      disabled={!isRunning}
                      leftSection={<IconExternalLink size={12} />}
                      style={{ 
                        justifyContent: 'flex-start',
                        padding: '4px 8px',
                        height: 'auto',
                        fontWeight: 400
                      }}
                      styles={{
                        root: {
                          '&:focus': { outline: 'none', boxShadow: 'none' },
                          '&:focus-visible': { outline: '1px solid rgba(255,255,255,0.3)' }
                        }
                      }}
                    >
                      Console
                    </Button>
                  </Stack>
                </Box>

                {/* Menus Block */}
                <Box style={{ 
                  width: '120px',
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  borderLeft: viewMode === 'columns' ? '1px dashed rgba(255,255,255,0.2)' : 'none',
                  borderTop: viewMode === 'columns' ? 'none' : '1px dashed rgba(255,255,255,0.2)',
                  paddingLeft: viewMode === 'columns' ? '12px' : '0',
                  paddingTop: viewMode === 'columns' ? '0' : '12px'
                }}>
                  <Stack gap="xs" style={{ alignItems: 'flex-start' }}>
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
                </Box>
              </Box>
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