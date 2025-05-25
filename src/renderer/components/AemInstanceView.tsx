import { Project } from "../../types/Project";
import { TextInput, NumberInput, Switch, Group, Stack, Paper, Text, Box, Tooltip, ActionIcon, MultiSelect } from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal } from './Terminal';

interface AemInstanceViewProps {
  instance: 'author' | 'publisher';
  project: Project;
  visible?: boolean;
}

export const AemInstanceView = ({ instance, project, visible = true }: AemInstanceViewProps) => {
  const defaultPort = instance === 'publisher' ? 4503 : 4502;
  const [port, setPort] = useState(defaultPort);
  const [runmode, setRunmode] = useState('');
  const [jvmOpts, setJvmOpts] = useState('-server -Xmx2048m -XX:MaxPermSize=512M');
  const [debugPort, setDebugPort] = useState(30303);
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [availableLogFiles, setAvailableLogFiles] = useState<string[]>(['error.log']);
  const [selectedLogFiles, setSelectedLogFiles] = useState<string[]>(['error.log']);
  const hasShownAemOutputRef = useRef(false);
  const terminalRef = useRef<XTerm | null>(null);
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

  // Listen for PID status updates
  useEffect(() => {
    const cleanup = window.electronAPI.onAemPidStatus((data) => {
      if (data.projectId === project.id && data.instanceType === instance) {
        setPid(data.pid);
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
    console.log('[AemInstanceView] Input focused, refreshing log files...');
    console.log('[AemInstanceView] Project:', project);
    console.log('[AemInstanceView] Instance:', instance);
    try {
      console.log('[AemInstanceView] Calling getAvailableLogFiles...');
      const logFiles = await window.electronAPI.getAvailableLogFiles(project, instance);
      console.log('[AemInstanceView] Received log files:', logFiles);
      setAvailableLogFiles(logFiles);
    } catch (error) {
      console.error('Error refreshing log files:', error);
    }
  };

  const handleTerminalReady = (terminal: XTerm) => {
    
    // Clean up any existing listener
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    
    terminalRef.current = terminal;
    terminal.writeln(`AEM ${instance} instance - Error Log Monitor`);
    terminal.writeln('Ready to start...');

    let totalLinesProcessed = 0;

    // Set up real-time log streaming
    const handleLogData = (data: { projectId: string; instanceType: string; data: string }) => {

      
      // Only process logs for this specific project and instance
      if (data.projectId === project.id && data.instanceType === instance) {
        // Clear terminal and show header when we get first AEM output
        if (!hasShownAemOutputRef.current) {
          terminal.clear();
          terminal.writeln(`AEM ${instance} instance - Live Log Stream:`);
          terminal.writeln('----------------------------');
          hasShownAemOutputRef.current = true;
        }

        // Write the log line immediately
        terminal.writeln(data.data);
        totalLinesProcessed++;
        
        // Auto-scroll to bottom to show latest logs
        terminal.scrollToBottom();
      }
    };

    const cleanup = window.electronAPI.onAemLogData(handleLogData);
    cleanupRef.current = cleanup;

    // Return the cleanup function
    return cleanup;
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
                />
            </Group>
          </Group>
          
          {/* Log Files Selection */}
          
        </Box>

        {/* Terminal Section */}
        <Paper shadow="xs" p="sm" style={{ 
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column', 
          backgroundColor: '#1A1A1A',
        }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Terminal onReady={handleTerminalReady} visible={visible} />
          </div>
        </Paper>
      </Stack>
    </>
  );
};