import { Project } from "../../types/Project";
import { Button, Menu } from '@mantine/core';
import { IconPackage, IconDatabase, IconChevronDown, IconDownload } from '@tabler/icons-react';
import { useState, useEffect } from 'react';

interface OakRunMenuProps {
  project: Project;
  instance: 'author' | 'publisher';
  isRunning: boolean;
  onLogFileSwitch?: (logFiles: string[]) => void;
}

export const OakRunMenu = ({ 
  project, 
  instance, 
  isRunning,
  onLogFileSwitch
}: OakRunMenuProps) => {
  const [isOakJarAvailable, setIsOakJarAvailable] = useState(false);
  const [isLoadingOakJar, setIsLoadingOakJar] = useState(false);
  const [isRunningCompaction, setIsRunningCompaction] = useState(false);

  // Initial check for oak-run.jar availability
  useEffect(() => {
    const checkInitialOakJarAvailability = async () => {
      try {
        console.log('Checking initial oak jar availability for:', project.name, instance);
        const available = await window.electronAPI.isOakJarAvailable(project, instance);
        console.log('Initial oak jar availability:', available);
        setIsOakJarAvailable(available);
      } catch (error) {
        console.error('Error checking initial oak-run.jar availability:', error);
        setIsOakJarAvailable(false);
      }
    };
    checkInitialOakJarAvailability();
  }, [project, instance]);

  // Check oak-run.jar availability when menu opens
  const handleMenuOpen = async () => {
    try {
       const available = await window.electronAPI.isOakJarAvailable(project, instance);
      setIsOakJarAvailable(available);
    } catch (error) {
      console.error('Error checking oak-run.jar availability on menu open:', error);
      setIsOakJarAvailable(false);
    }
  };

  // Handle oak-run.jar loading
  const handleLoadOakJar = async () => {


    setIsLoadingOakJar(true);
    try {
      await window.electronAPI.loadOakJar(project);
      setIsOakJarAvailable(true);
    } catch (error) {
      console.error('Error loading oak-run.jar:', error);
    } finally {
      setIsLoadingOakJar(false);
    }
  };

  // Handle compaction
  const handleCompaction = async () => {
    if (isRunning) {
      console.warn('Cannot run compaction: instance is running. Please stop the instance first.');
      return;
    }

    if (!isOakJarAvailable) {
      console.warn('Cannot run compaction: oak-run.jar is not available');
      return;
    }

    setIsRunningCompaction(true);
    try {
      if (onLogFileSwitch) {
        onLogFileSwitch(['oak-run-compact.log']);
      }
      await window.electronAPI.runOakCompaction(project, instance);

      console.log('Oak compaction completed successfully');
    } catch (error) {
      console.error('Error running oak compaction:', error);
    } finally {
      setIsRunningCompaction(false);
    }
  };

  return (
    <Menu shadow="md" width={200} onOpen={handleMenuOpen}>
      <Menu.Target>
        <Button 
          size="xs" 
          variant="subtle" 
          leftSection={<IconPackage size={12} />}
          rightSection={<IconChevronDown size={12} />}
          style={{ 
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
          Oak Tools
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        {!isOakJarAvailable && (
          <Menu.Item 
            leftSection={<IconDownload size={14} />}
            disabled={!isRunning || isLoadingOakJar}
            onClick={handleLoadOakJar}
          >
            {isLoadingOakJar ? 'Loading Oak Jar...' : 'Load Oak Jar'}
          </Menu.Item>
        )}
        
        <Menu.Item 
          leftSection={<IconDatabase size={14} />}
          disabled={!isOakJarAvailable || isRunning || isRunningCompaction}
          onClick={handleCompaction}
        >
          {isRunningCompaction ? 'Running Compaction...' : 'Compaction'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}; 