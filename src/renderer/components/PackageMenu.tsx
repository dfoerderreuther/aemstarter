import { Project } from "../../types/Project";
import { Button, Menu, Divider, Box } from '@mantine/core';
import { IconPackage, IconDownload, IconWorld, IconChevronDown, IconFolder } from '@tabler/icons-react';
import { useState } from 'react';

interface PackageMenuProps {
  project: Project;
  instance: 'author' | 'publisher';
  isRunning: boolean;
}

export const PackageMenu = ({ 
  project, 
  instance, 
  isRunning
}: PackageMenuProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleInstallWKND = async () => {
    const wkndUrl = "https://github.com/adobe/aem-guides-wknd/releases/download/aem-guides-wknd-3.2.0/aem-guides-wknd.all-3.2.0.zip";

    setIsLoading(true);
    try {
      console.log('Installing WKND package...');
      await window.electronAPI.installPackage(project, instance, wkndUrl);
      console.log('WKND package installed successfully');
    } catch (error) {
      console.error('Error installing WKND:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallACSCommons = async () => {
    const acsCommonsUrl = "https://github.com/Adobe-Consulting-Services/acs-aem-commons/releases/download/acs-aem-commons-6.12.0/acs-aem-commons-all-6.12.0-cloud.zip";
    setIsLoading(true);
    try {
      console.log('Installing ACS AEM Commons...');
      await window.electronAPI.installPackage(project, instance, acsCommonsUrl);
    } catch (error) {
      console.error('Error installing ACS AEM Commons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallFromURL = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement install from URL
      console.log('Installing package from URL...');
    } catch (error) {
      console.error('Error installing package from URL:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallLocalPackage = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement local package installation
      console.log('Installing local package...');
    } catch (error) {
      console.error('Error installing local package:', error);
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
            leftSection={<IconPackage size={12} />}
            rightSection={<IconChevronDown size={12} />}
            disabled={!isRunning || isLoading}
            style={{ 
              width: '100%',
              opacity: (!isRunning || isLoading) ? 0.5 : 1 
            }}
          >
            Packages
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item 
            leftSection={<IconDownload size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallWKND}
          >
            Install WKND
          </Menu.Item>
          
          <Menu.Item 
            leftSection={<IconDownload size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallACSCommons}
          >
            Install ACS AEM Commons
          </Menu.Item>
          
          <Menu.Item 
            leftSection={<IconWorld size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallFromURL}
          >
            Install from URL
          </Menu.Item>
          
          <Menu.Item 
            leftSection={<IconFolder size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallLocalPackage}
          >
            Install local package
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}; 