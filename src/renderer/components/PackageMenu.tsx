import { Project } from "../../types/Project";
import { Button, Menu, Divider, Box, Modal, TextInput, FileInput } from '@mantine/core';
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
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    setIsFileModalOpen(true);
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) {
      return;
    }

    setIsLoading(true);
    setIsFileModalOpen(false);
    try {
      console.log('Installing local package:', selectedFile.name);

      //await window.electronAPI.installPackage(project, instance, (selectedFile as any).path as string);
      console.log('Local package installed successfully');
    } catch (error) {
      console.error('Error installing local package:', error);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  const handleCloseFileModal = () => {
    setIsFileModalOpen(false);
    setSelectedFile(null);
  };

  return (
    <Box>
      <Divider />
      
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

      <Modal
        opened={isFileModalOpen}
        onClose={handleCloseFileModal}
        title="Install Local Package"
        size="md"
      >
        <FileInput
          label="Select Package File"
          placeholder="Choose a .zip package file"
          value={selectedFile}
          onChange={setSelectedFile}
          accept=".zip,.jar"
          mb="md"
        />
        <Box style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={handleCloseFileModal}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitFile}
            disabled={!selectedFile}
          >
            Install
          </Button>
        </Box>
      </Modal>

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