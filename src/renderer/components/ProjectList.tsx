import React, { useEffect, useState } from 'react';
import { Project } from '../../types/Project';
import {
  Title,
  Button,
  TextInput,
  Card,
  Text,
  Group,
  Stack,
  ActionIcon,
  Modal,
  Box,
  SimpleGrid,
  ThemeIcon,
  rem,
} from '@mantine/core';
import { IconTrash, IconFolder, IconPlus } from '@tabler/icons-react';

interface ProjectListProps {
  onProjectSelect: (project: Project | null) => void;
  selectedProject: Project | null;
}

declare global {
  interface Window {
    electronAPI: {
      getAllProjects: () => Promise<Project[]>;
      createProject: (name: string, folderPath: string) => Promise<Project>;
      loadProject: (id: string) => Promise<Project | undefined>;
      deleteProject: (id: string) => Promise<boolean>;
      showOpenDialog: (options: any) => Promise<Electron.OpenDialogReturnValue>;
    };
  }
}

export const ProjectList: React.FC<ProjectListProps> = ({ onProjectSelect, selectedProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const loadedProjects = await window.electronAPI.getAllProjects();
    setProjects(loadedProjects);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const project = await window.electronAPI.createProject(
        newProjectName,
        result.filePaths[0]
      );
      setProjects([...projects, project]);
      setNewProjectName('');
      setIsCreating(false);
      onProjectSelect(project);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const success = await window.electronAPI.deleteProject(id);
    if (success) {
      setProjects(projects.filter(p => p.id !== id));
      if (selectedProject?.id === id) {
        onProjectSelect(null);
      }
    }
  };

  if (selectedProject) {
    return (
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3} mb="md">Your Projects</Title>
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={() => setIsCreating(true)}
          >
            New Project
          </Button>
        </Group>
        <SimpleGrid cols={3}>
          {projects.map((project) => (
            <Card
              key={project.id}
              shadow="sm"
              p="lg"
              radius="md"
              withBorder
              style={{ 
                cursor: 'pointer',
                borderColor: selectedProject.id === project.id ? 'var(--mantine-color-blue-6)' : undefined,
                transform: selectedProject.id === project.id ? 'translateY(-2px)' : undefined,
                boxShadow: selectedProject.id === project.id ? '0 4px 8px rgba(0,0,0,0.2)' : undefined,
              }}
              onClick={() => onProjectSelect(project)}
            >
              <Group justify="space-between" mb="xs">
                <Group>
                  <ThemeIcon size="lg" radius="md">
                    <IconFolder size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text size="lg" fw={500}>
                      {project.name}
                    </Text>
                    <Text size="sm" c="dimmed" style={{ wordBreak: 'break-word' }}>
                      {project.folderPath}
                    </Text>
                  </Box>
                </Group>
                <ActionIcon
                  color="red"
                  variant="light"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <>
      <Button 
        size="lg"
        leftSection={<IconPlus size={20} />}
        onClick={() => setIsCreating(true)}
      >
        Create New Project
      </Button>

      <Modal
        opened={isCreating}
        onClose={() => {
          setIsCreating(false);
          setNewProjectName('');
        }}
        title="Create New Project"
        centered
        overlayProps={{
          opacity: 0.55,
          blur: 3,
        }}
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
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => {
              setIsCreating(false);
              setNewProjectName('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}; 