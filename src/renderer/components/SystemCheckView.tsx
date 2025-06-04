import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Group, 
  Text, 
  Button, 
  Stack, 
  Badge, 
  Loader,
  Alert,
  Divider,
  Indicator,
  Modal
} from '@mantine/core';
import { IconRefresh, IconCheck, IconX, IconAlertCircle, IconSettings } from '@tabler/icons-react';
import { SystemCheckResults } from '../../types/SystemCheckResults';

interface SystemCheckItemProps {
  label: string;
  status: boolean | string;
  isVersion?: boolean;
}

const SystemCheckItem: React.FC<SystemCheckItemProps> = ({ label, status, isVersion = false }) => {
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
        <Text fw={500}>{label}</Text>
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

export const SystemCheckView: React.FC = () => {
  const [modalOpened, setModalOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SystemCheckResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSystemCheck = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const checkResults = await window.electronAPI.runSystemCheck();
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
  }, []);

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

  return (
    <>
      <Button
        variant="light"
        color={getStatusColor()}
        leftSection={
          <Indicator 
            color={getStatusColor()} 
            size={8} 
            offset={2}
          >
            <IconSettings size={16} />
          </Indicator>
        }
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
        size="md"
      >
        <Stack gap="md">
          <Group justify="flex-end">
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
            <Stack gap="md">
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

              <Divider />

              <div>
                <Text size="sm" fw={600} c="dimmed" mb="xs">Port Availability</Text>
                <Stack gap="xs">
                  <SystemCheckItem label="Port 80 (HTTP)" status={results.port80Available} />
                  <SystemCheckItem label="Port 4502 (AEM Author)" status={results.port4502Available} />
                  <SystemCheckItem label="Port 4503 (AEM Publisher)" status={results.port4503Available} />
                </Stack>
              </div>
            </Stack>
          )}
        </Stack>
      </Modal>
    </>
  );
};