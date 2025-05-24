import React, { useState } from 'react';
import { AppShell, Tabs, Group, Button, Text, Stack, Modal, Box } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconTrash } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { InstallService } from '../services/installService';
import { ClearService } from '../services/clearService';
import { AemInstanceView } from './AemInstanceView';
import { FilesView } from './FilesView';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = async () => {
    try {
      setIsClearing(true);
      setShowClearConfirm(false);
      await ClearService.clearAEM(project);
      // Add a small delay to ensure file system operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Clearing failed:', error);
    } finally {
      setIsClearing(false);
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

            <Button 
              color="red" 
              variant="outline" 
              size="xs"
              leftSection={<IconTrash size={16} />}
              styles={{ root: { height: 30 } }}
              onClick={handleClear}
              loading={isClearing}
            >
              Clear
            </Button>
          </Group>
          
          <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <Tabs 
              defaultValue="files" 
              variant="outline"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <Tabs.List>
                <Tabs.Tab value="files">Files</Tabs.Tab>
                <Tabs.Tab value="author">Author</Tabs.Tab>
                <Tabs.Tab value="publisher">Publisher</Tabs.Tab>
                <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
              </Tabs.List>
              
              <Tabs.Panel value="files" style={{ flex: 1, minHeight: 0 }}>
                <FilesView rootPath={project.folderPath} />
              </Tabs.Panel>
              
              <Tabs.Panel value="author" p="md">
                <AemInstanceView instance="author" project={project} />
              </Tabs.Panel>
              
              <Tabs.Panel value="publisher" p="md">
                <AemInstanceView instance="publisher" project={project} />
              </Tabs.Panel>
              
              <Tabs.Panel value="dispatcher" p="md">
                Dispatcher content
              </Tabs.Panel>
            </Tabs>
          </Box>
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

      <Modal
        opened={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Confirm Clearing"
        size="md"
      >
        <Stack>
          <Text size="sm">
            This action will:
          </Text>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Delete all AEM folders: author, publish, dispatcher, install</li>
            <li>This action cannot be undone</li>
          </ul>
          <Text size="sm" c="red" mt="md">
            Are you sure you want to proceed?
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={confirmClear}>
              Proceed with Clearing
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
}; 