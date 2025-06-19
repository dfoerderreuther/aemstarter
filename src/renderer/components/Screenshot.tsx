import { Box, Stack, Text, ActionIcon, Badge } from '@mantine/core';
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
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);
  const healthCleanupRef = useRef<(() => void) | null>(null);

  // Check if health checking is enabled for this instance
  useEffect(() => {
    const checkHealthCheckConfig = () => {
      try {
        const newHealthCheckEnabled = project.settings?.general?.healthCheck || false;
        
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
  }, [project, instance, healthCheckEnabled, isRunning]);

  // Listen for health status updates
  useEffect(() => {
    if (!healthCheckEnabled) return;

    const cleanup = window.electronAPI.onAemHealthStatus((data) => {
      if (data.projectId === project.id && data.instanceType === instance) {
        setHealthStatus(data.status);
        
        // Auto-update screenshot if available
        if (data.status.screenshotPath) {
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

  // Load screenshot when project, instance, or health check settings change
  useEffect(() => {
    const loadLatestScreenshot = async () => {
      console.log(`[Screenshot] Loading screenshot for project: ${project.name} (${project.id}), instance: ${instance}, healthCheck: ${healthCheckEnabled}`);
      
      // Always try to load the latest screenshot, regardless of health check status or running state
      try {
        const screenshotPath = await window.electronAPI.getLatestScreenshot(project, instance);
        console.log(`[Screenshot] Screenshot path for ${project.name} ${instance}:`, screenshotPath);
        
        // Load the screenshot as data URL
        if (screenshotPath) {
          const dataUrl = await window.electronAPI.readScreenshot(screenshotPath);
          if (dataUrl) {
            console.log(`[Screenshot] Successfully loaded screenshot for ${project.name} ${instance}`);
            setScreenshotDataUrl(dataUrl);
            setLastUpdateTime(new Date());
          } else {
            console.log(`[Screenshot] Failed to read screenshot data for ${project.name} ${instance}`);
            setScreenshotDataUrl(null);
            setLastUpdateTime(null);
          }
        } else {
          console.log(`[Screenshot] No screenshot found for ${project.name} ${instance}`);
          setScreenshotDataUrl(null);
          setLastUpdateTime(null);
        }
      } catch (error) {
        console.error(`[Screenshot] Error loading latest screenshot for ${project.name} ${instance}:`, error);
        setScreenshotDataUrl(null);
        setLastUpdateTime(null);
      }
    };
    
    loadLatestScreenshot();
  }, [project.id, instance, healthCheckEnabled]); // Trigger when project, instance, or health check changes

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
    <Stack gap="xs" style={{ alignItems: 'flex-start' }}>
      {/* Screenshot Display */}
      {screenshotDataUrl ? (
        <Box style={{ position: 'relative', width: '140px' }}>
          <img 
            src={screenshotDataUrl}
            alt={`${instance} screenshot`}
            style={{ 
              width: '140px', 
              height: 'auto',
              borderRadius: '4px',
              display: 'block',
              cursor: healthCheckEnabled ? 'default' : (isRunning ? 'pointer' : 'not-allowed'),
              opacity: isRunning ? 1 : 0.5
            }}
            onClick={healthCheckEnabled ? undefined : takeScreenshot}
          />
          
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
                borderRadius: '4px',
                cursor: isRunning ? 'pointer' : 'not-allowed'
              }}
              onClick={takeScreenshot}
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
        </Box>
      ) : (
        <Box
          onClick={healthCheckEnabled ? undefined : takeScreenshot}
          style={{
            cursor: healthCheckEnabled ? 'default' : (isRunning ? 'pointer' : 'not-allowed'),
            width: '140px',
            height: '105px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1A1A1A',
            borderRadius: '4px',
            opacity: isRunning ? 1 : 0.5
          }}
        >
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
        </Box>
      )}
      
      {/* Timestamp display - left aligned on next line */}
      {lastUpdateTime && (
        <Badge 
          size="xs" 
          color='gray'
          variant="light"
        >
          Last updated: {formatTimestamp(lastUpdateTime)}
          </Badge>
      )}
      
      {/* Health status badge */}
      {healthCheckEnabled && (
        <Badge 
          size="xs" 
          color={!isRunning ? 'red' : (healthStatus?.status === 'healthy' ? 'green' : 'red')}
          variant="light"
        >
          {!isRunning 
            ? 'Stopped' 
            : (healthStatus?.statusCode ? `HTTP ${healthStatus.statusCode}` : (healthStatus?.status || 'Unknown'))
          }
        </Badge>
      )}
    </Stack>
  );
}; 