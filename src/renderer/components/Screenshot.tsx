import { Box, Stack, Text, ActionIcon } from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { useState, useEffect, useRef } from 'react';

interface ScreenshotProps {
  project: Project;
  instance: 'author' | 'publisher' | 'dispatcher';
  isRunning: boolean;
}

export const Screenshot = ({
  project,
  instance,
  isRunning
}: ScreenshotProps) => {
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);
  const healthCleanupRef = useRef<(() => void) | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (healthCleanupRef.current) {
        healthCleanupRef.current();
        healthCleanupRef.current = null;
      }
    };
  }, []);

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

  // Helper function to format timestamp
  const formatTimestamp = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
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
    </>
  );
}; 