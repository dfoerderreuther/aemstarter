import React, { useState, useEffect } from 'react';
import { Modal, Stack, Text, Paper, Group, Button, ScrollArea, Divider, Badge, Loader, Title, ThemeIcon } from '@mantine/core';
import { IconRefresh, IconPlayerPlay, IconAlertCircle, IconBug, IconPackage, IconHistory, IconRobot } from '@tabler/icons-react';
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
  const [progressMessages, setProgressMessages] = useState<{message: string; timestamp: number}[]>([]);
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (!opened) {
      // Reset state when modal closes
      setRunningTask(null);
      setProgressMessages([]);
      setIsTaskCompleted(false);
      setTaskStartTime(null);
      setShowConfirmClose(false);
      return;
    }

    // Listen for automation progress updates
    const cleanup = window.electronAPI.onAutomationProgress((data) => {
      if (data.projectId === project.id && runningTask && data.taskType === runningTask.type) {
        console.log('[AutomationModal] Received message:', data.message);
        const timestamp = Date.now();
        setProgressMessages(prev => [...prev, { message: data.message, timestamp }]);
        
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
    setTaskStartTime(Date.now());
  };

  const handleTaskComplete = () => {
    setRunningTask(null);
    setProgressMessages([]);
    setIsTaskCompleted(false);
    setTaskStartTime(null);
  };

  const handleModalClose = () => {
    // If task is running and not completed, show confirmation dialog
    if (runningTask && !isTaskCompleted) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmClose(false);
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
    padding: 'var(--mantine-spacing-lg)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
      transform: 'translateY(-1px)',
      boxShadow: 'var(--mantine-shadow-sm)',
    }
  };

  const allInstancesRunning = isAuthorRunning && isPublisherRunning && isDispatcherRunning;

  return (
    <>
      {/* Main modal - conditionally show task progress or task list */}
      <Modal
        opened={opened}
        onClose={handleModalClose}
        title={
          runningTask ? (
            <Group gap="sm">
              <ThemeIcon variant="light" color="blue" size="md">
                <IconRobot size={16} />
              </ThemeIcon>
              {!isTaskCompleted && <Loader size="sm" color="orange" />}
              <Text fw={500}>{runningTask.title}</Text>
              {isTaskCompleted && <Badge color="green" size="sm">Completed</Badge>}
            </Group>
          ) : (
            <Group gap="sm">
              <ThemeIcon variant="light" color="blue" size="lg">
                <IconRobot size={20} />
              </ThemeIcon>
              <div>
                <Title order={3} mb={2}>Automation Tasks</Title>
                <Text size="sm" c="dimmed">Streamline your AEM workflow with automated tasks</Text>
              </div>
            </Group>
          )
        }
        size={runningTask ? "md" : "lg"}
        closeOnClickOutside={runningTask ? false : true}
        closeOnEscape={runningTask ? false : true}
        withCloseButton={true}
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          body: { padding: runningTask ? 'var(--mantine-spacing-md)' : 0 },
          header: { 
            padding: 'var(--mantine-spacing-lg)', 
            borderBottom: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))' 
          }
        }}
      >
        {runningTask ? (
          // Show progress view when task is running
          <Stack gap="md">
            <ScrollArea style={{ height: '300px' }} type="hover">
              <Stack gap="xs">
                {progressMessages.length === 0 ? (
                  <Group gap="sm">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed" fs="italic">
                      Initializing task...
                    </Text>
                  </Group>
                ) : (
                  progressMessages.map((messageObj, index) => {
                    const elapsedSeconds = taskStartTime 
                      ? ((messageObj.timestamp - taskStartTime) / 1000).toFixed(1)
                      : '0.0';
                    
                    return (
                      <Group key={index} gap="sm" align="flex-start" py={4} px="xs">
                        <Badge variant="light" color="blue" size="xs" tt="none">
                          {elapsedSeconds}s
                        </Badge>
                        <Text size="sm" style={{ flex: 1 }}>
                          {messageObj.message}
                        </Text>
                      </Group>
                    );
                  })
                )}
              </Stack>
            </ScrollArea>
            
            {!isTaskCompleted ? (
              <Text size="xs" c="dimmed" ta="center" fs="italic">
                Please wait while the automation task is running...
              </Text>
            ) : (
              <Group justify="center" mt="md">
                <Button 
                  size="sm" 
                  color="green" 
                  onClick={() => {
                    handleTaskComplete();
                    onClose();
                  }}
                  variant="filled"
                  leftSection={<IconPlayerPlay size={14} />}
                >
                  Close & Continue
                </Button>
              </Group>
            )}
          </Stack>
        ) : (
          // Show normal task list when no task is running
          <ScrollArea style={{ height: '400px' }}>
            <Stack gap={0}>
              <AutomationTaskTeaser 
                task="create-backup-and-run" 
                project={project} 
                icon={IconPlayerPlay}
                taskTitle="Create backup and start"
                onTaskStart={handleTaskStart}
              >
                <div>
                  <Text fw={500} size="sm" mb={4}>Create backup and start</Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    This will shut down all instances, create a backup and start again.
                  </Text>
                </div>
              </AutomationTaskTeaser>
              <Divider />
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
                task="first-backup-and-run" 
                project={project} 
                icon={IconHistory}
                taskTitle="Restore first backup and start"
                onTaskStart={handleTaskStart}
              >
                <div>
                  <Text fw={500} size="sm" mb={4}>Restore first backup and start</Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    This will shut down all instances, restore the first backup and start again.
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

              <AutomationTaskTeaser 
                task="first-start-and-initial-setup" 
                project={project} 
                icon={IconPackage}
                taskTitle="First start and initial setup"
                onTaskStart={handleTaskStart}
              >
                <div>
                  <Text fw={500} size="sm" mb={4}>First start and initial setup</Text>
                  <Text size="xs" c="dimmed" mb={8}>
                    This will start all instances, 
                    configure replication between Author, Publisher, and Dispatcher instances, 
                    load matching oak-run.jar
                    and install the WKND packages.
                  </Text>
                  <Group gap="xs">
                    <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
                  </Group>
                </div>
              </AutomationTaskTeaser>

              <Divider />
              
              {/* Setup Replication Task */}
              <Paper style={taskItemStyles} radius="md" withBorder>
                <Group align="flex-start" gap="md">
                  <ThemeIcon size="xl" variant="light" color="blue" radius="md">
                    <IconRefresh size={24} />
                  </ThemeIcon>
                  
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
              <Paper style={{...taskItemStyles, opacity: 0.6, cursor: 'default'}} radius="md" withBorder>
                <Group align="flex-start" gap="md">
                  <ThemeIcon size="xl" variant="light" color="gray" radius="md">
                    <IconPlayerPlay size={24} />
                  </ThemeIcon>
                  
                  <div style={{ flex: 1 }}>
                    <Group gap="sm" mb="xs">
                      <Text fw={500} size="sm" c="dimmed">More Tasks Coming Soon...</Text>
                      <Badge variant="outline" color="gray" size="xs">Soon</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Additional automation tasks will be added in future updates.
                    </Text>
                  </div>
                </Group>
              </Paper>
            </Stack>
          </ScrollArea>
        )}
      </Modal>

      {/* Confirmation dialog - always rendered so it can show during any modal state */}
      <Modal
        opened={showConfirmClose}
        onClose={handleCancelClose}
        title="Task Still Running"
        size="sm"
        centered
        overlayProps={{
          backgroundOpacity: 0.7,
          blur: 4,
        }}
      >
        <Stack gap="md">
          <Text>
            Task still running. Sure you want to leave? This will not stop further task execution.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="outline" onClick={handleCancelClose}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmClose}>
              Leave Anyway
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};