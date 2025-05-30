import React, { useState, useEffect } from 'react';
import { Modal, Stack, TextInput, Group, Button } from '@mantine/core';
import { Project } from '../../types/Project';

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
    if (!newProjectName.trim() || !aemSdkPath || !licensePath) return;
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

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Create New Project"
      centered
      overlayProps={{ opacity: 0.55, blur: 3 }}
    >
      <Stack gap="md">
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
            value={aemSdkPath}
            readOnly
            style={{ flex: 1 }}
            disabled={creating}
          />
          <Button 
            onClick={handleSelectAemSdk}
            disabled={creating}
            style={{ marginTop: 'auto' }}
          >
            Browse
          </Button>
        </Group>
        <Group>
          <TextInput
            label="License File"
            placeholder="Select license properties file"
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
            disabled={!newProjectName.trim() || !aemSdkPath || !licensePath}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}; 