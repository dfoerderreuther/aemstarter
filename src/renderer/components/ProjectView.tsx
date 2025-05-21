import React from 'react';
import { Container, Title, Group, Button, Badge } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop, IconDownload } from '@tabler/icons-react';
import { Project } from '../../types/Project';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [status, setStatus] = React.useState<'starting' | 'started' | 'stopping' | 'stopped'>('stopped');

  const getStatusColor = () => {
    switch (status) {
      case 'started': return 'green';
      case 'starting': return 'yellow';
      case 'stopping': return 'orange';
      case 'stopped': return 'red';
    }
  };

  return (
    <Container size="xl" py="md">
      <Group mb="md" justify="space-between">
        <Group>
          <Badge color={getStatusColor()} size="lg">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
          <Button 
            leftSection={<IconPlayerPlay size={16} />}
            onClick={() => setStatus('starting')}
            disabled={status === 'started' || status === 'starting'}
          >
            Start
          </Button>
          <Button 
            leftSection={<IconPlayerStop size={16} />}
            color="red"
            onClick={() => setStatus('stopping')}
            disabled={status === 'stopped' || status === 'stopping'}
          >
            Stop
          </Button>
          <Button 
            leftSection={<IconDownload size={16} />}
            variant="light"
          >
            Install
          </Button>
        </Group>
      </Group>
      <Title order={2}>{project.name}</Title>
      {/* Project content will go here */}
    </Container>
  );
}; 