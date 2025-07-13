import React, { useState, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Paper, Group, Button, ScrollArea, Divider, Badge, Loader, Title, ThemeIcon } from '@mantine/core';
import { IconRefresh, IconPlayerPlay, IconAlertCircle, IconBug, IconPackage, IconHistory, IconRobot } from '@tabler/icons-react';
import { Project } from '../../../types/Project';
import { AutomationTaskTeaser } from './AutomationTaskTeaser';
import { BackupAndStartTeaser } from './teaser/BackupAndStartTeaser';
import { LastBackupAndRunTeaser } from './teaser/LastBackupAndRunTeaser';
import { LastBackupAndDebugTeaser } from './teaser/LastBackupAndDebugTeaser';
import { FirstBackupAndRunTeaser } from './teaser/FirstBackupAndRunTeaser';
import { ReinstallTeaser } from './teaser/ReinstallTeaser';
import { FirstStartAndInitialSetupTeaser } from './teaser/FirstStartAndInitialSetupTeaser';
import { SetUpReplicationTeaser } from './teaser/SetUpReplicationTeaser';
import { UpdateSdkAndRunTeaser } from './teaser/UpdateSdkAndRunTeaser';
import { UpdateSdkAndInstallAndRunTeaser } from './teaser/UpdateSdkAndInstallAndRunTeaser';

interface AutomationModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
  isAuthorRunning: boolean;
  isPublisherRunning: boolean;
  isDispatcherRunning: boolean;
  autoStartTask?: string;
  autoStartTaskParameters?: { [key: string]: string | boolean | number };
  onAutoTaskStarted?: () => void;
}

export const AutomationModal: React.FC<AutomationModalProps> = ({ 
  opened, 
  onClose, 
  project, 
  isAuthorRunning,
  isPublisherRunning,
  isDispatcherRunning,
  autoStartTask,
  autoStartTaskParameters,
  onAutoTaskStarted
}) => {
  const [isSettingUpReplication, setIsSettingUpReplication] = useState(false);
  const [runningTask, setRunningTask] = useState<{type: string; title: string} | null>(null);
  const [progressMessages, setProgressMessages] = useState<{message: string; timestamp: number}[]>([]);
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (progressMessages.length > 0 && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      const scrollContainer = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [progressMessages]);

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

  // Handle auto-starting a task when the modal opens
  useEffect(() => {
    
    if (opened && autoStartTask && !runningTask && onAutoTaskStarted) {
      console.log(`[AutomationModal] Auto-starting task: ${autoStartTask}`);
      
      // Find the task title for the auto-start task
      const taskTitles: { [key: string]: string } = {
        'first-start-and-initial-setup': 'First start and initial setup',
        'create-backup-and-run': 'Create backup and start',
        'last-backup-and-run': 'Restore last backup and start',
        'last-backup-and-debug': 'Restore last backup and start in debug mode',
        'first-backup-and-run': 'Restore first backup and start',
        'reinstall': 'Reinstall AEM'
      };

      const taskTitle = taskTitles[autoStartTask] || 'Automation Task';
      
      // Start the task tracking
      handleTaskStart(autoStartTask, taskTitle);
      
      // Start the actual task
      const startTask = async () => {
        try {
          console.log(`[AutomationModal] Running automation task: ${autoStartTask}`, autoStartTaskParameters);
          await window.electronAPI.runAutomationTask(project, autoStartTask, autoStartTaskParameters);
        } catch (error) {
          console.error(`[AutomationModal] Failed to auto-start task ${autoStartTask}:`, error);
        }
      };
      
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        startTask();
        // Notify that auto task has been started (after the task actually starts)
        onAutoTaskStarted();
      }, 100);
    }
  }, [opened, autoStartTask, autoStartTaskParameters, runningTask, onAutoTaskStarted, project]);

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
            <ScrollArea style={{ height: '300px' }} type="hover" ref={scrollAreaRef}>
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

              <LastBackupAndRunTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />
              <Divider />

              <LastBackupAndDebugTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />
              <Divider />
              
              <BackupAndStartTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />
              <Divider />

              <FirstBackupAndRunTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />
              <Divider />

              <UpdateSdkAndInstallAndRunTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />

              <Divider />

              <UpdateSdkAndRunTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />

              <Divider />

              <FirstStartAndInitialSetupTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />

              <Divider />
              
              <SetUpReplicationTeaser 
                project={project}
                isSettingUpReplication={isSettingUpReplication}
                allInstancesRunning={allInstancesRunning}
                onSetupReplication={handleSetupReplication}
                taskItemStyles={taskItemStyles}
              />

              <Divider />

              <ReinstallTeaser 
                project={project}
                onTaskStart={handleTaskStart}
              />
              <Divider />

              {/* Placeholder for future tasks */}
              <Paper style={{...taskItemStyles, opacity: 0.6, cursor: 'default'}} radius={0}>
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