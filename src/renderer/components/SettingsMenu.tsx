import { Button, Menu, Divider, Box } from '@mantine/core';
import { IconSettings, IconChevronDown, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { Project } from '../../types/Project';

interface SettingsMenuProps {
  project: Project;
  instance: 'author' | 'publisher';
  isRunning?: boolean;
}

export const SettingsMenu = ({ project, instance, isRunning = true }: SettingsMenuProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupReplication = async () => {
    setIsLoading(true);
    try {
      console.log('Setting up replication...');
      const result = await window.electronAPI.setupReplication(project, instance);
      if (result.success) {
        console.log('Replication setup completed successfully:', result.output);
      } else {
        console.error('Replication setup failed:', result.error);
      }
    } catch (error) {
      console.error('Error setting up replication:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Divider />
      
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button 
            size="xs" 
            variant="outline" 
            leftSection={<IconSettings size={12} />}
            rightSection={<IconChevronDown size={12} />}
            disabled={!isRunning || isLoading}
            style={{ 
              width: '100%',
              opacity: (!isRunning || isLoading) ? 0.5 : 1 
            }}
          >
            Settings
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item 
            leftSection={<IconRefresh size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleSetupReplication}
          >
            Set up replication
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
};