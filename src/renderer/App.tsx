import React, { useState, useEffect } from 'react';
import { MantineProvider, AppShell, Title, Container, Center, Text, ThemeIcon, Group, Stack, createTheme, rem, Button, MantineTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { ProjectView } from './components/ProjectView';
import { NewProjectModal } from './components/NewProjectModal';
import { Project } from '../types/Project';
import { IconPlus } from '@tabler/icons-react';
import AemLogo from './assets/AEM.svg';
import { SystemCheckView } from './components/SystemCheckView';
import { AboutModal } from './components/AboutModal';

const theme = createTheme({
  primaryColor: 'blue',
  components: {
    AppShell: {
      styles: (theme: MantineTheme) => ({
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
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [shouldRunAutomation, setShouldRunAutomation] = useState(false);

  // Clear terminals when project switches
  useEffect(() => {
    if (selectedProject) {
      console.log(`[App] Project switched to: ${selectedProject.name} (ID: ${selectedProject.id})`);
      
      const clearProjectData = async () => {
        try {
          // Clear all terminals
          await window.electronAPI.clearAllTerminals();
          console.log(`Cleared terminals for project switch to: ${selectedProject.name}`);
        } catch (error) {
          console.error('Error clearing terminals on project switch:', error);
        }
      };
      
      clearProjectData();
    }
  }, [selectedProject?.id]); // Only trigger when project ID changes, not on other project updates

  // Handle new project creation callback
  const handleProjectCreated = async (project: Project, shouldRunAutomation?: boolean) => {
    console.log('[App] Project created, shouldRunAutomation:', shouldRunAutomation);
    const allProjects = await window.electronAPI.getAllProjects();
    setProjects(allProjects);
    setSelectedProject(project);
    setShouldRunAutomation(shouldRunAutomation || false);
    console.log('[App] Set shouldRunAutomation state to:', shouldRunAutomation || false);
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

    const cleanupOpenAbout = window.electronAPI.onOpenAboutDialog(() => {
      setAboutModalOpen(true);
    });

    // Cleanup function
    return () => {
      cleanupNewProject();
      cleanupOpenProject();
      cleanupOpenAbout();
    };
  }, []);

    // Set up recent project event listener separately to have access to current projects
  useEffect(() => {
    const cleanupRecentProject = window.electronAPI.onOpenRecentProject(async (projectId: string) => {
      try {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          setSelectedProject(project);
          await window.electronAPI.setLastProjectId(project.id);
        }
      } catch (error) {
        console.error('Error opening recent project:', error);
      }
    });

    return () => {
      cleanupRecentProject();
    };
  }, [projects]);

  // Handle check and open new project
  const handleCheckAndOpenNewProject = async () => {
    // Check for running instances in current project first
    if (selectedProject) {
      const runningCheck = await window.electronAPI.checkRunningInstances(selectedProject);
      if (runningCheck.hasRunning) {
        const instanceList = runningCheck.runningInstances
          .map(instance => `• ${instance.instanceType} (port ${instance.port})`)
          .join('\n');
        
        alert(`Cannot create a new project because instances are currently running in "${selectedProject.name}".\n\nRunning instances:\n${instanceList}\n\nPlease stop all instances before creating a new project.`);
        return;
      }
    }
    
    setModalOpen(true);
  };

  // Handle opening an existing project folder
  const handleOpenProjectFolder = async (folderPath: string) => {
    try {
      // Check if this folder contains a complete AEM-Starter project installation
      const entries = await window.electronAPI.readDirectory(folderPath);
      const hasSettings = entries.some(entry => entry.name === 'settings.json' && entry.isFile);
      const hasAuthor = entries.some(entry => entry.name === 'author' && entry.isDirectory);
      const hasPublisher = entries.some(entry => entry.name === 'publisher' && entry.isDirectory);
      const hasDispatcher = entries.some(entry => entry.name === 'dispatcher' && entry.isDirectory);
      const hasInstall = entries.some(entry => entry.name === 'install' && entry.isDirectory);
      
      // Determine if this folder constitutes a complete AEM-Starter installation. 
      // The presence of settings.json is optional – it only exists when the user has customised defaults.
      if (hasAuthor && hasPublisher && hasDispatcher && hasInstall) {
        // This is a complete AEM-Starter project installation
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
        
        console.log('Successfully imported existing AEM-Starter project:', projectName);
      } else {
        const missingComponents = [];
        if (!hasAuthor) missingComponents.push('author/');
        if (!hasPublisher) missingComponents.push('publisher/');
        if (!hasDispatcher) missingComponents.push('dispatcher/');
        if (!hasInstall) missingComponents.push('install/');
        
        alert(`The selected folder does not appear to contain a complete AEM-Starter project installation.\n\nMissing components:\n${missingComponents.map(c => `- ${c}`).join('\n')}\n\nSelected: ${folderPath}`);
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
        header={{ height: 55 }}
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
                {selectedProject ? selectedProject.name : 'AEM-Starter'}
              </Title>
            </Group>
            <Group align="center" gap={8}>
              <SystemCheckView project={selectedProject || undefined} />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleCheckAndOpenNewProject}
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

        <AboutModal
          opened={aboutModalOpen}
          onClose={() => setAboutModalOpen(false)}
        />

        <AppShell.Main>
          {selectedProject ? (
            <ProjectView 
            project={selectedProject} 
            shouldRunAutomation={shouldRunAutomation}
            onAutomationStarted={() => {
              console.log('[App] Automation started, clearing shouldRunAutomation flag');
              setShouldRunAutomation(false);
            }}
            onProjectUpdated={(updatedProject) => {
              // Update the selected project with the new settings
              setSelectedProject(updatedProject);
              // Update the projects list with the updated project
              setProjects(prevProjects => 
                prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
              );
            }}
          />
          ) : (
            <Container size="xl" py="md">
              <Stack gap="lg" align="center">
                <Title order={2}>Welcome to AEM-Starter</Title>
                <Text size="lg" c="dimmed" ta="center" maw={400} py="md">
                  Select or create a project.
                </Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCheckAndOpenNewProject}
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