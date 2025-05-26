import { Project } from "../../types/Project";
import { TextInput, Group, Stack, Paper, Text, Box, ActionIcon, MultiSelect, Button } from '@mantine/core';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal, TerminalRef } from './Terminal';
import { IconX, IconChevronLeft, IconChevronRight, IconCamera, IconTextSize } from '@tabler/icons-react';

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
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [terminalFontSize, setTerminalFontSize] = useState(13);
  const hasShownAemOutputRef = useRef(false);
  const terminalRef = useRef<XTerm | null>(null);
  const terminalComponentRef = useRef<TerminalRef>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const healthCleanupRef = useRef<(() => void) | null>(null);

  // Helper function to format timestamp
  const formatTimestamp = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  useEffect(() => {
    
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (healthCleanupRef.current) {
        healthCleanupRef.current();
        healthCleanupRef.current = null;
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

  // Check if health checking is enabled for this instance
  useEffect(() => {
    const checkHealthCheckConfig = async () => {
      try {
        const settings = await window.electronAPI.getProjectSettings(project);
        const instanceSettings = settings[instance];
        const newHealthCheckEnabled = instanceSettings?.healthCheck || false;
        
        // If health checking was just enabled and instance is running, 
        // we might need to wait a moment for the backend to start health checking
        if (newHealthCheckEnabled && !healthCheckEnabled && isRunning) {
          console.log(`Health checking enabled for ${instance}, will start receiving updates`);
        }
        
        setHealthCheckEnabled(newHealthCheckEnabled);
      } catch (error) {
        console.error('Error checking health check configuration:', error);
        setHealthCheckEnabled(false);
      }
    };
    checkHealthCheckConfig();
    
    // Set up an interval to periodically check for configuration changes
    // This ensures we pick up changes made in the settings modal
    const configCheckInterval = setInterval(checkHealthCheckConfig, 2000);
    
    return () => {
      clearInterval(configCheckInterval);
    };
  }, [project, instance, healthCheckEnabled, isRunning]);

  // Listen for health status updates
  useEffect(() => {
    if (!healthCheckEnabled) return;

    const cleanup = window.electronAPI.onAemHealthStatus((data) => {
      if (data.projectId === project.id && data.instanceType === instance) {
        setHealthStatus(data.status);
        
        // Auto-update screenshot if available
        if (data.status.screenshotPath) {
          setLatestScreenshot(data.status.screenshotPath);
          setLastUpdateTime(new Date(data.status.timestamp));
          // Load the screenshot as data URL
          window.electronAPI.readScreenshot(data.status.screenshotPath)
            .then(dataUrl => {
              if (dataUrl) {
                setScreenshotDataUrl(dataUrl);
              }
            })
            .catch(error => {
              console.error('Error loading screenshot from health status:', error);
            });
        }
      }
    });

    // When health checking is first enabled, try to get existing health status
    const loadExistingHealthStatus = async () => {
      if (isRunning) {
        try {
          const existingStatus = await window.electronAPI.getHealthStatus(project, instance);
          if (existingStatus) {
            setHealthStatus(existingStatus);
            
            if (existingStatus.screenshotPath) {
              setLatestScreenshot(existingStatus.screenshotPath);
              setLastUpdateTime(new Date(existingStatus.timestamp));
              
              const dataUrl = await window.electronAPI.readScreenshot(existingStatus.screenshotPath);
              if (dataUrl) {
                setScreenshotDataUrl(dataUrl);
              }
            }
          }
        } catch (error) {
          console.error('Error loading existing health status:', error);
        }
      }
    };
    
    loadExistingHealthStatus();

    healthCleanupRef.current = cleanup;
    return cleanup;
  }, [project.id, instance, healthCheckEnabled, isRunning]);

  // Handle screenshot functionality
  const takeScreenshot = async () => {
    // Only allow manual screenshots when health checking is disabled
    if (healthCheckEnabled) {
      console.log('Manual screenshots disabled when health checking is enabled');
      return;
    }

    if (!isRunning) {
      console.warn('Cannot take screenshot: instance is not running');
      return;
    }

    setIsLoadingScreenshot(true);
    try {
      const screenshotPath = await window.electronAPI.takeAemScreenshot(project, instance);
      setLatestScreenshot(screenshotPath);
      setLastUpdateTime(new Date());
      
      // Load the screenshot as data URL
      if (screenshotPath) {
        const dataUrl = await window.electronAPI.readScreenshot(screenshotPath);
        setScreenshotDataUrl(dataUrl);
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
    } finally {
      setIsLoadingScreenshot(false);
    }
  };

  // Load latest screenshot on mount and when instance status changes
  useEffect(() => {
    const loadLatestScreenshot = async () => {
      // Only load manually when health checking is disabled
      if (healthCheckEnabled) return;
      
      if (isRunning) {
        try {
          const screenshotPath = await window.electronAPI.getLatestScreenshot(project, instance);
          setLatestScreenshot(screenshotPath);
          
          // Load the screenshot as data URL
          if (screenshotPath) {
            const dataUrl = await window.electronAPI.readScreenshot(screenshotPath);
            setScreenshotDataUrl(dataUrl);
            setLastUpdateTime(new Date()); // Set current time for existing screenshots
          } else {
            setScreenshotDataUrl(null);
            setLastUpdateTime(null);
          }
        } catch (error) {
          console.error('Error loading latest screenshot:', error);
        }
      } else {
        setLatestScreenshot(null);
        setScreenshotDataUrl(null);
      }
    };
    loadLatestScreenshot();
  }, [project, instance, isRunning, healthCheckEnabled]);

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
                {/* Clickable Screenshot Frame */}
                <Box
                  onClick={healthCheckEnabled ? undefined : takeScreenshot}
                  style={{
                    cursor: healthCheckEnabled ? 'default' : (isRunning ? 'pointer' : 'not-allowed'),
                    border: healthCheckEnabled ? '2px solid #4C6EF5' : '2px dashed #2C2E33',
                    borderRadius: '8px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: screenshotDataUrl ? 'transparent' : '#1A1A1A',
                    transition: 'border-color 0.2s ease',
                    opacity: isRunning ? 1 : 0.5,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (!healthCheckEnabled && isRunning) {
                      e.currentTarget.style.borderColor = '#4C6EF5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!healthCheckEnabled) {
                      e.currentTarget.style.borderColor = '#2C2E33';
                    }
                  }}
                >
                  {screenshotDataUrl ? (
                    <>
                      <img 
                        src={screenshotDataUrl}
                        alt={`${instance} screenshot`}
                        style={{ 
                          width: '100%', 
                          height: 'auto',
                          borderRadius: '6px',
                          display: 'block'
                        }}
                      />
                      {/* Health status indicator */}
                      {healthCheckEnabled && healthStatus && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            backgroundColor: healthStatus.status === 'healthy' ? '#51cf66' : '#ff6b6b',
                            borderRadius: '50%',
                            width: '12px',
                            height: '12px',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        />
                      )}
                      {/* Overlay for click indication - only when health checking is disabled */}
                      {!healthCheckEnabled && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease',
                            borderRadius: '6px'
                          }}
                          onMouseEnter={(e) => {
                            if (isRunning) {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0)';
                          }}
                        >
                          {isRunning && (
                            <ActionIcon
                              variant="filled"
                              size="lg"
                              style={{
                                opacity: 0,
                                transition: 'opacity 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '0';
                              }}
                            >
                              <IconCamera size={20} />
                            </ActionIcon>
                          )}
                        </Box>
                      )}
                    </>
                  ) : (
                    <Stack align="center" gap="xs">
                      {isLoadingScreenshot ? (
                        <>
                          <ActionIcon variant="subtle" size="xl" loading>
                            <IconCamera size={24} />
                          </ActionIcon>
                          <Text size="xs" c="dimmed">
                            Taking screenshot...
                          </Text>
                        </>
                      ) : isRunning ? (
                        <>
                          <IconCamera size={32} color="#666" />
                          <Text size="xs" c="dimmed" ta="center">
                            {healthCheckEnabled 
                              ? 'Waiting for health check...' 
                              : 'Click to take screenshot'
                            }
                          </Text>
                          {healthCheckEnabled && (
                            <Text size="xs" c="blue" ta="center">
                              Auto-updating enabled
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          <IconCamera size={32} color="#444" />
                          <Text size="xs" c="dimmed" ta="center">
                            Instance not running
                          </Text>
                        </>
                      )}
                    </Stack>
                  )}
                </Box>
                
                {/* Timestamp display */}
                {lastUpdateTime && (
                  <Text size="xs" c="dimmed" ta="center">
                    Last updated: {formatTimestamp(lastUpdateTime)}
                  </Text>
                )}
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