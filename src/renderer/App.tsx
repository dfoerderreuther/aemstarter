import React, { useState, useEffect } from 'react';
import { MantineProvider, AppShell, Title, Container, Center, Paper, Text, ThemeIcon, Group, Stack, createTheme, rem, Select, Button, Modal, TextInput } from '@mantine/core';
import '@mantine/core/styles.css';
import { ProjectList } from './components/ProjectList';
import { ProjectView } from './components/ProjectView';
import { Project } from '../types/Project';
import { IconFolder, IconPlus, IconTrash } from '@tabler/icons-react';

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
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProjectsAndLast();
  }, []);

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

  // When a project is created or deleted, refresh the project list
  const handleProjectListChange = async (project: Project | null) => {
    const allProjects = await window.electronAPI.getAllProjects();
    setProjects(allProjects);
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
        setModalOpen(false);
        setNewProjectName('');
        setAemSdkPath('');
        setLicensePath('');
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
      setAemSdkPath(result.filePaths[0]);
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
      setLicensePath(result.filePaths[0]);
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
    setDeleteDialogOpen(false);
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
        padding="md"
        style={{ minHeight: '100vh' }}
      >
        <AppShell.Header p="xs" style={{ paddingLeft: rem(20), paddingRight: rem(20) }}>
          <Group justify="space-between" align="center" style={{ width: '100%' }}>
            <Group align="center" gap={8}>
              <ThemeIcon size="lg" radius="md">
                <IconFolder size={20} />
              </ThemeIcon>
              <Title order={2}>
                {selectedProject ? selectedProject.name : 'AEM Starter'}
              </Title>
            </Group>
            <Group align="center" gap={8}>
              <Select
                placeholder={projects.length === 0 ? 'No projects' : 'Select project'}
                data={projects.map(p => ({ value: p.id, label: p.name }))}
                value={selectedProject?.id || null}
                onChange={handleDropdownChange}
                clearable
                searchable
                maxDropdownHeight={200}
                style={{ minWidth: 220 }}
              />
              <Button
                variant="subtle"
                color="red"
                size="compact-md"
                px={8}
                disabled={!selectedProject}
                onClick={() => setDeleteDialogOpen(true)}
                title="Delete selected project"
              >
                <IconTrash size={16} />
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setModalOpen(true)}
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
                  Select a project to get started or create a new one.
                </Text>
                <ProjectList onProjectSelect={handleProjectListChange} selectedProject={selectedProject} />
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setModalOpen(true)}
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