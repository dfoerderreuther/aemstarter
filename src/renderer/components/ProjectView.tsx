import React, { useState } from 'react';
import { Tabs, Stack } from '@mantine/core';
import { Project } from '../../types/Project';
import { AemInstanceView } from './AemInstanceView';
import { FilesView } from './FilesView';
import { DispatcherView } from './DispatcherView';
import { MainActionsView } from './MainActionsView';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<string | null>('author');

  return (
    <Stack 
      gap={0} 
      style={{ 
        height: 'calc(100vh - 60px)', // Subtract header height
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: '#1A1B1E'
      }}
    >
      <MainActionsView project={project} />

      <Tabs 
        defaultValue="author" 
        style={{ 
          flex: 1, 
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        onChange={setActiveTab}
      >
        <Tabs.List>
          <Tabs.Tab value="author">Author</Tabs.Tab>
          <Tabs.Tab value="publish">Publish</Tabs.Tab>
          <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="author" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <AemInstanceView 
            instance="author" 
            project={project} 
            visible={activeTab === 'author'}
          />
        </Tabs.Panel>

        <Tabs.Panel value="publish" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <AemInstanceView 
            instance="publisher" 
            project={project} 
            visible={activeTab === 'publish'}
          />
        </Tabs.Panel>

        <Tabs.Panel value="dispatcher">
          <DispatcherView />
        </Tabs.Panel>

        <Tabs.Panel value="files" p="md">
          <FilesView rootPath={project.folderPath} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}; 