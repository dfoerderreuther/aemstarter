import React, { useState } from 'react';
import { Text, TextInput } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';
import { AutomationTaskTeaser } from '../AutomationTaskTeaser';

interface BackupAndStartTeaserProps {
  project: Project;
  onTaskStart: (taskType: string, taskTitle: string) => void;
}

export const BackupAndStartTeaser: React.FC<BackupAndStartTeaserProps> = ({ 
  project, 
  onTaskStart 
}) => {
    const [backupName, setBackupName] = useState('');
  return (
    <AutomationTaskTeaser 
      task="create-backup-and-run" 
      project={project} 
      icon={IconPlayerPlay}
      color="green"
      taskTitle="Create backup and start"
      onTaskStart={onTaskStart}
      parameters={{
        backupName: backupName
      }}
    >
      <div>
        <Text fw={500} size="sm" mb={4}>Create backup and start</Text>
        <Text size="xs" c="dimmed" mb={8}>
          This will shut down all instances, create a backup and start again.
        </Text>
        <TextInput
            label="Backup name"
            value={backupName}
            onChange={(e) => setBackupName(e.target.value)}
            size="xs"
        />
      </div>
    </AutomationTaskTeaser>
  );
};
