import { Project } from "../../types/Project";
import { Grid, TextInput, NumberInput, Switch, Button, Group, Stack, Paper, Text, Box, Tooltip, ActionIcon, Modal } from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal } from './Terminal';
import { IconPlayerPlay, IconPlayerStop, IconBug, IconX, IconSettings } from '@tabler/icons-react';

interface AemInstanceViewProps {
  instance: 'author' | 'publisher';
  project: Project;
}

export const AemInstanceView = ({ instance, project }: AemInstanceViewProps) => {
  const defaultPort = instance === 'publisher' ? 4503 : 4502;
  const [port, setPort] = useState(defaultPort);
  const [runmode, setRunmode] = useState('');
  const [jvmOpts, setJvmOpts] = useState('-server -Xmx2048m -XX:MaxPermSize=512M');
  const [debugPort, setDebugPort] = useState(30303);
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasShownAemOutput, setHasShownAemOutput] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const terminalRef = useRef<XTerm | null>(null);

  // Reset hasShownAemOutput when instance is stopped
  useEffect(() => {
    if (!isRunning) {
      setHasShownAemOutput(false);
    }
  }, [isRunning]);

  // Check instance status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const running = await window.electronAPI.isAemInstanceRunning(project, instance);
        setIsRunning(running);
      } catch (error) {
        console.error('Error checking instance status:', error);
      }
    };
    checkStatus();
  }, [project, instance]);

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal;
    terminal.writeln(`AEM ${instance} instance - Error Log Monitor`);
    terminal.writeln('Ready to start...');

    let totalLinesProcessed = 0;

    // Set up real-time log streaming
    const handleLogData = (data: { projectId: string; instanceType: string; data: string }) => {
      // Only process logs for this specific project and instance
      if (data.projectId === project.id && data.instanceType === instance) {
        // Clear terminal and show header when we get first AEM output
        if (!hasShownAemOutput) {
          terminal.clear();
          terminal.writeln(`AEM ${instance} instance - Live Log Stream:`);
          terminal.writeln('----------------------------');
          setHasShownAemOutput(true);
        }

        // Write the log line immediately
        terminal.writeln(data.data);
        totalLinesProcessed++;
        
        // Auto-scroll to bottom to show latest logs
        terminal.scrollToBottom();
      }
    };

    // Set up the event listener
    window.electronAPI.onAemLogData(handleLogData);

    // Cleanup function
    const cleanup = () => {
      window.electronAPI.removeAemLogDataListener();
    };

    return cleanup;
  };

  const modal = (
    <Modal
    opened={isSettingsOpen}
    onClose={() => setIsSettingsOpen(false)}
    title={`${instance.charAt(0).toUpperCase() + instance.slice(1)} Instance Settings`}
    size="lg"
    >
      <Stack gap="md">
        {/* Debug Configuration */}
        <Group gap="sm">
          <Switch
            label="Enable Debug"
            checked={isDebugEnabled}
            onChange={(e) => setIsDebugEnabled(e.target.checked)}
            disabled={isRunning}
          />
          <NumberInput
            label="Debug Port"
            value={debugPort}
            onChange={(val) => setDebugPort(Number(val))}
            min={1024}
            max={65535}
            disabled={isRunning}
            style={{ width: '120px' }}
          />
        </Group>

        <Stack gap="md">
          <NumberInput
            label="CQ Port"
            description="The port on which the AEM instance will run"
            value={port}
            onChange={(val) => setPort(Number(val))}
            min={1024}
            max={65535}
            disabled={isRunning}
          />

          <TextInput
            label="CQ Runmode"
            description="Comma-separated list of runmodes"
            value={runmode}
            onChange={(e) => setRunmode(e.target.value)}
            placeholder="author,local,nosample"
            disabled={isRunning}
          />

          <TextInput
            label="CQ JVM Options"
            description="Java Virtual Machine options"
            value={jvmOpts}
            onChange={(e) => setJvmOpts(e.target.value)}
            disabled={isRunning}
          />
        </Stack>
      </Stack>
    </Modal>
  )

  return (

    <>

    <Stack gap="0">
      <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={700} c="dimmed">
            {instance.toUpperCase()} INSTANCE 
          </Text>
          <Group gap="xs" align="center" style={{ height: '24px', overflow: 'hidden', margin: '-4px 0' }}>
          
                <Text size="xs" fw={500}>
                  PID: 1234567890
                </Text>
                
                
                <Tooltip 
                  label="Settings" 
                  withArrow 
                  withinPortal
                  position="bottom"
                >
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <IconSettings size={16} />
                  </ActionIcon>
                </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* Settings Modal */}
      {modal}

      {/* Terminal Section */}
      <Paper shadow="xs" p="md" style={{ 
        flex: 1,
        backgroundColor: '#1a1b1e',
        overflow: 'hidden',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Terminal onReady={handleTerminalReady} />
        </div>
      </Paper>
    </Stack>
    </>
  );
};