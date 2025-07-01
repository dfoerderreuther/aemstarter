import React, { useState, useEffect } from 'react';
import { 
  Group, 
  Text, 
  Button, 
  Stack, 
  Badge, 
  Loader,
  Alert,
  Indicator,
  Modal,
  Grid
} from '@mantine/core';
import { IconRefresh, IconCheck, IconX, IconAlertCircle, IconSettings, IconSkull } from '@tabler/icons-react';
import { SystemCheckResults } from '../../types/SystemCheckResults';
import { Project, ProjectSettings } from '../../types/Project';

interface SystemCheckItemProps {
  label: string;
  secondaryLabel?: string;
  status: boolean | string;
  isVersion?: boolean;
}

const SystemCheckItem: React.FC<SystemCheckItemProps> = ({ label, secondaryLabel, status, isVersion = false }) => {
  const isHealthy = isVersion ? status !== 'Not available' : status;
  const statusValue = isVersion ? (typeof status === 'string' ? status : 'Unknown') : (status ? 'Available' : 'Not Available');
  
  return (
    <Group justify="space-between" p="sm" style={{ backgroundColor: 'var(--mantine-color-dark-6)', borderRadius: 'var(--mantine-radius-sm)' }}>
      <Group gap="xs">
        {isHealthy ? (
          <IconCheck size={16} color="var(--mantine-color-green-6)" />
        ) : (
          <IconX size={16} color="var(--mantine-color-red-6)" />
        )}
        <div>
          <Text fw={500}>{label}</Text>
          {secondaryLabel && (
            <Text size="xs" c="dimmed">{secondaryLabel}</Text>
          )}
        </div>
      </Group>
      <Badge 
        color={isHealthy ? 'green' : 'red'} 
        variant="light"
      >
        {statusValue}
      </Badge>
    </Group>
  );
};

interface SystemCheckViewProps {
  project?: Project;
}

export const SystemCheckView: React.FC<SystemCheckViewProps> = ({ project }) => {
  const [modalOpened, setModalOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SystemCheckResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [killButtonState, setKillButtonState] = useState<'initial' | 'confirm'>('initial');

  // Get project settings directly from project object or use defaults
  const getProjectSettings = (): ProjectSettings => {
    if (project && project.settings) {
      return project.settings;
    }
    
    // Default settings when no project context
    // TODO: Remove this once we have a default project
    return {
      version: "1.0.0",
      general: {
        name: "Default",
        healthCheck: true
      },
      author: {
        port: 4502,
        runmode: "author,default",
        jvmOpts: "-server -Xmx4096m -Djava.awt.headless=true",
        debugJvmOpts: " -server -Xdebug -agentlib:jdwp=transport=dt_socket,address=5005,suspend=n,server=y",
        healthCheckPath: ""
      },
      publisher: {
        port: 4503,
        runmode: "publish,default",
        jvmOpts: "-server -Xmx4096m -Djava.awt.headless=true",
        debugJvmOpts: " -server -Xdebug -agentlib:jdwp=transport=dt_socket,address=5006,suspend=n,server=y",
        healthCheckPath: ""
      },
      dispatcher: {
        port: 80,
        config: "./config",
        healthCheckPath: ""
      },
      dev: {
        path: "",
        editor: "",
        customEditorPath: ""
      }
    };
  };

  const runSystemCheck = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const settings = getProjectSettings();
      const checkResults = await window.electronAPI.runSystemCheck(settings);
      setResults(checkResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run system check');
      console.error('System check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run system check on component mount
  useEffect(() => {
    runSystemCheck();
  }, [project]);

  const getOverallStatus = () => {
    if (!results) return 'unknown';
    
    const criticalChecks = [
      results.javaAvailable,
      results.dockerAvailable,
      results.dockerDaemonRunning
    ];
    
    return criticalChecks.every(check => check) ? 'healthy' : 'issues';
  };

  const getStatusColor = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'healthy': return 'green';
      case 'issues': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'healthy': return 'System Ready';
      case 'issues': return 'Issues Detected';
      default: return 'Checking...';
    }
  };

  const handleKillAll = async () => {
    if (killButtonState === 'initial') {
      // First click - show confirmation
      setKillButtonState('confirm');
      // Reset to initial state after 3 seconds if not clicked again
      setTimeout(() => {
        setKillButtonState('initial');

      }, 3000);
    } else {
      // Second click - actually kill
      try {
        if (project) {
          await window.electronAPI.killAllAemInstances(project);
          await window.electronAPI.killDispatcher(project);
          await runSystemCheck();
        }
        setKillButtonState('initial');
      } catch (error) {
        console.error('Failed to kill all instances:', error);
        setKillButtonState('initial');
      }
    }
  };

  return (
    <>
      <Button
        variant="light"
        color={getStatusColor()}
        leftSection={<IconSettings size={16} />}
        onClick={() => setModalOpened(true)}
        loading={isLoading && !results}
      >
        {getStatusText()}
      </Button>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="sm">
            <Indicator 
              color={getStatusColor()} 
              size={12} 
              offset={2}
            >
              <div></div>
            </Indicator>
            <Text size="lg" fw={600}>System Check</Text>
          </Group>
        }
        size="xl"
      >
        <Stack gap="md">
          <Group justify="flex-end">
            <Button
              size="sm"
              leftSection={<IconSkull size={14} />}
              onClick={handleKillAll}
              disabled={isLoading}
              variant="light"
              color={killButtonState === 'confirm' ? 'red' : 'orange'}
            >
              {killButtonState === 'confirm' ? 'Do you really want to do this?' : 'Kill All'}
            </Button>
            <Button
              size="sm"
              leftSection={isLoading ? <Loader size={14} /> : <IconRefresh size={14} />}
              onClick={runSystemCheck}
              disabled={isLoading}
              variant="light"
            >
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          </Group>

          {isLoading && (
            <Group justify="center" p="xl">
              <Loader size="sm" />
              <Text c="dimmed">Running system checks...</Text>
            </Group>
          )}

          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              title="Error" 
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}

          {results && !isLoading && (
            <Grid>
              <Grid.Col span={6}>
                <div>
                  <Text size="sm" fw={600} c="dimmed" mb="xs">Development Environment</Text>
                  <Stack gap="xs">
                    <SystemCheckItem label="Java" status={results.javaAvailable} />
                    <SystemCheckItem label="Java Version" status={results.javaVersion} isVersion />
                    <SystemCheckItem label="Docker" status={results.dockerAvailable} />
                    <SystemCheckItem label="Docker Daemon" status={results.dockerDaemonRunning} />
                    <SystemCheckItem label="Docker Version" status={results.dockerVersion} isVersion />
                  </Stack>
                </div>
              </Grid.Col>
              
              <Grid.Col span={6}>
                <div>
                  <Text size="sm" fw={600} c="dimmed" mb="xs">Port Availability</Text>
                  <Stack gap="xs">
                    <SystemCheckItem label={`Port ${results.portDispatcherAvailable[0]}`} secondaryLabel="Dispatcher" status={results.portDispatcherAvailable[1]} />
                    <SystemCheckItem label={`Port ${results.portAuthorAvailable[0]}`} secondaryLabel="AEM Author" status={results.portAuthorAvailable[1]} />
                    <SystemCheckItem label={`Port ${results.portPublisherAvailable[0]}`} secondaryLabel="AEM Publisher" status={results.portPublisherAvailable[1]} />
                    <SystemCheckItem label={`Port ${results.portAuthorDebugAvailable[0]}`} secondaryLabel="AEM Author Debug" status={results.portAuthorDebugAvailable[1]} />
                    <SystemCheckItem label={`Port ${results.portPublisherDebugAvailable[0]}`} secondaryLabel="AEM Publisher Debug" status={results.portPublisherDebugAvailable[1]} />
                  </Stack>
                </div>  
              </Grid.Col>
            </Grid>
          )}
        </Stack>
      </Modal>
    </>
  );
};