import React, { useState } from 'react';
import { Group, Button, Modal, Stack, Text, Paper, Tooltip, Badge, Divider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconSkull, IconPackage } from '@tabler/icons-react';
import { InstallService } from '../services/installService';
import { Project } from '../../types/Project';

interface MainActionsViewProps {
  project: Project;
}

export const MainActionsView: React.FC<MainActionsViewProps> = ({ project }) => {
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

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
                >
                  <IconPlayerPlay size={16} />
                </Button>
              </Tooltip>
              
              <Tooltip label="Stop all">
                <Button 
                  color="dark" 
                  variant="outline" 
                  size="xs"
                  styles={buttonStyles}
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
              <Badge variant="light" color="red" size="sm">232</Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start author">
                  <Button 
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
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
              <Badge variant="light" color="red" size="sm">232</Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start publish">
                  <Button 
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
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
              <Badge variant="light" color="red" size="sm">232</Badge>
            </Group>
            <Group gap="xs">
              <Button.Group>
                <Tooltip label="Start publish">
                  <Button 
                    color="blue" 
                    variant="filled" 
                    size="xs"
                    styles={buttonStyles}
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
                  Install
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
    </>
  );
}; 