import React from 'react';
import { Text, Group, Badge } from '@mantine/core';
import { IconPackage } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';
import { AutomationTaskTeaser } from '../AutomationTaskTeaser';

interface FirstStartAndInitialSetupTeaserProps {
  project: Project;
  onTaskStart: (taskType: string, taskTitle: string) => void;
}

export const FirstStartAndInitialSetupTeaser: React.FC<FirstStartAndInitialSetupTeaserProps> = ({ 
  project, 
  onTaskStart 
}) => {
  return (
    <AutomationTaskTeaser 
      task="first-start-and-initial-setup" 
      project={project} 
      icon={IconPackage}
      taskTitle="First start and initial setup"
      onTaskStart={onTaskStart}
    >
      <div>
        <Text fw={500} size="sm" mb={4}>First start and initial setup</Text>
        <Text size="xs" c="dimmed" mb={8}>
          This will start all instances, 
          configure replication between Author, Publisher, and Dispatcher instances, 
          load matching oak-run.jar
          and install the WKND packages.

        </Text>
        <Group gap="xs">
          <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
          <Badge variant="outline" color="red" size="xs">CS only. Not for classic.</Badge>
        </Group>
      </div>
    </AutomationTaskTeaser>
  );
}; 