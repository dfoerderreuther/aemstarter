import { Modal, Text, Stack, Group, Badge, Code, ScrollArea, Box, Divider, Accordion } from '@mantine/core';
import { InstanceStartData } from '../../types/InstanceStartData';
import { IconClock, IconSettings, IconTerminal, IconDatabase, IconCode } from '@tabler/icons-react';

interface AemInstanceInfoProps {
  opened: boolean;
  onClose: () => void;
  instanceType: 'author' | 'publisher';
  startData: (Omit<InstanceStartData, 'timestamp' | 'usedProcessEnv'> & { 
    timestamp: Date | string;
    usedProcessEnv: { [key: string]: string | null };
  }) | null;
}

export const AemInstanceInfo = ({ 
  opened, 
  onClose, 
  instanceType, 
  startData 
}: AemInstanceInfoProps) => {
  const formatTimestamp = (timestamp: Date | string) => {
    // Handle case where timestamp is serialized as string from IPC
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const formatJvmOptions = (jvmOptions: string) => {
    if (!jvmOptions) return 'None';
    return jvmOptions.split(' ').filter(opt => opt.trim()).join(' ');
  };

  const formatEnvVars = (envVars: { [key: string]: string | null }) => {
    const entries = Object.entries(envVars);
    return entries
      .map(([key, value]) => `${key}=${value || ''}`)
      .join(' ');
  };

  const formatProcessEnv = (processEnv: { [key: string]: string | null }) => {
    // Filter out common system variables and show only relevant ones
    const relevantKeys = [
      'JAVA_HOME', 'PATH', 'JAVA_OPTS', 'CQ_PORT', 'CQ_RUNMODE', 
      'CQ_JVM_OPTS', 'JAVA_VERSION', 'OS', 'PLATFORM'
    ];
    
    const allEntries = Object.entries(processEnv || {});
    const filtered = allEntries
      .filter(([key]) => relevantKeys.includes(key) || key.startsWith('CQ_') || key.startsWith('JAVA_'));
    
    // If no relevant variables found, show all variables (limited to first 20 to avoid overwhelming)
    const entriesToShow = filtered.length > 0 ? filtered : allEntries.slice(0, 20);
    
    return entriesToShow
      .map(([key, value]) => `${key}=${value || ''}`)
      .join('\n');
  };

  const formatProcessEnvWithHighlighting = (processEnv: { [key: string]: string | null }) => {
    const allEntries = Object.entries(processEnv || {});
    
    return allEntries.map(([key, value]) => {
      const line = `${key}=${value || ''}`;
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) return line;
      
      const beforeEqual = line.substring(0, equalIndex);
      const afterEqual = line.substring(equalIndex);
      
      return (
        <div key={key} style={{ marginBottom: '2px' }}>
          <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{beforeEqual}</span>
          {afterEqual}
        </div>
      );
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${instanceType.toUpperCase()} Instance Information`}
      size="xl"
      styles={{
        title: { fontWeight: 600 }
      }}
    >
      {startData ? (
        <ScrollArea h={600}>
          <Stack gap="md">

            {/* Accordion for detailed sections */}
            <Accordion variant="contained" defaultValue="basic-info">
              <Accordion.Item value="basic-info">
                <Accordion.Control>
                  <Group gap="xs">
                    <IconSettings size={16} />
                    <Text size="sm" fw={600}>Basic Information</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Start Time:</Text>
                      <Text size="sm">
                      {formatTimestamp(startData.timestamp)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Port:</Text>
                      <Text size="sm">{startData.port}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Run Mode:</Text>
                      <Text size="sm">{startData.runmode}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Debug Mode:</Text>
                      <Text size="sm" c={startData.isDebugMode ? 'red' : 'green'}>
                        {startData.isDebugMode ? 'Enabled' : 'Disabled'}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Start Method:</Text>
                      <Text size="sm">
                        {startData.startedWithStartScript ? 'Start Script (crx-quickstart/bin/start)' : 'JAR File (aem-quickstart.jar)'}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">JAVA_HOME:</Text>
                      <Text size="sm">
                        {startData.usedProcessEnv?.JAVA_HOME || 'Not set'}
                      </Text>
                    </Group>
                    
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">JVM Options:</Text>
                      <Text size="sm" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {formatJvmOptions(startData.jvmOptions)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Custom Environment Variables:</Text>
                      <Text size="sm" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {Object.keys(startData.envVarsObj).length > 0 ? formatEnvVars(startData.envVarsObj) : 'None configured'}
                      </Text>
                    </Group>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="process-env-complete">
                <Accordion.Control>
                  <Group gap="xs">
                    <IconDatabase size={16} />
                    <Text size="sm" fw={600}>Complete Process Environment</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  {Object.keys(startData.usedProcessEnv).length > 0 ? (
                    <Box style={{ fontFamily: 'monospace', fontSize: '12px', maxHeight: '400px', overflow: 'auto' }}>
                      {formatProcessEnvWithHighlighting(startData.usedProcessEnv)}
                    </Box>
                  ) : (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No process environment variables available.
                    </Text>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </ScrollArea>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          No start data available for this instance.
        </Text>
      )}
    </Modal>
  );
}; 