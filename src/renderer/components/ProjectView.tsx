import React, { useState, useEffect, useRef } from 'react';
import { AppShell, Tabs, Group, Button, Text, Switch, Box, ScrollArea, Code, Divider, Stack, Modal, ActionIcon, Grid } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconFolder, IconEye, IconExternalLink, IconTrash, IconRefresh, IconEyeOff } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { FileTreeView, FileTreeViewRef } from './FileTreeView';
import { InstallService } from '../services/installService';
import { ClearService } from '../services/clearService';
import { AemInstanceView } from './AemInstanceView';

interface ProjectViewProps {
  project: Project;
}

// File path utility functions for browser environment
// These replicate Node.js path module functionality that's not available in the browser
function getBasename(filepath: string): string {
  // Handle both Windows and Unix-style paths
  return filepath.split(/[\\/]/).pop() || '';
}

function getDirname(filepath: string): string {
  // Handle both Windows and Unix-style paths
  const parts = filepath.split(/[\\/]/);
  parts.pop(); // Remove the last part (filename)
  return parts.join('/') || '.';
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileTreeRef = useRef<FileTreeViewRef>(null);
  
  const handleFileSelect = async (filePath: string) => {
    try {
      setSelectedFile(filePath);
      const result = await window.electronAPI.readFile(filePath);
      if (result.error) {
        setFileContent(`Error reading file: ${result.error}`);
      } else {
        setFileContent(result.content || null);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setFileContent(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
      await fileTreeRef.current?.refresh();
    } catch (error) {
      console.error('Installation failed:', error);
      setFileContent(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
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
      await fileTreeRef.current?.refresh();
    } catch (error) {
      console.error('Clearing failed:', error);
      setFileContent(`Clearing failed: ${error instanceof Error ? error.message : String(error)}`);
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
          padding: 0
        }
      }}
    >
      <AppShell.Main>
        <Stack gap={0} style={{ height: '100%' }}>
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
          
          <Box style={{ flex: 1, overflow: 'hidden' }}>
            <Tabs 
              defaultValue="files" 
              variant="outline"
              style={{ height: '100%' }}
            >
              <Tabs.List>
                <Tabs.Tab value="files">Files</Tabs.Tab>
                <Tabs.Tab value="author">Author</Tabs.Tab>
                <Tabs.Tab value="publisher">Publisher</Tabs.Tab>
                <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
              </Tabs.List>
              
              <Tabs.Panel value="files" style={{ height: 'calc(100% - 36px)' }}>
                <Grid grow style={{ height: '100%', margin: 0 }}>
                  <Grid.Col span={4} style={{ height: '100%', padding: 0 }}>
                    <ScrollArea h="100%" scrollbarSize={6}>
                      <FileTreeView 
                        rootPath={project.folderPath} 
                        onFileSelect={handleFileSelect}
                        ref={fileTreeRef}
                      />
                    </ScrollArea>
                  </Grid.Col>
                  
                  <Grid.Col span={8} style={{ height: '100%', padding: 0, borderLeft: '1px solid #2C2E33' }}>
                    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box p="xs" style={{ borderBottom: '1px solid #2C2E33' }}>
                        <Group justify="space-between">
                          <Text size="xs" fw={700} c="dimmed">FILE CONTENT</Text>
                          {selectedFile && (
                            <Group>
                              <Text size="xs" fw={500}>
                                {getBasename(selectedFile)}
                              </Text>
                            </Group>
                          )}
                        </Group>
                      </Box>
                      <ScrollArea h="calc(100% - 37px)" scrollbarSize={6}>
                        {fileContent ? (
                          <Code block p="md" style={{ whiteSpace: 'pre-wrap' }}>
                            {fileContent}
                          </Code>
                        ) : (
                          <Text p="md" size="sm" c="dimmed">
                            Select a file to view its content
                          </Text>
                        )}
                      </ScrollArea>
                    </Box>
                  </Grid.Col>
                </Grid>
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