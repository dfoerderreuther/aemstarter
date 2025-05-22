import React, { useState, useEffect, useRef } from 'react';
import { AppShell, Tabs, Group, Button, Text, Switch, Box, ScrollArea, Code, Divider, Stack, Modal, ActionIcon } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconFolder, IconEye, IconExternalLink, IconTrash, IconRefresh, IconEyeOff } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { FileTreeView, FileTreeViewRef } from './FileTreeView';
import { InstallService } from '../services/installService';
import { ClearService } from '../services/clearService';

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
  const [showHiddenFiles, setShowHiddenFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileTreeRef = useRef<FileTreeViewRef>(null);
  
  const handleFileSelect = async (filePath: string) => {
    setSelectedFile(filePath);
    
    try {
      const dirPath = getDirname(filePath);
      const entries = await window.electronAPI.readDirectory(dirPath, true);
      const fileEntry = entries.find(entry => entry.path === filePath);
      
      if (fileEntry && fileEntry.isFile) {
        try {
          const result = await window.electronAPI.readFile(filePath);
          
          if (result.error) {
            console.error('Error reading file:', result.error);
            setFileContent(`Error: ${result.error}`);
          } else {
            setFileContent(result.content || '');
          }
        } catch (readError) {
          console.error('Exception while reading file:', readError);
          setFileContent(`Error reading file: ${readError instanceof Error ? readError.message : String(readError)}`);
        }
      } else {
        setFileContent(`Selected directory: ${filePath}`);
      }
    } catch (error) {
      console.error('Error in handleFileSelect:', error);
      setFileContent(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleInstall = async () => {
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

  useEffect(() => {
    setFileContent("Initial test content - This should display when the component first loads.");
  }, []);

  return (
    <AppShell
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding={0}
      styles={{
        main: {
          backgroundColor: '#1A1B1E',
          padding: 0
        }
      }}
    >
      <AppShell.Navbar p={0} bg="#25262b">

        <ScrollArea h="calc(100vh - 36px)" scrollbarSize={6}>
          <Box>
            <FileTreeView 
              rootPath={project.folderPath} 
              showHidden={showHiddenFiles}
              onFileSelect={handleFileSelect}
            />
          </Box>
        </ScrollArea>
      </AppShell.Navbar>

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
          
          <Box style={{ flex: '0 0 40%', overflow: 'auto' }}>
            <Tabs 
              defaultValue="author" 
              variant="outline"
            >
              <Tabs.List>
                <Tabs.Tab value="author">Author</Tabs.Tab>
                <Tabs.Tab value="publisher">Publisher</Tabs.Tab>
                <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
              </Tabs.List>
              
              <Tabs.Panel value="author" p="md">
                Author content
              </Tabs.Panel>
              
              <Tabs.Panel value="publisher" p="md">
                Publisher content
              </Tabs.Panel>
              
              <Tabs.Panel value="dispatcher" p="md">
                Dispatcher content
              </Tabs.Panel>
            </Tabs>
          </Box>
          
          <Divider my="xs" />
          
          <Box style={{ flex: '1 1 60%', overflow: 'auto' }}>
            <Box p="xs">
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
            <ScrollArea h="calc(100% - 30px)">
              {fileContent ? (
                <Code block p="md" style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                  {fileContent}
                </Code>
              ) : (
                <Text p="md" size="sm" c="dimmed">
                  Select a file to view its content
                </Text>
              )}
            </ScrollArea>
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