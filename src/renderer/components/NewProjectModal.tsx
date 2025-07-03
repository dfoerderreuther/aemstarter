import React, { useState, useEffect } from 'react';
import { Modal, Stack, TextInput, Group, Button, Anchor, Checkbox } from '@mantine/core';
import { Project } from '../../types/Project';
import { SystemCheckView } from './SystemCheckView';

interface NewProjectModalProps {
  opened: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project, shouldRunAutomation?: boolean) => void;
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
  const [runFirstStartSetup, setRunFirstStartSetup] = useState(true);
  const [classic, setClassic] = useState(false);
  const [classicQuickstartPath, setClassicQuickstartPath] = useState('');

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
        // Only load license path if classic is selected (since license is only needed for classic)
        if (classic && globalSettings.licensePath) {
          setLicensePath(globalSettings.licensePath);
        }
      };
      loadGlobalSettings();
    }
  }, [opened, classic]);

  const handleClose = () => {
    setNewProjectName('');
    setAemSdkPath('');
    setLicensePath('');
    setRunFirstStartSetup(true);
    setClassic(false);
    setClassicQuickstartPath('');
    onClose();
  };

  // Clear license path when classic is unchecked
  const handleClassicChange = (checked: boolean) => {
    setClassic(checked);
    if (!checked) {
      setLicensePath('');
      setClassicQuickstartPath('');
    } else {
      // Uncheck runFirstStartSetup when classic is selected as they're not compatible
      setRunFirstStartSetup(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !aemSdkPath) return;
    if (classic && !classicQuickstartPath) return;
    if (classic && !licensePath) return;
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
          licensePath,
          classic,
          classicQuickstartPath
        );
        
        // Start the installation procedure and wait for it to complete
        try {
          console.log('[NewProjectModal] Starting AEM installation...');
          await window.electronAPI.installAEM(project);
          console.log('[NewProjectModal] AEM installation completed');
        } catch (error) {
          console.error('Failed to install AEM:', error);
          // Don't proceed with automation if installation failed
          onProjectCreated(project, false);
          handleClose();
          return;
        }

        console.log('[NewProjectModal] Project created, shouldRunAutomation:', runFirstStartSetup);
        onProjectCreated(project, runFirstStartSetup);
        handleClose();
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
      // Only save to global settings if classic is selected (since license is only needed for classic)
      if (classic) {
        await window.electronAPI.setGlobalSettings({ licensePath: newPath });
      }
    }
  };

  const handleClearLicense = async () => {
    setLicensePath('');
    // Only clear global settings if classic is selected (since license is only needed for classic)
    if (classic) {
      await window.electronAPI.setGlobalSettings({ licensePath: '' });
    }
  };

  const handleSelectClassicQuickstart = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Classic Quickstart JAR',
      buttonLabel: 'Select File',
      message: 'Select the classic AEM quickstart JAR file',
      filters: [{ name: 'JAR Files', extensions: ['jar'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      setClassicQuickstartPath(result.filePaths[0]);
    }
  };

  const handleClearClassicQuickstart = async () => {
    setClassicQuickstartPath('');
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
        <SystemCheckView strict={true} />
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
          <Checkbox
            label="Classic AEM Version"
            checked={classic}
            onChange={(e) => handleClassicChange(e.target.checked)}
            description="Use for older AEM versions (AEM 6.x and earlier)"
          />
        </Group>
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
        {classic && (
          <>
            <Group>
              <TextInput
                label="Classic Quickstart JAR"
                placeholder="Select classic AEM quickstart JAR file"
                value={getFileName(classicQuickstartPath)}
                readOnly
                style={{ flex: 1 }}
                disabled={creating}
                title={classicQuickstartPath} // Show full path on hover
                required
              />
              <Button 
                onClick={handleSelectClassicQuickstart}
                disabled={creating}
                style={{ marginTop: 'auto' }}
              >
                Browse
              </Button>
              {classicQuickstartPath && (
                <Button 
                  onClick={handleClearClassicQuickstart}
                  disabled={creating}
                  variant="outline"
                  color="red"
                  style={{ marginTop: 'auto' }}
                >
                  ✕
                </Button>
              )}
            </Group>
            <Anchor
              onClick={() => window.electronAPI.openUrl("https://experience.adobe.com/#/downloads/content/software-distribution/en/aemcloud.html?fulltext=AEM*+Quickstart*&1_group.propertyvalues.property=.%2Fjcr%3Acontent%2Fmetadata%2Fdc%3AsoftwareType&1_group.propertyvalues.operation=equals&1_group.propertyvalues.0_values=software-type%3Atooling&orderby=%40jcr%3Acontent%2Fjcr%3AlastModified&orderby.sort=desc&layout=list&p.offset=0&p.limit=24")}
              size="sm"
              style={{ marginTop: '-8px', marginBottom: '8px', cursor: 'pointer' }}
            >
              Download Classic AEM Quickstart from experience.adobe.com
            </Anchor>
            <Group>
              <TextInput
                label="License File"
                placeholder="Select license properties file"
                value={getFileName(licensePath)}
                readOnly
                style={{ flex: 1 }}
                disabled={creating}
                title={licensePath} // Show full path on hover
                required
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
          </>
        )}
        <Group>
          <Checkbox
            label="Run first start and initial setup"
            checked={runFirstStartSetup}
            onChange={(e) => setRunFirstStartSetup(e.target.checked)}
            description="This will start all instances, configure replication between Author, Publisher, and Dispatcher instances, load matching oak-run.jar and install the WKND packages."
          />
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
            disabled={!newProjectName.trim() || !aemSdkPath || (classic && !classicQuickstartPath) || (classic && !licensePath)}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}; 