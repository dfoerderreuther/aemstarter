import React from 'react';
import { Container, Title } from '@mantine/core';
import { Project } from '../../types/Project';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  return (
    <Container size="xl" py="md">
        <Title order={2}>{project.name}</Title>
      {/* Project content will go here */}
    </Container>
  );
}; 