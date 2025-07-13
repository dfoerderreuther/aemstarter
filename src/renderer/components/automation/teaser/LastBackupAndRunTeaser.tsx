import React from 'react';
import { Text, Group, Badge } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';
import { AutomationTaskTeaser } from '../AutomationTaskTeaser';

interface LastBackupAndRunTeaserProps {
  project: Project;
  onTaskStart: (taskType: string, taskTitle: string) => void;
}

export const LastBackupAndRunTeaser: React.FC<LastBackupAndRunTeaserProps> = ({ 
  project, 
  onTaskStart 
}) => {
  return (
    <AutomationTaskTeaser 
      task="last-backup-and-run" 
      project={project} 
      icon={IconPlayerPlay}
      color="red"
      taskTitle="Restore last backup and start"
      onTaskStart={onTaskStart}
    >
      <div>
        <Text fw={500} size="sm" mb={4}>Restore last backup and start</Text>
        <Text size="xs" c="dimmed" mb={8}>
          This will shut down all instances, restore the last backup and start again.
        </Text>
        <Group gap="xs">
          <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
        </Group>
      </div>
    </AutomationTaskTeaser>
  );
}; 