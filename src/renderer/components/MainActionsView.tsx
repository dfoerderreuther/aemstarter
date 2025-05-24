import React, { useState, useEffect } from 'react';
import { Group, Button, Modal, Stack, Text, Paper, Tooltip, Badge, Divider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconSkull, IconPackage } from '@tabler/icons-react';
import { InstallService } from '../services/installService';
import { Project } from '../../types/Project';

interface MainActionsViewProps {
  project: Project;
}

export const MainActionsView: React.FC<MainActionsViewProps> = ({ project }) => {
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);
  const [showKillAllConfirm, setShowKillAllConfirm] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isAuthorRunning, setIsAuthorRunning] = useState(false);
  const [isPublisherRunning, setIsPublisherRunning] = useState(false);

  // Check instance status on mount and periodically
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [authorRunning, publisherRunning] = await Promise.all([
          window.electronAPI.isAemInstanceRunning(project, 'author'),
          window.electronAPI.isAemInstanceRunning(project, 'publisher')
        ]);
        setIsAuthorRunning(authorRunning);
        setIsPublisherRunning(publisherRunning);
      } catch (error) {
        console.error('Error checking instance status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
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
    } catch (error) {
      console.error('Failed to kill all instances:', error);
    }
  };

  const handleStartAll = async () => {
    try {
      await Promise.all([
        window.electronAPI.startAemInstance(project, 'author', {
          port: 4502,
          runmode: 'author,local',
          jvmOpts: '-server -Xmx2048m -XX:MaxPermSize=512M'
        }),
        window.electronAPI.startAemInstance(project, 'publisher', {
          port: 4503,
          runmode: 'publish,local',
          jvmOpts: '-server -Xmx2048m -XX:MaxPermSize=512M'
        })
      ]);
      setIsAuthorRunning(true);
      setIsPublisherRunning(true);
    } catch (error) {
      console.error('Error starting all instances:', error);
    }
  };

  const handleStopAll = async () => {
    try {
      await Promise.all([
        window.electronAPI.stopAemInstance(project, 'author'),
        window.electronAPI.stopAemInstance(project, 'publisher')
      ]);
      setIsAuthorRunning(false);
      setIsPublisherRunning(false);
    } catch (error) {
      console.error('Error stopping all instances:', error);
    }
  };

  const handleStartAuthor = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'author', {
        port: 4502,
        runmode: 'author,local',
        jvmOpts: '-server -Xmx2048m -XX:MaxPermSize=512M'
      });
      setIsAuthorRunning(true);
    } catch (error) {
      console.error('Error starting author instance:', error);
    }
  };

  const handleStopAuthor = async () => {
    try {
      await window.electronAPI.stopAemInstance(project, 'author');
      setIsAuthorRunning(false);
    } catch (error) {
      console.error('Error stopping author instance:', error);
    }
  };

  const handleStartPublisher = async () => {
    try {
      await window.electronAPI.startAemInstance(project, 'publisher', {
        port: 4503,
        runmode: 'publish,local',
        jvmOpts: '-server -Xmx2048m -XX:MaxPermSize=512M'
      });
      setIsPublisherRunning(true);
    } catch (error) {
      console.error('Error starting publisher instance:', error);
    }
  };

  const handleStopPublisher = async () => {
    try {
      await window.electronAPI.stopAemInstance(project, 'publisher');
      setIsPublisherRunning(false);
    } catch (error) {
      console.error('Error stopping publisher instance:', error);
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
                {isAuthorRunning ? "Running" : "Stopped"}
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
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500} c="dimmed">Publisher</Text>
              <Badge variant="light" color={isPublisherRunning ? "green" : "red"} size="sm">
                {isPublisherRunning ? "Running" : "Stopped"}
              </Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start publish">
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

                <Tooltip label="Stop publish">
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
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />


        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500} c="dimmed">Dispatcher</Text>
              <Badge variant="light" color="red" size="sm">
                "Not implemented"
              </Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start publish">
                  <Button 
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    disabled={true}
                  >
                    <IconPlayerPlay size={16} />
                  </Button>
                </Tooltip>

                <Tooltip label="Stop publish">
                  <Button
                    color="red" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
                    disabled={true}
                  >
                    <IconPlayerStop size={16} />
                  </Button>
                </Tooltip>
              </Button.Group>
            </Group>
          </Stack>
        </Paper>

        <Divider orientation="vertical" />

        <Paper style={sectionStyles}>
          <Stack gap="xs">
            <Text size="sm" fw={500} c="dimmed">Other</Text>
            <Button.Group>
              <Tooltip label="Install">
                <Button 
                  color="blue" 
                  variant="outline" 
                  size="xs"
                  styles={installButtonStyles}
                  onClick={handleInstall}
                  loading={isInstalling}
                  leftSection={<IconDownload size={16} />}
                >
                  Reinstall
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
            <li>Create new folders: author, publish, dispatcher, install</li>
            <li>Copy license.properties to author and publish folders</li>
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
    </>
  );
}; 