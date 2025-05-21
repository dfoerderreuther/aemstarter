import React, { useEffect, useState } from 'react';
import { Project } from '../../types/Project';
import {
  Title,
  Button,
  Card,
  Text,
  Group,
  Stack,
  ActionIcon,
  Box,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { IconTrash, IconFolder } from '@tabler/icons-react';

interface ProjectListProps {
  onProjectSelect: (project: Project | null) => void;
  selectedProject: Project | null;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onProjectSelect, selectedProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const loadedProjects = await window.electronAPI.getAllProjects();
    setProjects(loadedProjects);
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
        <Title order={3} mb="md">Your Projects</Title>
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
    <Button 
      size="lg"
      leftSection={<IconFolder size={20} />}
      onClick={() => onProjectSelect(projects[0])}
    >
      Select a Project
    </Button>
  );
}; 