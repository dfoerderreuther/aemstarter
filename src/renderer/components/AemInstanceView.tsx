import { Project } from "../../types/Project";
import { Grid, TextInput, NumberInput, Switch, Button, Group, Stack, Paper, Text, Collapse } from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal } from './Terminal';
import { IconPlayerPlay, IconPlayerStop, IconBug, IconChevronDown, IconChevronUp } from '@tabler/icons-react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasShownAemOutput, setHasShownAemOutput] = useState(false);
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

  const handleStart = async () => {
    if (!terminalRef.current) return;
    
    try {
      terminalRef.current.clear();
      setHasShownAemOutput(false);
      terminalRef.current.writeln(`AEM ${instance} instance terminal`);
      terminalRef.current.writeln('Ready to start...');
      terminalRef.current.writeln(`Starting ${instance} instance on port ${port}...`);
      terminalRef.current.writeln(`CQ_PORT=${port}`);
      terminalRef.current.writeln(`CQ_RUNMODE=${runmode}`);
      terminalRef.current.writeln(`CQ_JVM_OPTS=${jvmOpts}`);
      if (isDebugEnabled) {
        terminalRef.current.writeln(`Debug port: ${debugPort}`);
      }

      await window.electronAPI.startAemInstance(project, instance, {
        port,
        runmode,
        jvmOpts,
        ...(isDebugEnabled && { debugPort }),
      });

      setIsRunning(true);
    } catch (error) {
      terminalRef.current.writeln(`Error starting instance: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Error starting instance:', error);
    }
  };

  const handleStop = async () => {
    if (!terminalRef.current) return;
    
    try {
      terminalRef.current.writeln(`Stopping ${instance} instance...`);
      await window.electronAPI.stopAemInstance(project, instance);
      setIsRunning(false);
      terminalRef.current.writeln('Instance stopped successfully');
    } catch (error) {
      terminalRef.current.writeln(`Error stopping instance: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Error stopping instance:', error);
    }
  };

  const handleDebug = async () => {
    if (!terminalRef.current) return;
    
    try {
      terminalRef.current.writeln(`Starting ${instance} instance in debug mode...`);
      terminalRef.current.writeln(`Debug port: ${debugPort}`);

      await window.electronAPI.startAemInstance(project, instance, {
        port,
        runmode,
        jvmOpts,
        debugPort,
      });

      setIsRunning(true);
    } catch (error) {
      terminalRef.current.writeln(`Error starting debug mode: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Error starting debug mode:', error);
    }
  };

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal;
    terminal.writeln(`AEM ${instance} instance - Error Log Monitor`);
    terminal.writeln('Ready to start...');

    let totalLinesProcessed = 0;

    // Set up real-time log streaming
    const handleLogData = (data: { projectId: string; instanceType: string; data: string }) => {
      // Only process logs for this specific project and instance
      if (data.projectId === project.id && data.instanceType === instance) {
        console.log('Streaming log data:', data.data.substring(0, 100) + '...');
        
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
        
        if (totalLinesProcessed % 50 === 0) {
          console.log(`Total lines streamed: ${totalLinesProcessed}`);
        }
      }
    };

    // Set up the event listener
    window.electronAPI.onAemLogData(handleLogData);
    console.log(`Started real-time log streaming for ${instance} instance`);

    // Cleanup function
    const cleanup = () => {
      console.log('Cleaning up log streaming');
      window.electronAPI.removeAemLogDataListener();
    };

    return cleanup;
  };

  return (
    <Stack gap="md" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Form Section */}
      <Paper shadow="xs" p="md" style={{ flexShrink: 0 }}>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500} size="lg">{instance.charAt(0).toUpperCase() + instance.slice(1)} Instance Settings</Text>
            <Button 
              variant="subtle" 
              onClick={() => setIsExpanded(!isExpanded)}
              rightSection={isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </Button>
          </Group>

          {/* Always visible controls */}
          <Group grow>
            <Group gap="sm">
              <Button
                color="green"
                leftSection={<IconPlayerPlay size={16} />}
                onClick={handleStart}
                disabled={isRunning}
              >
                Start
              </Button>
              <Button
                color="red"
                leftSection={<IconPlayerStop size={16} />}
                onClick={handleStop}
                disabled={!isRunning}
              >
                Stop
              </Button>
            </Group>

            <Group gap="sm">
              <Switch
                label="Enable Debug"
                checked={isDebugEnabled}
                onChange={(e) => setIsDebugEnabled(e.target.checked)}
                disabled={isRunning}
              />
              {isDebugEnabled && (
                <>
                  <NumberInput
                    label="Debug Port"
                    value={debugPort}
                    onChange={(val) => setDebugPort(Number(val))}
                    min={1024}
                    max={65535}
                    disabled={isRunning}
                    style={{ width: '120px' }}
                  />
                  <Button
                    color="blue"
                    leftSection={<IconBug size={16} />}
                    onClick={handleDebug}
                    disabled={isRunning}
                  >
                    Debug
                  </Button>
                </>
              )}
            </Group>
          </Group>

          {/* Collapsible section */}
          <Collapse in={isExpanded}>
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
          </Collapse>
        </Stack>
      </Paper>

      {/* Terminal Section */}
      <Paper shadow="xs" style={{ 
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
  );
};