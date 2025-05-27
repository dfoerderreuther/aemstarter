import React, { useState, useEffect } from 'react';
import { MantineProvider, AppShell, Title, Container, Center, Paper, Text, ThemeIcon, Group, Stack, createTheme, rem, Select, Button, Modal, TextInput } from '@mantine/core';
import '@mantine/core/styles.css';
import { ProjectView } from './components/ProjectView';
import { Project } from '../types/Project';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import AemLogo from './assets/AEM.svg';

const theme = createTheme({
  primaryColor: 'blue',
  components: {
    AppShell: {
      styles: (theme: any) => ({
        main: {
          background: theme.colors.dark[8],
        },
      }),
    },
  },
});

const App: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [aemSdkPath, setAemSdkPath] = useState('');
  const [licensePath, setLicensePath] = useState('');

  // Load global settings when opening the modal
  const handleOpenCreateProjectModal = async () => {
    const globalSettings = await window.electronAPI.getGlobalSettings();
    if (globalSettings.aemSdkPath) {
      setAemSdkPath(globalSettings.aemSdkPath);
    }
    if (globalSettings.licensePath) {
      setLicensePath(globalSettings.licensePath);
    }
    setModalOpen(true);
  };

  // Load all projects and last selected project on startup
  useEffect(() => {
    const loadProjectsAndLast = async () => {
      setLoading(true);
      try {
        const allProjects = await window.electronAPI.getAllProjects();
        setProjects(allProjects);
        const lastProjectId = await window.electronAPI.getLastProjectId();
        if (lastProjectId) {
          const project = allProjects.find(p => p.id === lastProjectId);
          if (project) {
            setSelectedProject(project);
          }
        }
        // Load global settings
        const globalSettings = await window.electronAPI.getGlobalSettings();
        if (globalSettings.aemSdkPath) {
          setAemSdkPath(globalSettings.aemSdkPath);
        }
        if (globalSettings.licensePath) {
          setLicensePath(globalSettings.licensePath);
        }
        
        // Refresh menu to populate recent projects
        await window.electronAPI.refreshMenu();
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProjectsAndLast();

    // Set up menu event listeners
    const cleanupNewProject = window.electronAPI.onOpenNewProjectDialog(() => {
      handleOpenCreateProjectModal();
    });

    const cleanupOpenProject = window.electronAPI.onOpenProjectFolder(async (folderPath: string) => {
      await handleOpenProjectFolder(folderPath);
    });

    // Cleanup function
    return () => {
      cleanupNewProject();
      cleanupOpenProject();
    };
  }, []);

  // Set up recent project event listener separately to have access to current projects
  useEffect(() => {
    const cleanupRecentProject = window.electronAPI.onOpenRecentProject(async (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setSelectedProject(project);
        await window.electronAPI.setLastProjectId(project.id);
      }
    });

    return () => {
      cleanupRecentProject();
    };
  }, [projects]);

  // Save selected project when it changes
  const handleProjectSelect = async (project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      await window.electronAPI.setLastProjectId(project.id);
    } else {
      await window.electronAPI.setLastProjectId(null);
    }
  };

  // Handle dropdown change
  const handleDropdownChange = (projectId: string | null) => {
    const project = projects.find(p => p.id === projectId) || null;
    handleProjectSelect(project);
  };


  // Handle new project creation
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
        const allProjects = await window.electronAPI.getAllProjects();
        setProjects(allProjects);
        setSelectedProject(project);
        await window.electronAPI.setLastProjectId(project.id);
        await window.electronAPI.refreshMenu();
        setModalOpen(false);
        setNewProjectName('');
        setAemSdkPath('');
        setLicensePath('');

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

  // Handle project deletion with confirmation
  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    await window.electronAPI.deleteProject(selectedProject.id);
    const allProjects = await window.electronAPI.getAllProjects();
    setProjects(allProjects);
    setSelectedProject(null);
    await window.electronAPI.setLastProjectId(null);
    await window.electronAPI.refreshMenu();
    setDeleteDialogOpen(false);
  };

  // Handle opening an existing project folder
  const handleOpenProjectFolder = async (folderPath: string) => {
    try {
      // Check if this folder contains an existing AEM Starter project
      // Look for key indicators: settings.json, author/publisher folders, etc.
      const entries = await window.electronAPI.readDirectory(folderPath);
      const hasSettings = entries.some(entry => entry.name === 'settings.json' && entry.isFile);
      const hasAuthor = entries.some(entry => entry.name === 'author' && entry.isDirectory);
      const hasPublisher = entries.some(entry => entry.name === 'publisher' && entry.isDirectory);
      
      if (hasSettings && (hasAuthor || hasPublisher)) {
        // This looks like an AEM Starter project
        // Try to read the settings to get the project name
        let projectName = 'Imported Project';
        try {
          const settingsResult = await window.electronAPI.readFile(`${folderPath}/settings.json`);
          if (settingsResult.content) {
            const settings = JSON.parse(settingsResult.content);
            if (settings.general?.name) {
              projectName = settings.general.name;
            }
          }
        } catch (error) {
          console.warn('Could not read project settings:', error);
        }

        // Check if this project already exists
        const existingProject = projects.find(p => p.folderPath === folderPath);
        if (existingProject) {
          // Project already exists, just select it
          setSelectedProject(existingProject);
          await window.electronAPI.setLastProjectId(existingProject.id);
          return;
        }

        // Get global settings for SDK and license paths
        const globalSettings = await window.electronAPI.getGlobalSettings();
        const sdkPath = globalSettings.aemSdkPath || '';
        const licensePath = globalSettings.licensePath || '';

        if (!sdkPath || !licensePath) {
          alert('Please configure AEM SDK and License paths in global settings before importing a project.');
          return;
        }

        // Create a new project entry for this existing folder
        const project = await window.electronAPI.createProject(
          projectName,
          folderPath,
          sdkPath,
          licensePath
        );

        // Refresh projects list and select the new project
        const allProjects = await window.electronAPI.getAllProjects();
        setProjects(allProjects);
        setSelectedProject(project);
        await window.electronAPI.setLastProjectId(project.id);
        await window.electronAPI.refreshMenu();
        
        console.log('Successfully imported existing AEM Starter project:', projectName);
      } else {
        alert(`The selected folder does not appear to contain an AEM Starter project.\n\nExpected to find:\n- settings.json file\n- author/ or publisher/ directories\n\nSelected: ${folderPath}`);
      }
    } catch (error) {
      console.error('Error opening project folder:', error);
      alert(`Error opening project folder: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (loading) {
    return (
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Center style={{ height: '100vh' }}>
          <Text>Loading...</Text>
        </Center>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppShell
        header={{ height: 60 }}
        padding={0}
        style={{ minHeight: '100vh' }}
      >
        <AppShell.Header p="xs" style={{ paddingLeft: rem(20), paddingRight: rem(20) }}>
          <Group justify="space-between" align="center" style={{ width: '100%' }}>
            <Group align="center" gap={8}>
              <ThemeIcon size="lg" radius="md" variant="transparent">
                <img src={AemLogo} alt="AEM Logo" style={{ width: 32, height: 32 }} />
              </ThemeIcon>
              <Title order={2}>
                {selectedProject ? selectedProject.name : 'AEM Starter'}
              </Title>
            </Group>
            <Group align="center" gap={8}>
              
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleOpenCreateProjectModal}
              >
                New Project
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        {/* Delete confirmation dialog */}
        <Modal
          opened={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          title="Delete Project"
          centered
        >
          <Text mb="md">Are you sure you want to delete the project <b>{selectedProject?.name}</b>? This action cannot be undone.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteProject}>
              Delete
            </Button>
          </Group>
        </Modal>

        <Modal
          opened={modalOpen}
          onClose={() => { 
            setModalOpen(false); 
            setNewProjectName('');
            setAemSdkPath('');
            setLicensePath('');
          }}
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
                onClick={() => { 
                  setModalOpen(false); 
                  setNewProjectName('');
                  setAemSdkPath('');
                  setLicensePath('');
                }} 
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

        <AppShell.Main>
          {selectedProject ? (
            <ProjectView project={selectedProject} />
          ) : (
            <Container size="xl" py="md">
              <Stack gap="lg" align="center">
                <Title order={2}>Welcome to AEM Starter</Title>
                <Text size="lg" c="dimmed" ta="center" maw={400} py="md">
                  Select or create a project.
                </Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleOpenCreateProjectModal}
                  size="lg"
                >
                  Create New Project
                </Button>
              </Stack>
            </Container>
          )}
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
};

export default App; 