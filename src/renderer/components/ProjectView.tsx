import React, { useState } from 'react';
import { AppShell, Tabs, Group, Button, Text, Stack, Modal, Box } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { InstallService } from '../services/installService';
import { AemInstanceView } from './AemInstanceView';
import { FilesView } from './FilesView';
import { DispatcherView } from './DispatcherView';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);

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
    <AppShell
      padding={0}
      styles={{
        main: {
          backgroundColor: '#1A1B1E',
          padding: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <AppShell.Main>
        <Stack gap={0} style={{ height: '100vh', minHeight: '100vh' }}>
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

          <Tabs defaultValue="author" style={{ flex: 1 }}>
            <Tabs.List>
              <Tabs.Tab value="author">Author</Tabs.Tab>
              <Tabs.Tab value="publish">Publish</Tabs.Tab>
              <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
              <Tabs.Tab value="files">Files</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="author" style={{ height: 'calc(100vh - 120px)' }}>
              <AemInstanceView instance="author" project={project} />
            </Tabs.Panel>

            <Tabs.Panel value="publish" style={{ height: 'calc(100vh - 120px)' }}>
              <AemInstanceView instance="publisher" project={project} />
            </Tabs.Panel>

            <Tabs.Panel value="dispatcher" style={{ height: 'calc(100vh - 120px)' }}>
              <DispatcherView />
            </Tabs.Panel>

            <Tabs.Panel value="files" style={{ height: 'calc(100vh - 120px)' }}>
              <FilesView rootPath={project.folderPath} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </AppShell.Main>

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
    </AppShell>
  );
}; 