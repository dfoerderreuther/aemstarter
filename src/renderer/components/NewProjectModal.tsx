import React, { useState, useEffect } from 'react';
import { Modal, Stack, TextInput, Group, Button, Anchor } from '@mantine/core';
import { Project } from '../../types/Project';
import { SystemCheckView } from './SystemCheckView';

interface NewProjectModalProps {
  opened: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  opened,
  onClose,
  onProjectCreated,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [aemSdkPath, setAemSdkPath] = useState('');
  const [licensePath, setLicensePath] = useState('');

  // Helper function to extract filename from path
  const getFileName = (path: string) => {
    if (!path) return '';
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  // Load global settings when opening the modal
  useEffect(() => {
    if (opened) {
      const loadGlobalSettings = async () => {
        const globalSettings = await window.electronAPI.getGlobalSettings();
        if (globalSettings.aemSdkPath) {
          setAemSdkPath(globalSettings.aemSdkPath);
        }
        if (globalSettings.licensePath) {
          setLicensePath(globalSettings.licensePath);
        }
      };
      loadGlobalSettings();
    }
  }, [opened]);

  const handleClose = () => {
    setNewProjectName('');
    setAemSdkPath('');
    setLicensePath('');
    onClose();
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !aemSdkPath) return;
    setCreating(true);
    try {
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Project Folder',
        buttonLabel: 'Select Folder',
        message: 'Select a folder for your project or create a new one'
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const project = await window.electronAPI.createProject(
          newProjectName,
          result.filePaths[0],
          aemSdkPath,
          licensePath
        );
        
        onProjectCreated(project);
        handleClose();

        // Start the installation procedure
        try {
          await window.electronAPI.installAEM(project);
        } catch (error) {
          console.error('Failed to install AEM:', error);
        }
      }
    } catch (error) {
      // Show error message to user
      console.error('Failed to create project:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectAemSdk = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      title: 'Select AEM SDK',
      buttonLabel: 'Select File',
      message: 'Select the AEM SDK zip file',
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      setAemSdkPath(newPath);
      await window.electronAPI.setGlobalSettings({ aemSdkPath: newPath });
    }
  };

  const handleSelectLicense = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      title: 'Select License File',
      buttonLabel: 'Select File',
      message: 'Select the license properties file',
      filters: [{ name: 'Properties Files', extensions: ['properties'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      setLicensePath(newPath);
      await window.electronAPI.setGlobalSettings({ licensePath: newPath });
    }
  };

  const handleClearLicense = async () => {
    setLicensePath('');
    await window.electronAPI.setGlobalSettings({ licensePath: '' });
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Create New Project"
      centered
      size="lg"
      overlayProps={{ opacity: 0.55, blur: 3 }}
    >
      <Stack gap="md">
        <SystemCheckView />
        <TextInput
          label="Project Name"
          placeholder="Enter project name"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          size="md"
          required
          autoFocus
          disabled={creating}
        />
        <Group>
          <TextInput
            label="AEM SDK"
            placeholder="Select AEM SDK zip file"
            value={getFileName(aemSdkPath)}
            readOnly
            style={{ flex: 1 }}
            disabled={creating}
            title={aemSdkPath} // Show full path on hover
          />
          <Button 
            onClick={handleSelectAemSdk}
            disabled={creating}
            style={{ marginTop: 'auto' }}
          >
            Browse
          </Button>
        </Group>
        <Anchor
          onClick={() => window.electronAPI.openUrl("https://experience.adobe.com/#/downloads/content/software-distribution/en/aemcloud.html?fulltext=AEM*+SDK*&1_group.propertyvalues.property=.%2Fjcr%3Acontent%2Fmetadata%2Fdc%3AsoftwareType&1_group.propertyvalues.operation=equals&1_group.propertyvalues.0_values=software-type%3Atooling&orderby=%40jcr%3Acontent%2Fjcr%3AlastModified&orderby.sort=desc&layout=list&p.offset=0&p.limit=24")}
          size="sm"
          style={{ marginTop: '-8px', marginBottom: '8px', cursor: 'pointer' }}
        >
          Download AEM SDK from experience.adobe.com
        </Anchor>
        <Group>
          <TextInput
            label="License File (Optional)"
            placeholder="Select license properties file (optional)"
            value={licensePath}
            readOnly
            style={{ flex: 1 }}
            disabled={creating}
          />
          <Button 
            onClick={handleSelectLicense}
            disabled={creating}
            style={{ marginTop: 'auto' }}
          >
            Browse
          </Button>
          {licensePath && (
            <Button 
              onClick={handleClearLicense}
              disabled={creating}
              variant="outline"
              color="red"
              style={{ marginTop: 'auto' }}
            >
              ✕
            </Button>
          )}
        </Group>
        <Group justify="flex-end">
          <Button 
            variant="default" 
            onClick={handleClose} 
            disabled={creating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateProject} 
            loading={creating}
            disabled={!newProjectName.trim() || !aemSdkPath}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}; 