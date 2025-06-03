import { Project } from "../../types/Project";
import { Button, Menu, Divider, Box } from '@mantine/core';
import { IconPackage, IconDatabase, IconDeviceFloppy, IconRestore, IconChevronDown } from '@tabler/icons-react';
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

  // Check oak-run.jar availability
  useEffect(() => {
    const checkOakJarAvailability = async () => {
      try {
        const available = await window.electronAPI.isOakJarAvailable(project, instance);
        setIsOakJarAvailable(available);
      } catch (error) {
        console.error('Error checking oak-run.jar availability:', error);
        setIsOakJarAvailable(false);
      }
    };
    checkOakJarAvailability();
  }, [project, instance, isRunning]);

  // Handle oak-run.jar loading
  const handleLoadOakJar = async () => {
    if (!isRunning) {
      console.warn('Cannot load oak-run.jar: author instance is not running');
      return;
    }

    setIsLoadingOakJar(true);
    try {
      await window.electronAPI.loadOakJar(project);
      setIsOakJarAvailable(true);
      console.log('Oak-run.jar loaded successfully');
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
    <>
      
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button 
            size="xs" 
            variant="outline" 
            leftSection={<IconPackage size={12} />}
            rightSection={<IconChevronDown size={12} />}
            disabled={!isOakJarAvailable}
            style={{ 
              width: '100%',
              opacity: !isOakJarAvailable ? 0.5 : 1 
            }}
          >
            Oak Tools
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item 
            leftSection={<IconDatabase size={14} />}
            disabled={!isOakJarAvailable || isRunning || isRunningCompaction}
            onClick={handleCompaction}
          >
            {isRunningCompaction ? 'Running Compaction...' : 'Compaction'}
          </Menu.Item>
          
          <Menu.Item 
            leftSection={<IconDeviceFloppy size={14} />}
            disabled={!isOakJarAvailable || isRunning}
          >
            Checkpoints
          </Menu.Item>
          
          <Menu.Item 
            leftSection={<IconRestore size={14} />}
            disabled={!isOakJarAvailable || isRunning}
          >
            Backup & Restore
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {!isOakJarAvailable && instance === 'author' && (
        <Button 
          mt="xs"
          w="100%"
          leftSection={<IconPackage size={14} />}
          disabled={!isRunning}
          onClick={handleLoadOakJar}
          style={{ 
            opacity: !isRunning ? 0.5 : 1 
          }}
        >
          {isLoadingOakJar ? 'Loading...' : 'Load Oak Jar'}
        </Button>
      )}
    </>
  );
}; 