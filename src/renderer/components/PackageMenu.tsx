import { Project } from "../../types/Project";
import { Button, Menu, Box, Modal, TextInput, Divider } from '@mantine/core';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [packageUrl, setPackageUrl] = useState('');


  const handleInstall = async (url: string) => {
    setIsLoading(true);
    try {
      console.log('Installing package...');
      await window.electronAPI.installPackage(project, instance, url);
    } catch (error) {
      console.error('Error installing package:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleInstallVenia = async () => {
    const veniaUrl = "https://github.com/adobe/aem-cif-guides-venia/releases/download/venia-2025.04.11/aem-cif-guides-venia.all-2025.04.11.zip";
    handleInstall(veniaUrl);
  };

  const handleInstallWKND = async () => {
    const wkndUrl = "https://github.com/adobe/aem-guides-wknd/releases/download/aem-guides-wknd-3.2.0/aem-guides-wknd.all-3.2.0.zip";
    handleInstall(wkndUrl);
  };

  const handleInstallACSCommons = async () => {
    const acsCommonsUrl = "https://github.com/Adobe-Consulting-Services/acs-aem-commons/releases/download/acs-aem-commons-6.12.0/acs-aem-commons-all-6.12.0-cloud.zip";
    handleInstall(acsCommonsUrl);
  };

  const handleInstallFromURL = async () => {
    setIsModalOpen(true);
  };

  const handleSubmitUrl = async () => {
    if (!packageUrl.trim()) {
      return;
    }

    setIsLoading(true);
    setIsModalOpen(false);
    try {
      console.log('Installing package from URL:', packageUrl);
      await window.electronAPI.installPackage(project, instance, packageUrl);
      console.log('Package installed successfully from URL');
    } catch (error) {
      console.error('Error installing package from URL:', error);
    } finally {
      setIsLoading(false);
      setPackageUrl('');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setPackageUrl('');
  };

  const handleInstallLocalPackage = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Package File',
      buttonLabel: 'Select File',
      message: 'Select a package file to install',
      filters: [{ name: 'Package Files', extensions: ['zip', 'jar'] }]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      setIsLoading(true);
      try {
        console.log('Installing local package:', filePath);
        await window.electronAPI.installPackage(project, instance, filePath);
        console.log('Local package installed successfully');
      } catch (error) {
        console.error('Error installing local package:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    
      



      <Menu shadow="md" width={200}>
      <Modal
        opened={isModalOpen}
        onClose={handleCloseModal}
        title="Install Package from URL"
        size="md"
      >
        <TextInput
          label="Package URL"
          placeholder="https://example.com/package.zip"
          value={packageUrl}
          onChange={(event) => setPackageUrl(event.currentTarget.value)}
          mb="md"
        />
        <Box style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitUrl}
            disabled={!packageUrl.trim()}
          >
            Install
          </Button>
        </Box>
      </Modal>
        <Menu.Target>
          <Button 
            size="xs" 
            variant="subtle" 
            leftSection={<IconPackage size={12} />}
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
            Packages
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item 
            leftSection={<IconDownload size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallWKND}
          >
            Install WKND 3.2.0
          </Menu.Item>

          <Menu.Item 
            leftSection={<IconDownload size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallVenia}
          >
            Install Venia 2025.04.11(AEM CIF Add-on required)
          </Menu.Item>
          
          <Menu.Item 
            leftSection={<IconDownload size={14} />}
            disabled={!isRunning || isLoading}
            onClick={handleInstallACSCommons}
          >
            Install ACS AEM Commons 6.12.0
          </Menu.Item>

          <Divider />
          
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
    
  );
}; 