import { Project } from "../../types/Project";
import { Grid, TextInput, NumberInput, Switch, Button, Group, Stack, Paper, Text } from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal } from './Terminal';
import { IconPlayerPlay, IconPlayerStop, IconBug } from '@tabler/icons-react';

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
  const terminalRef = useRef<XTerm | null>(null);

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
    terminal.writeln(`AEM ${instance} instance terminal`);
    terminal.writeln('Ready to start...');

    // Set up output polling
    const pollOutput = async () => {
      if (!isRunning) return;

      try {
        const output = await window.electronAPI.getAemInstanceOutput(project, instance);
        output.stdout.forEach(line => terminal.writeln(line));
        output.stderr.forEach(line => terminal.writeln(line));
      } catch (error) {
        console.error('Error polling output:', error);
      }
    };

    const interval = setInterval(pollOutput, 1000);
    return () => clearInterval(interval);
  };

  return (
    <Grid gutter="md">
      {/* Left Column - Form */}
      <Grid.Col span={6}>
        <Paper shadow="xs" p="md">
          <Stack gap="md">
            <Text fw={500} size="lg">{instance.charAt(0).toUpperCase() + instance.slice(1)} Instance Settings</Text>
            
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

            <Switch
              label="Enable Debug"
              checked={isDebugEnabled}
              onChange={(e) => setIsDebugEnabled(e.target.checked)}
              disabled={isRunning}
            />

            {isDebugEnabled && (
              <NumberInput
                label="Debug Port"
                description="Port for remote debugging"
                value={debugPort}
                onChange={(val) => setDebugPort(Number(val))}
                min={1024}
                max={65535}
                disabled={isRunning}
              />
            )}

            <Group justify="flex-start" gap="sm">
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
              {isDebugEnabled && (
                <Button
                  color="blue"
                  leftSection={<IconBug size={16} />}
                  onClick={handleDebug}
                  disabled={isRunning}
                >
                  Debug
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Right Column - Terminal View */}
      <Grid.Col span={6}>
        <Paper shadow="xs" style={{ height: '400px', backgroundColor: '#1a1b1e', overflow: 'hidden' }}>
          <Terminal onReady={handleTerminalReady} />
        </Paper>
      </Grid.Col>
    </Grid>
  );
};