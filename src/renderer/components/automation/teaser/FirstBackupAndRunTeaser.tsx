import React from 'react';
import { Text, Group, Badge } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';
import { AutomationTaskTeaser } from '../AutomationTaskTeaser';

interface FirstBackupAndRunTeaserProps {
  project: Project;
  onTaskStart: (taskType: string, taskTitle: string) => void;
}

export const FirstBackupAndRunTeaser: React.FC<FirstBackupAndRunTeaserProps> = ({ 
  project, 
  onTaskStart 
}) => {
  return (
    <AutomationTaskTeaser 
      task="first-backup-and-run" 
      project={project} 
      icon={IconHistory}
      color="red"
      taskTitle="Restore first backup and start"
      onTaskStart={onTaskStart}
    >
      <div>
        <Text fw={500} size="sm" mb={4}>Restore first backup and start</Text>
        <Text size="xs" c="dimmed" mb={8}>
          This will shut down all instances, restore the first backup and start again.
        </Text>
        <Group gap="xs">
          <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
        </Group>
      </div>
    </AutomationTaskTeaser>
  );
}; 