import React from 'react';
import { Text, Group, Badge } from '@mantine/core';
import { IconPackage } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';
import { AutomationTaskTeaser } from '../AutomationTaskTeaser';

interface ReinstallTeaserProps {
  project: Project;
  onTaskStart: (taskType: string, taskTitle: string) => void;
}

export const ReinstallTeaser: React.FC<ReinstallTeaserProps> = ({ 
  project, 
  onTaskStart 
}) => {
  return (
    <AutomationTaskTeaser 
      task="reinstall" 
      project={project} 
      icon={IconPackage}
      taskTitle="Reinstall AEM"
      onTaskStart={onTaskStart}
    >
      <div>
        <Text fw={500} size="sm" mb={4}>Reinstall AEM</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Completely reinstall AEM instances. This will delete existing folders, 
          create new ones, copy license files, and unzip the SDK package.
        </Text>
        <Group gap="xs">
          <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
        </Group>
      </div>
    </AutomationTaskTeaser>
  );
}; 