import React, { useState } from 'react';
import { Group, Button, Modal, Stack, Text } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload } from '@tabler/icons-react';
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

  return (
    <>
      <Group p="xs" gap="xs">
        <Button 
          color="blue" 
          variant="filled" 
          size="xs"
          leftSection={<IconPlayerPlay size={16} />}
          styles={{ root: { height: 30 } }}
        >
          Start
        </Button>
        
        <Button 
          color="dark" 
          variant="outline" 
          size="xs"
          leftSection={<IconPlayerStop size={16} />}
          styles={{ root: { height: 30 } }}
        >
          Stop
        </Button>
        
        <Button 
          color="blue" 
          variant="outline" 
          size="xs"
          leftSection={<IconDownload size={16} />}
          styles={{ root: { height: 30 } }}
          onClick={handleInstall}
          loading={isInstalling}
        >
          Install
        </Button>
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