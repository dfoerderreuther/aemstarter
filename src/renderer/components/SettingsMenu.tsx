import { Button, Menu } from '@mantine/core';
import { IconSettings, IconChevronDown, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { Project } from '../../types/Project';

interface SettingsMenuProps {
  project: Project;
  instance: 'author' | 'publisher' | 'dispatcher';
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

  const handleAddEnforceHttpsRewriteRule = async () => {
    setIsLoading(true);
    try {
      console.log('Adding enforce https rewrite rule...');
      const result = await window.electronAPI.addEnforceHttpsRewriteRule(project);
      if (result.success) {
        console.log('Enforce https rewrite rule added successfully');
      } else {
        console.error('Failed to add enforce https rewrite rule:', result.error);
      }
    } catch (error) {
      console.error('Error adding enforce https rewrite rule:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button 
            size="xs" 
            variant="subtle" 
            leftSection={<IconSettings size={12} />}
            rightSection={<IconChevronDown size={12} />}
            disabled={!isRunning || isLoading}
            style={{ 
              opacity: (!isRunning || isLoading) ? 0.5 : 1,
              justifyContent: 'flex-start',
              padding: '2px',
              height: 'auto',
              fontWeight: 400
            }}
            styles={{
              root: {
                '&:focus': { outline: 'none', boxShadow: 'none' },
                '&:focus-visible': { outline: '1px solid rgba(255,255,255,0.3)' }
              }
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
          {instance === 'dispatcher' && (
            <Menu.Item
              leftSection={<IconRefresh size={14} />}
              disabled={!isRunning || isLoading}
              onClick={handleAddEnforceHttpsRewriteRule}
            >
              Add enforce https rewrite rule
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    </>
  );
};