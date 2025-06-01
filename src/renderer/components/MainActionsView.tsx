import React, { useState, useEffect } from 'react';
import { Group, Button, Modal, Stack, Text, Paper, Tooltip, Badge, Divider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconSkull, IconPackage, IconSettings, IconBug, IconBrowser, IconBrowserPlus, IconMaximize, IconColumns, IconBrowserCheck, IconColumns3, IconColumns1, IconDeviceFloppy } from '@tabler/icons-react';
import { InstallService } from '../services/installService';
import { Project } from '../../types/Project';
import { SettingsModal } from './SettingsModal';
import { BackupModal } from './BackupModal';

interface MainActionsViewProps {
  project: Project;
  viewMode: 'tabs' | 'columns';
  setViewMode: (mode: 'tabs' | 'columns') => void;
}

export const MainActionsView: React.FC<MainActionsViewProps> = ({ project, viewMode, setViewMode }) => {
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);
  const [showKillAllConfirm, setShowKillAllConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isAuthorRunning, setIsAuthorRunning] = useState(false);
  const [isPublisherRunning, setIsPublisherRunning] = useState(false);
  const [isDispatcherRunning, setIsDispatcherRunning] = useState(false);
  const [authorPid, setAuthorPid] = useState<number | null>(null);
  const [publisherPid, setPublisherPid] = useState<number | null>(null);

  // Check instance status on mount and periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [authorRunning, publisherRunning, authorPidValue, publisherPidValue, dispatcherStatus] = await Promise.all([
          window.electronAPI.isAemInstanceRunning(project, 'author'),
          window.electronAPI.isAemInstanceRunning(project, 'publisher'),
          window.electronAPI.getAemInstancePid(project, 'author'),
          window.electronAPI.getAemInstancePid(project, 'publisher'),
          window.electronAPI.getDispatcherStatus(project)
        ]);
        setIsAuthorRunning(authorRunning);
        setIsPublisherRunning(publisherRunning);
        setAuthorPid(authorPidValue);
        setPublisherPid(publisherPidValue);
        setIsDispatcherRunning(dispatcherStatus.isRunning);
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

  const handleInstall = () => {
    setShowInstallConfirm(true);
  };

  const confirmInstall = async () => {
    try {
      setIsInstalling(true);
      setShowInstallConfirm(false);
      await InstallService.installAEM(project);
      // Add a small delay to ensure file system operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleKillAll = () => {
    setShowKillAllConfirm(true);
  };

  const confirmKillAll = async () => {
    try {
      await window.electronAPI.killAllAemInstances(project);
      setShowKillAllConfirm(false);
      setIsAuthorRunning(false);
      setIsPublisherRunning(false);
      setAuthorPid(null);
      setPublisherPid(null);
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
      setIsAuthorRunning(true);
      setIsPublisherRunning(true);

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
          setIsDispatcherRunning(true);
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
        window.electronAPI.startAemInstance(project, 'author', { debug: true }),
        window.electronAPI.startAemInstance(project, 'publisher', { debug: true })
      ]);
      setIsAuthorRunning(true);
      setIsPublisherRunning(true);
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
        window.electronAPI.stopDispatcher(project)
      ]);
      setIsAuthorRunning(false);
      setIsPublisherRunning(false);
      setAuthorPid(null);
      setPublisherPid(null);
    } catch (error) {
      console.error('Error stopping all instances:', error);
    }
  };

  const handleStartAuthor = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'author');
      setIsAuthorRunning(true);
    } catch (error) {
      console.error('Error starting author instance:', error);
    }
  };

  const handleDebugAuthor = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'author', { debug: true });
      setIsAuthorRunning(true);
    } catch (error) {
      console.error('Error starting author instance in debug mode:', error);
    }
  };

  const handleStopAuthor = async () => {
    try {
      await window.electronAPI.stopAemInstance(project, 'author');
      setIsAuthorRunning(false);
      setAuthorPid(null);
    } catch (error) {
      console.error('Error stopping author instance:', error);
    }
  };

  const handleStartPublisher = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'publisher', {});
      setIsPublisherRunning(true);
    } catch (error) {
      console.error('Error starting publisher instance:', error);
    }
  };

  const handleDebugPublisher = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'publisher', { debug: true });
      setIsPublisherRunning(true);
    } catch (error) {
      console.error('Error starting publisher instance in debug mode:', error);
    }
  };

  const handleStopPublisher = async () => {
    try {
      await window.electronAPI.stopAemInstance(project, 'publisher');
      setIsPublisherRunning(false);
      setPublisherPid(null);
    } catch (error) {
      console.error('Error stopping publisher instance:', error);
    }
  };

  const handleOpenAuthor = async () => {
    try {
      await window.electronAPI.openUrl('http://localhost:4502');
    } catch (error) {
      console.error('Error opening author URL:', error);
    }
  };

  const handleOpenPublisher = async () => {
    try {
      await window.electronAPI.openUrl('http://localhost:4503');
    } catch (error) {
      console.error('Error opening publisher URL:', error);
    }
  };

  const handleOpenPublisherAdmin = async () => {
    try {
      await window.electronAPI.openUrl('http://localhost:4503/libs/granite/core/content/login.html');
    } catch (error) {
      console.error('Error opening publisher URL:', error);
    }
  };

  const handleOpenDispatcher = async () => {
    try {
      await window.electronAPI.openUrl('http://localhost:80');
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

  const sectionStyles = {
    padding: '12px',
    background: 'none',
  };

  const buttonStyles = {
    root: { 
      height: 30,
      width: 30,
      padding: 0,
    }
  };

  const installButtonStyles = {
    root: { 
      height: 30,
      padding: '0 12px',
    }
  };

  return (
    <>
      <Group align="flex-start" gap="md">
        
        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">All</Text>
            <Button.Group>
              <Tooltip label="Start all">
                <Button 
                  color="blue" 
                  variant="filled" 
                  size="xs"
                  styles={buttonStyles}
                  onClick={handleStartAll}
                  disabled={isAuthorRunning && isPublisherRunning}
                >
                  <IconPlayerPlay size={16} />
                </Button>
              </Tooltip><Tooltip label="Debug all">
                  <Button 
                    color="violet" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleDebugAll}
                    disabled={isAuthorRunning && isPublisherRunning}
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
                  disabled={!isAuthorRunning && !isPublisherRunning}
                >
                  <IconPlayerStop size={16} />
                </Button>
              </Tooltip>
              
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
            </Button.Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500} c="dimmed">Author</Text>
              <Badge variant="light" color={isAuthorRunning ? "green" : "red"} size="sm">
                {isAuthorRunning && authorPid ? `PID: ${authorPid}` : "STOPPED"}
              </Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start author">
                  <Button 
                    color="blue" 
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
                    color="violet" 
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
                    color="green" 
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
                {isPublisherRunning && publisherPid ? `PID: ${publisherPid}` : "STOPPED"}
              </Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start publisher">
                  <Button 
                    color="blue" 
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
                    color="violet" 
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
                    color="green" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    onClick={handleOpenPublisher}
                    disabled={!isPublisherRunning}
                  >
                    <IconBrowser size={16} />
                  </Button>
                </Tooltip>

                <Tooltip label="Open publisher admin">
                    <Button
                      color="green" 
                      variant="filled" 
                      size="xs"
                      styles={buttonStyles}
                      onClick={handleOpenPublisherAdmin}
                      disabled={!isPublisherRunning}
                    >
                      <IconBrowserCheck size={16} />
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
                    color="blue" 
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
                  color="green" 
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

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">View</Text>
            <Button.Group>
              <Tooltip label="Tabs">
                <Button
                  color={viewMode === 'tabs' ? 'blue' : 'gray'}
                  variant={viewMode === 'tabs' ? 'filled' : 'light'}
                  size="xs"
                  styles={installButtonStyles}
                  onClick={() => setViewMode('tabs')}
                >
                  <IconColumns1 size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Columns">
                <Button
                  color={viewMode === 'columns' ? 'blue' : 'gray'}
                  variant={viewMode === 'columns' ? 'filled' : 'light'}
                  size="xs"
                  styles={installButtonStyles}
                  onClick={() => setViewMode('columns')}
                >
                  <IconColumns3 size={16} />
                </Button>
              </Tooltip>
            </Button.Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">Other</Text>
            <Button.Group>
              <Tooltip label="Settings">
                <Button 
                  color="green" 
                  variant="filled" 
                  size="xs"
                  styles={installButtonStyles}
                  onClick={() => setShowSettings(true)}
                >
                  <IconSettings size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Backup & Restore">
                <Button
                  color="blue"
                  variant="filled"
                  size="xs"
                  styles={installButtonStyles}
                  disabled={isAuthorRunning || isPublisherRunning || isDispatcherRunning}
                  onClick={() => setShowBackup(true)}
                >
                  <IconDeviceFloppy size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Reinstall">
                <Button 
                  color="orange" 
                  variant="filled" 
                  size="xs"
                  styles={installButtonStyles}
                  onClick={handleInstall}
                  loading={isInstalling}
                  disabled={isAuthorRunning || isPublisherRunning}
                >
                  <IconPackage size={16} />
                </Button>
              </Tooltip>
            </Button.Group>
          </Stack>
        </Paper>

      </Group>

      <Modal
        opened={showInstallConfirm}
        onClose={() => setShowInstallConfirm(false)}
        title="Confirm Installation"
        size="md"
      >
        <Stack>
          <Text size="sm">
            This action will:
          </Text>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Delete existing folders (if any)</li>
            <li>Create new folders: author, publisher, dispatcher, install</li>
            <li>Copy license.properties to author and publisher folders</li>
            <li>Unzip SDK package to install folder</li>
          </ul>
          <Text size="sm" c="red" mt="md">
            Are you sure you want to proceed?
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setShowInstallConfirm(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={confirmInstall}>
              Proceed with Installation
            </Button>
          </Group>
        </Stack>
      </Modal>

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
      />
      <BackupModal
        opened={showBackup}
        onClose={() => setShowBackup(false)}
        project={project}
      />
    </>
  );
}; 