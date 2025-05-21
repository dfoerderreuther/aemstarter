import React, { useState, useEffect } from 'react';
import { AppShell, Tabs, Group, Button, Text, Switch, Box, ScrollArea, Code, Divider, Stack, Modal } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconFolder, IconEye, IconExternalLink } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { FileTreeView } from './FileTreeView';

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
  const [isInstalling, setIsInstalling] = useState(false);
  
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

      // Check if license.properties exists
      const licensePath = project.licensePath;
      const licenseExists = await window.electronAPI.checkFileExists(licensePath);
      if (!licenseExists) {
        throw new Error('license.properties file not found ' + licensePath);
      }

      // Check if SDK package exists
      const sdkPath = project.aemSdkPath;
      const sdkExists = await window.electronAPI.checkFileExists(sdkPath);
      if (!sdkExists) {
        throw new Error('aem-sdk.zip file not found in project folder');
      }

      // Create required folders
      const folders = ['author', 'publish', 'dispatcher', 'install'];
      for (const folder of folders) {
        const folderPath = `${project.folderPath}/${folder}`;
        try {
          await window.electronAPI.createDirectory(folderPath);
        } catch (error) {
          console.error(`Error creating directory ${folder}:`, error);
          // Continue with other folders even if one fails
        }
      }

      // Copy license.properties to author and publish
      try {
        await window.electronAPI.copyFile(licensePath, `${project.folderPath}/author/license.properties`);
        await window.electronAPI.copyFile(licensePath, `${project.folderPath}/publish/license.properties`);
      } catch (error) {
        console.error('Error copying license file:', error);
        throw new Error('Failed to copy license.properties to author and publish folders');
      }

      // Unzip SDK package to install folder
      try {
        await window.electronAPI.unzipFile(sdkPath, `${project.folderPath}/install`);
      } catch (error) {
        console.error('Error unzipping SDK:', error);
        throw new Error('Failed to unzip SDK package');
      }

      // Show success message or refresh the file tree
      // You might want to add a notification system here
    } catch (error) {
      console.error('Installation failed:', error);
      // Show error message to user
      setFileContent(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsInstalling(false);
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
        <Group p="xs" justify="space-between">
          <Group gap="xs">
            <IconFolder size={16} />
            <Text size="sm" fw={500}>Project Files</Text>
          </Group>
          <Switch 
            size="xs"
            onLabel={<IconEye size={12} />}
            offLabel={<IconEye size={12} />}
            checked={showHiddenFiles}
            onChange={(event) => setShowHiddenFiles(event.currentTarget.checked)}
            label="Show hidden"
            labelPosition="left"
          />
        </Group>
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
    </AppShell>
  );
}; 