import React, { useState, useEffect } from 'react';
import { MantineProvider, AppShell, Title, Container, Center, Text, ThemeIcon, Group, Stack, createTheme, rem, Select, Button } from '@mantine/core';
import '@mantine/core/styles.css';
import { ProjectView } from './components/ProjectView';
import { NewProjectModal } from './components/NewProjectModal';
import { Project } from '../types/Project';
import { IconPlus } from '@tabler/icons-react';
import AemLogo from './assets/AEM.svg';
import { SystemCheckView } from './components/SystemCheckView';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Handle new project creation callback
  const handleProjectCreated = async (project: Project) => {
    const allProjects = await window.electronAPI.getAllProjects();
    setProjects(allProjects);
    setSelectedProject(project);
    await window.electronAPI.setLastProjectId(project.id);
    await window.electronAPI.refreshMenu();
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
      setModalOpen(true);
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

  // Handle opening an existing project folder
  const handleOpenProjectFolder = async (folderPath: string) => {
    try {
      // Check if this folder contains a complete AEM Starter project installation
      const entries = await window.electronAPI.readDirectory(folderPath);
      const hasSettings = entries.some(entry => entry.name === 'settings.json' && entry.isFile);
      const hasAuthor = entries.some(entry => entry.name === 'author' && entry.isDirectory);
      const hasPublisher = entries.some(entry => entry.name === 'publisher' && entry.isDirectory);
      const hasDispatcher = entries.some(entry => entry.name === 'dispatcher' && entry.isDirectory);
      const hasInstall = entries.some(entry => entry.name === 'install' && entry.isDirectory);
      
      if (hasSettings && hasAuthor && hasPublisher && hasDispatcher && hasInstall) {
        // This is a complete AEM Starter project installation
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

        // Register this existing complete installation in our project database
        const project = await window.electronAPI.importProject(
          projectName,
          folderPath
        );

        // Refresh projects list and select the new project
        const allProjects = await window.electronAPI.getAllProjects();
        setProjects(allProjects);
        setSelectedProject(project);
        await window.electronAPI.setLastProjectId(project.id);
        await window.electronAPI.refreshMenu();
        
        console.log('Successfully imported existing AEM Starter project:', projectName);
      } else {
        const missingComponents = [];
        if (!hasSettings) missingComponents.push('settings.json');
        if (!hasAuthor) missingComponents.push('author/');
        if (!hasPublisher) missingComponents.push('publisher/');
        if (!hasDispatcher) missingComponents.push('dispatcher/');
        if (!hasInstall) missingComponents.push('install/');
        
        alert(`The selected folder does not appear to contain a complete AEM Starter project installation.\n\nMissing components:\n${missingComponents.map(c => `- ${c}`).join('\n')}\n\nSelected: ${folderPath}`);
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
              <SystemCheckView />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setModalOpen(true)}
              >
                New Project
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <NewProjectModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          onProjectCreated={handleProjectCreated}
        />

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