import React, { useState, useEffect } from 'react';
import { Modal, Stack, TextInput, Group, Button, Anchor, Checkbox, ActionIcon, Text, Paper } from '@mantine/core';
import { IconFolder, IconAlertTriangle } from '@tabler/icons-react';
import { Project } from '../../types/Project';
import { SystemCheckView } from './SystemCheckView';
import { JavaHomeSelector } from './JavaHomeSelector';

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
  const [projectPath, setProjectPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [aemSdkPath, setAemSdkPath] = useState('');
  const [licensePath, setLicensePath] = useState('');
  const [runFirstStartSetup, setRunFirstStartSetup] = useState(true);
  const [classic, setClassic] = useState(false);
  const [classicQuickstartPath, setClassicQuickstartPath] = useState('');
  const [javaHome, setJavaHome] = useState('');
  const [javaHomeValid, setJavaHomeValid] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  // Helper function to extract filename from path
  const getFileName = (path: string) => {
    if (!path) return '';
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  // Helper function to check for special characters and spaces
  const getPathWarnings = (path: string) => {
    if (!path) return [];
    const warnings = [];
    
    
    // Check for special characters (excluding common path separators and drive letters)
    const specialChars = /[^a-zA-Z0-9\-_./\\:]/;
    if (path.includes(' ')) {
      warnings.push('Path contains spaces');
    } else if (specialChars.test(path)) {
      warnings.push('Path contains special characters');
    }
    
    return warnings;
  };

  const pathWarnings = getPathWarnings(projectPath);
  const isWindows = platform === 'win32';
  const pathIssuesAreBlockers = !isWindows;
  const hasPathBlockers = pathIssuesAreBlockers && pathWarnings.length > 0;

  // Load platform information on component mount
  useEffect(() => {
    const loadPlatform = async () => {
      const platformInfo = await window.electronAPI.getPlatform();
      setPlatform(platformInfo);
    };
    loadPlatform();
  }, []);

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
    setProjectPath('');
    setAemSdkPath('');
    setLicensePath('');
    setRunFirstStartSetup(true);
    setClassic(false);
    setClassicQuickstartPath('');
    setJavaHome('');
    setJavaHomeValid(false);
    onClose();
  };

  // Clear license path when classic is unchecked
  const handleClassicChange = (checked: boolean) => {
    setClassic(checked);
    if (!checked) {
      setLicensePath('');
      setClassicQuickstartPath('');
    } 
  };

  const handleSelectProjectPath = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Project Folder',
      buttonLabel: 'Select Folder',
      message: 'Select a folder for your project or create a new one'
    });
    if (!result.canceled && result.filePaths.length > 0) {
      setProjectPath(result.filePaths[0]);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !projectPath || !aemSdkPath || !javaHomeValid) return;
    if (classic && !classicQuickstartPath) return;
    if (classic && !licensePath) return;
    setCreating(true);
    
    try {
      const project = await window.electronAPI.createProject(
        newProjectName,
        projectPath,
        aemSdkPath,
        licensePath,
        classic,
        classicQuickstartPath
      );
      
      // Update project settings with the selected Java home
      let finalProject = project;
      if (javaHome) {
        const updatedSettings = {
          ...project.settings,
          general: {
            ...project.settings.general,
            javaHome: javaHome
          }
        };
        const updatedProject = await window.electronAPI.saveProjectSettings(project, updatedSettings);
        if (updatedProject) {
          finalProject = updatedProject;
        }
      }
      
              // Start the installation procedure and wait for it to complete
        try {
          console.log('[NewProjectModal] Starting AEM installation...');
          await window.electronAPI.installAEM(finalProject);
          console.log('[NewProjectModal] AEM installation completed');
        } catch (error) {
          console.error('Failed to install AEM:', error);
          // Don't proceed with automation if installation failed
          onProjectCreated(finalProject, false);
          handleClose();
          return;
        }

        console.log('[NewProjectModal] Project created, shouldRunAutomation:', runFirstStartSetup);
        onProjectCreated(finalProject, runFirstStartSetup);
      handleClose();
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
              title={
          <Group gap="sm" justify="space-between" style={{ width: '100%' }}>
            <Text>Create New Project</Text>
            <SystemCheckView strict={true} />
          </Group>
        }
      centered
      size="lg"
      overlayProps={{ opacity: 0.55, blur: 3 }}
    >
      <Stack gap="md">
        <Group gap="md" align="end">
          <TextInput
            label="Project Name"
            placeholder="Enter project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            size="md"
            required
            autoFocus
            disabled={creating}
            style={{ flex: 1 }}
          />
          <TextInput
            label="Project Folder"
            description="Select the folder where your project will be created"
            placeholder="Select project folder"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            style={{ flex: 1 }}
            required
            disabled={creating}
          />
          <ActionIcon
            variant="filled"
            onClick={handleSelectProjectPath}
            size="lg"
            disabled={creating}
          >
            <IconFolder size={16} />
          </ActionIcon>
        </Group>
          {pathWarnings.length > 0 && (
            <Group gap="xs" align="center">
              <IconAlertTriangle size={14} color={pathIssuesAreBlockers ? "red" : "orange"} />
              <Text size="sm" c={pathIssuesAreBlockers ? "red" : "orange"}>
                {pathIssuesAreBlockers ? "Error" : "Warning"}: {pathWarnings.join(', ')}
              </Text>
            </Group>
          )}
        <JavaHomeSelector 
          value={javaHome} 
          onChange={(value: string) => setJavaHome(value)}
          onValidationChange={setJavaHomeValid}
        />
        
        <Paper p="md" withBorder>
          <Stack gap="md">
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
            
                        <Checkbox
              label="Classic AEM Version"
              checked={classic}
              onChange={(e) => handleClassicChange(e.target.checked)}
              description="Use for older AEM versions (AEM 6.x and earlier)"
            />
            
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
                  onClick={() => window.electronAPI.openUrl("https://experience.adobe.com/#/downloads/content/software-distribution/en/aem.html?fulltext=quickstart*&orderby=%40jcr%3Acontent%2Fjcr%3AlastModified&orderby.sort=desc&layout=list&p.offset=0&p.limit=4")}
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
            
            <Checkbox
              label="Run first start and initial setup"
              checked={runFirstStartSetup}
              onChange={(e) => setRunFirstStartSetup(e.target.checked)}
              description="This will start all instances, configure replication between Author, Publisher, and Dispatcher instances and load matching oak-run.jar."
              
            />
          </Stack>
        </Paper>
        
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
            disabled={!newProjectName.trim() || !projectPath || !javaHomeValid || !aemSdkPath || (classic && !classicQuickstartPath) || (classic && !licensePath) || hasPathBlockers}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}; 