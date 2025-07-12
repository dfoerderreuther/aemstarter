import React from 'react';
import { Text, Group, Badge } from '@mantine/core';
import { IconBug } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';
import { AutomationTaskTeaser } from '../AutomationTaskTeaser';

interface LastBackupAndDebugTeaserProps {
  project: Project;
  onTaskStart: (taskType: string, taskTitle: string) => void;
}

export const LastBackupAndDebugTeaser: React.FC<LastBackupAndDebugTeaserProps> = ({ 
  project, 
  onTaskStart 
}) => {
  return (
    <AutomationTaskTeaser 
      task="last-backup-and-debug" 
      project={project} 
      icon={IconBug}
      taskTitle="Restore last backup and start in debug mode"
      onTaskStart={onTaskStart}
    >
      <div>
        <Text fw={500} size="sm" mb={4}>Restore last backup and start in debug mode</Text>
        <Text size="xs" c="dimmed" mb={8}>
          This will shut down all instances, restore the last backup and start again in debug mode.
        </Text>
        <Group gap="xs">
          <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
        </Group>
      </div>
    </AutomationTaskTeaser>
  );
}; 