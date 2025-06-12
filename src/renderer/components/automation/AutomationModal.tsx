import React, { useState, useEffect } from 'react';
import { Modal, Stack, Text, Paper, Group, Button, ScrollArea, Divider, Badge, Loader } from '@mantine/core';
import { IconRefresh, IconPlayerPlay, IconAlertCircle, IconBug, IconPackage } from '@tabler/icons-react';
import { Project } from '../../../types/Project';
import { AutomationTaskTeaser } from './AutomationTaskTeaser';

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
  const [isSettingUpReplication, setIsSettingUpReplication] = useState(false);
  const [runningTask, setRunningTask] = useState<{type: string; title: string} | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);

  useEffect(() => {
    if (!opened) {
      // Reset state when modal closes
      setRunningTask(null);
      setProgressMessages([]);
      setIsTaskCompleted(false);
      return;
    }

    // Listen for automation progress updates
    const cleanup = window.electronAPI.onAutomationProgress((data) => {
      if (data.projectId === project.id && runningTask && data.taskType === runningTask.type) {
        console.log('[AutomationModal] Received message:', data.message);
        setProgressMessages(prev => [...prev, data.message]);
        
        // Check if task is completed
        const completionKeywords = [
          'completed successfully',
          'Task completed',
          'Automation completed',
          'Reinstall completed',
          'done'
        ];
        
        const isCompletionMessage = completionKeywords.some(keyword => 
          data.message.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isCompletionMessage) {
          console.log('[AutomationModal] Task completed');
          setIsTaskCompleted(true);
        }
      }
    });

    return cleanup;
  }, [opened, project.id, runningTask]);

  const handleTaskStart = (taskType: string, taskTitle: string) => {
    setRunningTask({ type: taskType, title: taskTitle });
    setProgressMessages([]);
    setIsTaskCompleted(false);
  };

  const handleTaskComplete = () => {
    setRunningTask(null);
    setProgressMessages([]);
    setIsTaskCompleted(false);
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

  // Show progress view when task is running
  if (runningTask) {
    return (
      <Modal
        opened={opened}
        onClose={() => {}} // Prevent closing while running
        title={
          <Group gap="sm">
            {!isTaskCompleted && <Loader size="sm" color="orange" />}
            <Text fw={500}>{runningTask.title}</Text>
            {isTaskCompleted && <Badge color="green" size="sm">Completed</Badge>}
          </Group>
        }
        size="md"
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={isTaskCompleted}
        styles={{
          body: { padding: '16px' },
          header: { padding: '16px 24px', borderBottom: '1px solid var(--mantine-color-gray-3)' }
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {isTaskCompleted ? 'Task completed successfully!' : 'Running automation task...'}
          </Text>
          
          <ScrollArea style={{ height: '300px' }}>
            <Stack gap="xs">
              {progressMessages.length === 0 ? (
                <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                  Initializing task...
                </Text>
              ) : (
                progressMessages.map((message, index) => (
                  <Group key={index} gap="xs" align="flex-start">
                    <Text size="xs" c="dimmed" style={{ minWidth: '40px', fontFamily: 'monospace' }}>
                      {String(index + 1).padStart(2, '0')}.
                    </Text>
                    <Text size="sm" style={{ flex: 1 }}>
                      {message}
                    </Text>
                  </Group>
                ))
              )}
            </Stack>
          </ScrollArea>
          
          {!isTaskCompleted ? (
            <Text size="xs" c="dimmed" style={{ textAlign: 'center' }}>
              Please wait while the automation task is running...
            </Text>
          ) : (
            <Group justify="center">
              <Button 
                size="sm" 
                color="green" 
                onClick={() => {
                  handleTaskComplete();
                  onClose();
                }}
                variant="light"
              >
                Close
              </Button>
            </Group>
          )}
        </Stack>
      </Modal>
    );
  }

  // Show normal task list when no task is running
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

          <AutomationTaskTeaser 
            task="last-backup-and-run" 
            project={project} 
            icon={IconPlayerPlay}
            taskTitle="Restore last backup and start"
            onTaskStart={handleTaskStart}
          >
            <div>
              <Text fw={500} size="sm" mb={4}>Restore last backup and start</Text>
              <Text size="xs" c="dimmed" mb={8}>
                This will shut down all instances, restore the last backup and start again.
              </Text>
              <Group gap="xs">
                <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
              </Group>
            </div>
          </AutomationTaskTeaser>
          <Divider />

          <AutomationTaskTeaser 
            task="last-backup-and-debug" 
            project={project} 
            icon={IconBug}
            taskTitle="Restore last backup and start in debug mode"
            onTaskStart={handleTaskStart}
          >
            <div>
              <Text fw={500} size="sm" mb={4}>Restore last backup and start in debug mode</Text>
              <Text size="xs" c="dimmed" mb={8}>
                This will shut down all instances, restore the last backup and start again in debug mode.
              </Text>
              <Group gap="xs">
                <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
              </Group>
            </div>
          </AutomationTaskTeaser>
          
          <Divider />

          <AutomationTaskTeaser 
            task="reinstall" 
            project={project} 
            icon={IconPackage}
            taskTitle="Reinstall AEM"
            onTaskStart={handleTaskStart}
          >
            <div>
              <Text fw={500} size="sm" mb={4}>Reinstall AEM</Text>
              <Text size="xs" c="dimmed" mb={8}>
                Completely reinstall AEM instances. This will delete existing folders, 
                create new ones, copy license files, and unzip the SDK package.
              </Text>
              <Group gap="xs">
                <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
              </Group>
            </div>
          </AutomationTaskTeaser>

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