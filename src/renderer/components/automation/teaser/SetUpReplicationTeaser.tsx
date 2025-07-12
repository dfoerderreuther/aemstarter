import React from 'react';
import { Text, Paper, Group, Badge, Button, ThemeIcon } from '@mantine/core';
import { IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { Project } from '../../../../types/Project';

interface SetUpReplicationTeaserProps {
  project: Project;
  isSettingUpReplication: boolean;
  allInstancesRunning: boolean;
  onSetupReplication: () => void;
  taskItemStyles: React.CSSProperties;
}

export const SetUpReplicationTeaser: React.FC<SetUpReplicationTeaserProps> = ({ 
  project, 
  isSettingUpReplication,
  allInstancesRunning,
  onSetupReplication,
  taskItemStyles
}) => {
  return (
    <Paper style={taskItemStyles} radius={0}>
      <Group align="flex-start" gap="md">
        <ThemeIcon size="xl" variant="light" color="blue" radius="md">
          <IconRefresh size={24} />
        </ThemeIcon>
        
        <div style={{ flex: 1 }}>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={500} size="sm" mb={4}>Set Up Replication</Text>
              <Text size="xs" c="dimmed" mb={8}>
                Configure replication between Author, Publisher, and Dispatcher instances. 
                This will set up the proper replication agents and configurations.
              </Text>
              <Group gap="xs">
                <Badge variant="outline" color="blue" size="xs">Configuration</Badge>
                <Badge variant="outline" color="gray" size="xs">Requires All Running</Badge>
                <Badge variant="outline" color="orange" size="xs">CS optimized</Badge>  
                {!allInstancesRunning && (
                  <Badge variant="outline" color="red" size="xs" leftSection={<IconAlertCircle size={10} />}>
                    Instances Stopped
                  </Badge>
                )}
              </Group>
            </div>
            
            <Button
              color="blue"
              size="xs"
              loading={isSettingUpReplication}
              disabled={!allInstancesRunning}
              onClick={onSetupReplication}
              leftSection={<IconRefresh size={14} />}
            >
              Set Up
            </Button>
          </Group>
        </div>
      </Group>
    </Paper>
  );
}; 