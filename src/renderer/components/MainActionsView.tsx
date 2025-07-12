import React, { useState, useEffect } from 'react';
import { Group, Button, Modal, Stack, Text, Paper, Tooltip, Badge, Divider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconSkull, IconSettings, IconBug, IconBrowser, IconDeviceFloppy, IconFolder, IconTerminal2, IconCode, IconRobot, IconPackage } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { SettingsModal } from './SettingsModal';
import { BackupModal } from './BackupModal';
import { AutomationModal } from './automation/AutomationModal';
import { PackageManagerModal } from './PackageManagerModal';


interface MainActionsViewProps {
  project: Project;
  shouldRunAutomation?: boolean;
  onAutomationStarted?: () => void;
  onProjectUpdated?: (updatedProject: Project) => void;
}

export const MainActionsView: React.FC<MainActionsViewProps> = ({ project, shouldRunAutomation, onAutomationStarted, onProjectUpdated }) => {
  const [showKillAllConfirm, setShowKillAllConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showPackageManager, setShowPackageManager] = useState(false);
  const [isAuthorRunning, setIsAuthorRunning] = useState(false);
  const [isAuthorDebugging, setIsAuthorDebugging] = useState(false);
  const [isPublisherRunning, setIsPublisherRunning] = useState(false);
  const [isPublisherDebugging, setIsPublisherDebugging] = useState(false);
  const [isDispatcherRunning, setIsDispatcherRunning] = useState(false);
  const [isSslProxyRunningState, setIsSslProxyRunningState] = useState(false);
  const [authorPid, setAuthorPid] = useState<number | null>(null);
  const [publisherPid, setPublisherPid] = useState<number | null>(null);
  const [autoStartTask, setAutoStartTask] = useState<string | undefined>();

  // Debug logging
  useEffect(() => {
    console.log('[MainActionsView] Props updated:', { 
      projectId: project.id, 
      shouldRunAutomation, 
      onAutomationStarted: !!onAutomationStarted,
      showAutomation
    });
  }, [project.id, shouldRunAutomation, onAutomationStarted, showAutomation]);

  // Handle automation trigger for new projects
  useEffect(() => {
    console.log('[MainActionsView] useEffect triggered:', { shouldRunAutomation, onAutomationStarted: !!onAutomationStarted, projectId: project.id });
    if (shouldRunAutomation && onAutomationStarted) {
      console.log('[MainActionsView] Triggering automation for new project:', project.id);
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        console.log('[MainActionsView] Opening automation modal with auto-start task');
        setAutoStartTask('first-start-and-initial-setup');
        setShowAutomation(true);
        // Don't clear the flag immediately - let the modal handle it
      }, 1000); // Reduced delay since installation is already complete
      
      return () => clearTimeout(timer);
    }
  }, [shouldRunAutomation, onAutomationStarted, project.id]); // Changed project to project.id to be more specific

  const handleAutoTaskStarted = () => {
    console.log('[MainActionsView] Auto task started, clearing auto-start task and automation flag');
    setAutoStartTask(undefined);
    // Clear the automation flag now that the modal has taken over
    if (onAutomationStarted) {
      onAutomationStarted();
    }
  };

  // Check instance status on mount and periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [authorRunning, publisherRunning, authorPidValue, publisherPidValue, authorDebugValue, publisherDebugValue, dispatcherStatus, sslProxyRunning] = await Promise.all([
          window.electronAPI.isAemInstanceRunning(project, 'author'),
          window.electronAPI.isAemInstanceRunning(project, 'publisher'),
          window.electronAPI.getAemInstancePid(project, 'author'),
          window.electronAPI.getAemInstancePid(project, 'publisher'),
          window.electronAPI.getAemInstanceDebugStatus(project, 'author'),
          window.electronAPI.getAemInstanceDebugStatus(project, 'publisher'),
          window.electronAPI.getDispatcherStatus(project),
          window.electronAPI.isSslProxyRunning(project)
        ]);
        setIsAuthorRunning(authorRunning);
        setIsPublisherRunning(publisherRunning);
        setAuthorPid(authorPidValue);
        setPublisherPid(publisherPidValue);
        setIsAuthorDebugging(authorDebugValue);
        setIsPublisherDebugging(publisherDebugValue);
        setIsDispatcherRunning(dispatcherStatus.isRunning);
        setIsSslProxyRunningState(sslProxyRunning);
      } catch (error) {
        console.error('Error checking instance status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    
    // Set up PID status event listener
    const pidStatusCleanup = window.electronAPI.onAemPidStatus((data) => {
      if (data.projectId === project.id) {
        if (data.instanceType === 'author') {
          setIsAuthorRunning(data.isRunning);
          setAuthorPid(data.pid);
        } else if (data.instanceType === 'publisher') {
          setIsPublisherRunning(data.isRunning);
          setPublisherPid(data.pid);
        }
      }
    });

    // Set up dispatcher status event listener
    const dispatcherStatusCleanup = window.electronAPI.onDispatcherStatus((data) => {
      if (data.projectId === project.id) {
        setIsDispatcherRunning(data.isRunning);
      }
    });
    
    return () => {
      clearInterval(interval);
      pidStatusCleanup();
      dispatcherStatusCleanup();
    };
  }, [project]);




  const handleKillAll = () => {
    setShowKillAllConfirm(true);
  };

  const confirmKillAll = async () => {
    try {
      await window.electronAPI.killAllAemInstances(project);
      console.log('About to call killDispatcher...'); // Debug log
      await window.electronAPI.killDispatcher(project);
      await window.electronAPI.stopSslProxy(project)
      console.log('killDispatcher call completed'); // Debug log
      setShowKillAllConfirm(false);
    } catch (error) {
      console.error('Failed to kill all instances:', error);
    }
  };

  const handleStartAll = async () => {
    try {
      // Start Author and Publisher in parallel
      await Promise.all([
        window.electronAPI.startAemInstance(project, 'author'),
        window.electronAPI.startAemInstance(project, 'publisher')
      ]);

      await handleStartDispatcherAfterPublisher();



    } catch (error) {
      console.error('Error starting all instances:', error);
    }
  };

  const handleStartDispatcherAfterPublisher = async () => {
    try {
      // Wait for Publisher to be up before starting Dispatcher
      let publisherReady = false;
      let retries = 0;
      const maxRetries = 10; // Wait up to 10 * 1s = 10s
      while (!publisherReady && retries < maxRetries) {
        // Check publisher status
        try {
          const running = await window.electronAPI.isAemInstanceRunning(project, 'publisher');
          if (running) {
            publisherReady = true;
            break;
          }
        } catch (e) {
          // ignore, will retry
        }
        await new Promise(res => setTimeout(res, 1000));
        retries++;
      }

      if (publisherReady) {
        try {
          await window.electronAPI.startDispatcher(project);
          if (project.settings?.https?.enabled || false) {
            await window.electronAPI.startSslProxy(project);
          }
        } catch (err) {
          console.error('Error starting dispatcher:', err);
        }
      } else {
        console.warn('Publisher did not start in time, Dispatcher not started.');
      }
    } catch (error) {
      console.error('Error starting dispatcher:', error);
    }
  };

  const handleDebugAll = async () => {
    try {
      await Promise.all([
        window.electronAPI.startAemInstance(project, 'author', true),
        window.electronAPI.startAemInstance(project, 'publisher', true)
      ]);
      await handleStartDispatcherAfterPublisher();
      
    } catch (error) {
      console.error('Error starting all instances in debug mode:', error);
    }
  };

  const handleStopAll = async () => {
    try {
      await Promise.all([
        window.electronAPI.stopAemInstance(project, 'author'),
        window.electronAPI.stopAemInstance(project, 'publisher'),
        window.electronAPI.stopDispatcher(project),
        project.settings?.https?.enabled || false ? window.electronAPI.stopSslProxy(project) : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error stopping all instances:', error);
    }
  };

  const handleStartAuthor = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'author');
    } catch (error) {
      console.error('Error starting author instance:', error);
    }
  };

  const handleDebugAuthor = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'author', true);
    } catch (error) {
      console.error('Error starting author instance in debug mode:', error);
    }
  };

  const handleStopAuthor = async () => {
    try {
      await window.electronAPI.stopAemInstance(project, 'author');
    } catch (error) {
      console.error('Error stopping author instance:', error);
    }
  };

  const handleStartPublisher = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'publisher');
    } catch (error) {
      console.error('Error starting publisher instance:', error);
    }
  };

  const handleDebugPublisher = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'publisher', true);
    } catch (error) {
      console.error('Error starting publisher instance in debug mode:', error);
    }
  };

  const handleStopPublisher = async () => {
    try {
      await window.electronAPI.stopAemInstance(project, 'publisher');
    } catch (error) {
      console.error('Error stopping publisher instance:', error);
    }
  };

  const handleOpenAuthor = async () => {
    try {
              await window.electronAPI.openUrl(`http://localhost:${project.settings?.author?.port}`);
    } catch (error) {
      console.error('Error opening author URL:', error);
    }
  };

  const handleOpenPublisher = async () => {
    try {
              await window.electronAPI.openUrl(`http://localhost:${project.settings?.publisher?.port}`);
    } catch (error) {
      console.error('Error opening publisher URL:', error);
    }
  };

  const handleOpenDispatcher = async () => {
    try {
              await window.electronAPI.openUrl(`http://localhost:${project.settings?.dispatcher?.port}`);
    } catch (error) {
      console.error('Error opening dispatcher URL:', error);
    }
  };

  const handleStartDispatcher = async () => {
    try {
      await window.electronAPI.startDispatcher(project);
    } catch (error) {
      console.error('Error starting dispatcher:', error);
    }
  };

  const handleStopDispatcher = async () => {
    try {
      await window.electronAPI.stopDispatcher(project);
    } catch (error) {
      console.error('Error stopping dispatcher:', error);
    }
  };

  const handleStartSslProxy = async () => {
    if (!project.settings?.https?.enabled || false) {
      console.error('SSL proxy is not enabled in settings');
      return;
    }
    try {
      await window.electronAPI.startSslProxy(project);
    } catch (error) {
      console.error('Error starting SSL proxy:', error);
    }
  };

  const handleStopSslProxy = async () => {
    if (!project.settings?.https?.enabled || false) {
      console.error('SSL proxy is not enabled in settings');
      return;
    }
    try {
      await window.electronAPI.stopSslProxy(project);
    } catch (error) {
      console.error('Error stopping SSL proxy:', error);
    }
  };



  const sectionStyles = {
    padding: '12px',
    background: 'none',
  };

  const disabledSectionStyles = {
    padding: '12px',
    background: 'none',
    opacity: 0.5,
  };

  const buttonStyles = {
    root: { 
      height: 30,
      width: 30,
      padding: 0,
    }
  };

  const secondButtonStyles = {
    root: { 
      height: 30,
      padding: '0 12px',
    }
  };

  return (
    <>
      <Group align="flex-start" gap="md" style={{ marginTop: '4px' }}>
        
        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">All</Text>
            <Group>
            <Button.Group>
              <Tooltip label="Start all">
                <Button 
                  color="green" 
                  variant="filled" 
                  size="xs"
                  styles={buttonStyles}
                  onClick={handleStartAll}
                  disabled={isAuthorRunning && isPublisherRunning && isDispatcherRunning}
                >
                  <IconPlayerPlay size={16} />
                </Button>
              </Tooltip><Tooltip label="Debug all">
                  <Button 
                    color="cyan" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleDebugAll}
                    disabled={isAuthorRunning && isPublisherRunning && isDispatcherRunning}
                  >
                    <IconBug size={16} />
                  </Button>
                </Tooltip>
              
              <Tooltip label="Stop all">
                <Button 
                  color="red" 
                  variant="filled" 
                  size="xs"
                  styles={buttonStyles}
                  onClick={handleStopAll}
                  disabled={!isAuthorRunning && !isPublisherRunning && !isDispatcherRunning}
                >
                  <IconPlayerStop size={16} />
                </Button>
              </Tooltip>
            </Button.Group>
            
            <Tooltip label="Kill all">
              <Button 
                color="orange" 
                variant="filled" 
                size="xs"
                styles={buttonStyles}
                onClick={handleKillAll}
              >
                <IconSkull size={16} />
              </Button>
            </Tooltip>
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500} c="dimmed">Author</Text>
              <Badge variant="light" color={isAuthorRunning ? "green" : "red"} size="sm">
                {isAuthorDebugging && (
                  <IconBug size={14} style={{ marginTop: '3px', marginBottom: '-3px' }} />
                )} 
                {isAuthorRunning && authorPid ? ` PID: ${authorPid}` : " STOPPED"}
              </Badge>

            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start author">
                  <Button 
                    color="green" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleStartAuthor}
                    disabled={isAuthorRunning}
                  >
                    <IconPlayerPlay size={16} />
                  </Button>
                </Tooltip>
                <Tooltip label="Debug author">
                  <Button 
                    color="cyan" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleDebugAuthor}
                    disabled={isAuthorRunning}
                  >
                    <IconBug size={16} />
                  </Button>
                </Tooltip>

                <Tooltip label="Stop author">
                  <Button
                    color="red" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleStopAuthor}
                    disabled={!isAuthorRunning}
                  >
                    <IconPlayerStop size={16} />
                  </Button>
                </Tooltip>
              </Button.Group>

              <Tooltip label="Open author">
                  <Button
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleOpenAuthor}
                    disabled={!isAuthorRunning}
                  >
                    <IconBrowser size={16} />
                  </Button>
                </Tooltip>
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500} c="dimmed">Publisher</Text>
              <Badge variant="light" color={isPublisherRunning ? "green" : "red"} size="sm">
              {isPublisherDebugging && (
                  <IconBug size={14} style={{ marginTop: '3px', marginBottom: '-3px' }} />
                )} 
                {isPublisherRunning && publisherPid ? ` PID: ${publisherPid}` : " STOPPED"}
              </Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start publisher">
                  <Button 
                    color="green" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleStartPublisher}
                    disabled={isPublisherRunning}
                  >
                    <IconPlayerPlay size={16} />
                  </Button>
                </Tooltip>
                <Tooltip label="Debug publisher">
                  <Button 
                    color="cyan" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleDebugPublisher}
                    disabled={isPublisherRunning}
                  >
                    <IconBug size={16} />
                  </Button>
                </Tooltip>

                <Tooltip label="Stop publisher">
                  <Button
                    color="red" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleStopPublisher}
                    disabled={!isPublisherRunning}
                  >
                    <IconPlayerStop size={16} />
                  </Button>
                </Tooltip>
              </Button.Group>

              <Button.Group>
                <Tooltip label="Open publisher">
                  <Button
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleOpenPublisher}
                    disabled={!isPublisherRunning}
                  >
                    <IconBrowser size={16} />
                  </Button>
                </Tooltip>
                </Button.Group>
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />


        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500} c="dimmed">Dispatcher</Text>
              <Badge variant="light" color={isDispatcherRunning ? "green" : "red"} size="sm">
                {isDispatcherRunning ? "Running" : "Stopped"}
              </Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start dispatcher">
                  <Button 
                    color="green" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleStartDispatcher}
                    disabled={isDispatcherRunning}
                  >
                    <IconPlayerPlay size={16} />
                  </Button>
                </Tooltip>

                <Tooltip label="Stop dispatcher">
                  <Button
                    color="red" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleStopDispatcher}
                    disabled={!isDispatcherRunning}
                  >
                    <IconPlayerStop size={16} />
                  </Button>
                </Tooltip>
              </Button.Group>

              <Tooltip label="Open dispatcher">
                <Button
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={buttonStyles}
                  onClick={handleOpenDispatcher}
                  disabled={!isDispatcherRunning}
                >
                  <IconBrowser size={16} />
                </Button>
              </Tooltip>
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        {project.settings?.https?.enabled && (
          <Paper style={sectionStyles}>
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">SSL Proxy</Text>
              <Group gap="xs">
                <Button.Group>
                  <Tooltip label="Start SSL Proxy">
                    <Button 
                      color="green" 
                      variant="filled"  
                      size="xs"
                      styles={buttonStyles}
                      onClick={handleStartSslProxy}
                      disabled={isSslProxyRunningState}
                    >
                      <IconPlayerPlay size={16} />    
                    </Button>
                  </Tooltip>
                  <Tooltip label="Stop SSL Proxy">
                    <Button 
                      color="red" 
                      variant="filled" 
                      size="xs"
                      styles={buttonStyles}
                      onClick={handleStopSslProxy}
                      disabled={!isSslProxyRunningState}
                    >
                      <IconPlayerStop size={16} />
                    </Button>
                  </Tooltip>
                </Button.Group>
              </Group>
            </Stack>
          </Paper>
        )}

        {project.settings?.https?.enabled && <Divider orientation="vertical" />}

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">Other</Text>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Settings">
                  <Button 
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={secondButtonStyles}
                    onClick={() => setShowSettings(true)}
                  >
                    <IconSettings size={16} />
                  </Button>
                </Tooltip>
              <Tooltip label="Automation">
                <Button 
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={secondButtonStyles}
                  onClick={() => setShowAutomation(true)}
                >
                  <IconRobot size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Backup & Restore">
                <Button
                  color="blue"
                  variant="filled"
                  size="xs"
                  styles={secondButtonStyles}
                  disabled={isAuthorRunning || isPublisherRunning || isDispatcherRunning}
                  onClick={() => setShowBackup(true)}
                >
                  <IconDeviceFloppy size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Package Manager">
                <Button 
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={secondButtonStyles}
                  disabled={!isAuthorRunning && !isPublisherRunning}
                  onClick={() => setShowPackageManager(true)}
                >
                  <IconPackage size={16} />
                </Button>
              </Tooltip>
             
              </Button.Group>
            </Group>
          </Stack>
        </Paper>
        <Divider orientation="vertical" />

        <Paper style={project.settings?.dev?.path ? sectionStyles : disabledSectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">AEM Dev Project</Text>
            <Button.Group>
              <Tooltip label={!project.settings?.dev?.path ? "Configure dev path in settings" : "Open files in Finder"}>
                <Button 
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={secondButtonStyles}
                  disabled={!project.settings?.dev?.path}
                  onClick={async () => {
                    try {
                      await window.electronAPI.openDevProject(project, 'files');
                    } catch (error) {
                      console.error('Error opening files:', error);
                    }
                  }}
                >
                  <IconFolder size={16} />
                </Button>
              </Tooltip>
              <Tooltip label={!project.settings?.dev?.path ? "Configure dev path in settings" : "Open in terminal"}>
                <Button 
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={secondButtonStyles}
                  disabled={!project.settings?.dev?.path}
                  onClick={async () => {
                    try {
                      await window.electronAPI.openDevProject(project, 'terminal');
                    } catch (error) {
                      console.error('Error opening terminal:', error);
                    }
                  }}
                >
                  <IconTerminal2 size={16} />
                </Button>
              </Tooltip>
              <Tooltip label={!project.settings?.dev?.path ? "Configure dev path in settings" : "Open in editor"}>
                <Button 
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={secondButtonStyles}
                  disabled={!project.settings?.dev?.path}
                  onClick={async () => {
                    try {
                      await window.electronAPI.openDevProject(project, 'editor');
                    } catch (error) {
                      console.error('Error opening editor:', error);
                    }
                  }}
                >
                  <IconCode size={16} />
                </Button>
              </Tooltip>
            </Button.Group>
          </Stack>
        </Paper>

      </Group>

      <Modal
        opened={showKillAllConfirm}
        onClose={() => setShowKillAllConfirm(false)}
        title="Confirm Kill All Instances"
        size="md"
      >
        <Stack>
          <Text size="sm">
            This action will:
          </Text>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Hard kill all processes containing "quickstart" in their name</li>
            <li>This will affect all AEM instances or other processes with "quickstart" in their name, regardless of who started them</li>
            <li>Hard killing your Dispatcher by stopping all Docker instances running on your Dispatcher port</li>
          </ul>
          <Text size="sm" c="red" mt="md">
            Are you sure you want to proceed?
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setShowKillAllConfirm(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={confirmKillAll}>
              Kill All Instances
            </Button>
          </Group>
        </Stack>
      </Modal>
      
      <SettingsModal
        opened={showSettings}
        onClose={() => setShowSettings(false)}
        project={project}
        onProjectUpdated={(updatedProject) => {
          // Notify parent component about the updated project
          if (onProjectUpdated) {
            onProjectUpdated(updatedProject);
          }
        }}
      />
      <BackupModal
        opened={showBackup}
        onClose={() => setShowBackup(false)}
        project={project}
      />
      <AutomationModal
        opened={showAutomation}
        onClose={() => setShowAutomation(false)}
        project={project}
        isAuthorRunning={isAuthorRunning}
        isPublisherRunning={isPublisherRunning}
        isDispatcherRunning={isDispatcherRunning}
        autoStartTask={autoStartTask}
        onAutoTaskStarted={handleAutoTaskStarted}
      />
      <PackageManagerModal
        opened={showPackageManager}
        onClose={() => setShowPackageManager(false)}
        project={project}
      />
    </>
  );
}; 