import React from 'react';
import { 
  Modal, 
  Flex,
  Title,
  Tabs
} from '@mantine/core';
import { Project } from '../../../types/Project';
import { IconPackage, IconFolder, IconWorld } from '@tabler/icons-react';
import { LocalPackages } from './LocalPackages';
import { WebPackages } from './WebPackages';



interface PackageManagerModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
  isAuthorRunning: boolean;
  isPublisherRunning: boolean;
}

export const PackageManagerModal: React.FC<PackageManagerModalProps> = ({ opened, onClose, project, isAuthorRunning, isPublisherRunning }) => {



  return (
    <Modal 
      opened={opened} 
      onClose={onClose} 
      title={
        <Flex align="center" gap="sm">
          <IconPackage size={24} />
          <Title order={3}>Package Manager</Title>
        </Flex>
      } 
      size="xl"
      padding="lg"
      styles={{
        body: {
          height: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      }}
    >
      <Tabs defaultValue="local" variant="outline" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Tabs.List style={{ flexShrink: 0 }}>
          <Tabs.Tab value="local" leftSection={<IconFolder size={16} />}>
            Local Packages
          </Tabs.Tab>
          <Tabs.Tab value="web" leftSection={<IconWorld size={16} />}>
            Web Packages
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="local" pt="md" style={{ flex: 1, overflow: 'auto' }}>
          <LocalPackages 
            project={project}
            isAuthorRunning={isAuthorRunning}
            isPublisherRunning={isPublisherRunning}
          />
        </Tabs.Panel>

        <Tabs.Panel value="web" pt="md" style={{ flex: 1, overflow: 'auto' }}>
          <WebPackages project={project} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
};

