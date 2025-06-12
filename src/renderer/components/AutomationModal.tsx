import React, { useState } from 'react';
import { Modal, Stack, Text, Paper, Group, Button, ScrollArea, Divider, Badge } from '@mantine/core';
import { IconPackage, IconRefresh, IconPlayerPlay, IconAlertCircle } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { InstallService } from '../services/installService';
import { AutomationTaskTeaser } from './automation/AutomationTaskTeaser';

interface AutomationModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
  isAuthorRunning: boolean;
  isPublisherRunning: boolean;
  isDispatcherRunning: boolean;
}

export const AutomationModal: React.FC<AutomationModalProps> = ({ 
  opened, 
  onClose, 
  project, 
  isAuthorRunning,
  isPublisherRunning,
  isDispatcherRunning 
}) => {
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [isSettingUpReplication, setIsSettingUpReplication] = useState(false);

  const handleReinstall = async () => {
    try {
      setIsReinstalling(true);
      await InstallService.installAEM(project);
      // Add a small delay to ensure file system operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsReinstalling(false);
    }
  };

  const handleSetupReplication = async () => {
    try {
      setIsSettingUpReplication(true);
      // Set up replication for all instances
      await Promise.all([
        window.electronAPI.setupReplication(project, 'author'),
        window.electronAPI.setupReplication(project, 'publisher'),
        window.electronAPI.setupReplication(project, 'dispatcher')
      ]);
    } catch (error) {
      console.error('Setup replication failed:', error);
    } finally {
      setIsSettingUpReplication(false);
    }
  };

  const taskItemStyles = {
    padding: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-0)',
    }
  };

  const allInstancesRunning = isAuthorRunning && isPublisherRunning && isDispatcherRunning;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Automation Tasks"
      size="lg"
      styles={{
        body: { padding: 0 },
        header: { padding: '16px 24px', borderBottom: '1px solid var(--mantine-color-gray-3)' }
      }}
    >
      <ScrollArea style={{ height: '400px' }}>
        <Stack gap={0}>

                  <AutomationTaskTeaser task="last-backup-and-run" project={project}>
            <div>
              <Text fw={500} size="sm" mb={4}>Restore last backup and start</Text>
              <Text size="xs" c="dimmed" mb={8}>
                This will shut down all instances, restore the last backup and start them again.
              </Text>
              <Group gap="xs">
                <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
                <Badge variant="outline" color="gray" size="xs">Requires Stop</Badge>
              </Group>
            </div>
          </AutomationTaskTeaser>
          
          <Divider />
          
          {/* Reinstall Task */}
          <Paper style={taskItemStyles} radius={0}>
            <Group align="flex-start" gap="md">
              <div style={{ 
                width: '48px', 
                height: '48px', 
                backgroundColor: 'var(--mantine-color-orange-1)', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconPackage size={24} color="var(--mantine-color-orange-6)" />
              </div>
              
              <div style={{ flex: 1 }}>
                
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={500} size="sm" mb={4}>Reinstall AEM</Text>
                    <Text size="xs" c="dimmed" mb={8}>
                      Completely reinstall AEM instances. This will delete existing folders, 
                      create new ones, copy license files, and unzip the SDK package.
                    </Text>
                    <Group gap="xs">
                      <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
                      <Badge variant="outline" color="gray" size="xs">Requires Stop</Badge>
                    </Group>
                  </div>
                  
                  <Button
                    color="orange"
                    size="xs"
                    loading={isReinstalling}
                    disabled={isAuthorRunning || isPublisherRunning || isDispatcherRunning}
                    onClick={handleReinstall}
                    leftSection={<IconPackage size={14} />}
                  >
                    Reinstall
                  </Button>
                </Group>
              </div>
            </Group>
          </Paper>

          <Divider />

          {/* Setup Replication Task */}
          <Paper style={taskItemStyles} radius={0}>
            <Group align="flex-start" gap="md">
              <div style={{ 
                width: '48px', 
                height: '48px', 
                backgroundColor: 'var(--mantine-color-blue-1)', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconRefresh size={24} color="var(--mantine-color-blue-6)" />
              </div>
              
              <div style={{ flex: 1 }}>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={500} size="sm" mb={4}>Set Up Replication</Text>
                    <Text size="xs" c="dimmed" mb={8}>
                      Configure replication between Author, Publisher, and Dispatcher instances. 
                      This will set up the proper replication agents and configurations.
                    </Text>
                    <Group gap="xs">
                      <Badge variant="outline" color="blue" size="xs">Configuration</Badge>
                      <Badge variant="outline" color="gray" size="xs">Requires All Running</Badge>
                      {!allInstancesRunning && (
                        <Badge variant="outline" color="red" size="xs" leftSection={<IconAlertCircle size={10} />}>
                          Instances Stopped
                        </Badge>
                      )}
                    </Group>
                  </div>
                  
                  <Button
                    color="blue"
                    size="xs"
                    loading={isSettingUpReplication}
                    disabled={!allInstancesRunning}
                    onClick={handleSetupReplication}
                    leftSection={<IconRefresh size={14} />}
                  >
                    Set Up
                  </Button>
                </Group>
              </div>
            </Group>
          </Paper>

          <Divider />

          {/* Placeholder for future tasks */}
          <Paper style={{...taskItemStyles, opacity: 0.5}} radius={0}>
            <Group align="flex-start" gap="md">
              <div style={{ 
                width: '48px', 
                height: '48px', 
                backgroundColor: 'var(--mantine-color-gray-2)', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IconPlayerPlay size={24} color="var(--mantine-color-gray-6)" />
              </div>
              
              <div style={{ flex: 1 }}>
                <Text fw={500} size="sm" mb={4} c="dimmed">More Tasks Coming Soon...</Text>
                <Text size="xs" c="dimmed">
                  Additional automation tasks will be added in future updates.
                </Text>
              </div>
            </Group>
          </Paper>

        </Stack>
      </ScrollArea>
    </Modal>
  );
};