import React from 'react';
import { AppShell, Tabs, Group, Text, Stack } from '@mantine/core';
import { Project } from '../../types/Project';
import { AemInstanceView } from './AemInstanceView';
import { FilesView } from './FilesView';
import { DispatcherView } from './DispatcherView';
import { MainActionsView } from './MainActionsView';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  return (
    <AppShell
      padding={0}
      styles={{
        main: {
          backgroundColor: '#1A1B1E',
          padding: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <AppShell.Main>
        <Stack gap={0} style={{ height: '100vh', minHeight: '100vh' }}>
          <MainActionsView project={project} />

          <Tabs defaultValue="author" style={{ flex: 1 }}>
            <Tabs.List>
              <Tabs.Tab value="author">Author</Tabs.Tab>
              <Tabs.Tab value="publish">Publish</Tabs.Tab>
              <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
              <Tabs.Tab value="files">Files</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="author" p="md">
              <AemInstanceView instance="author" project={project} />
            </Tabs.Panel>

            <Tabs.Panel value="publish" p="md">
              <AemInstanceView instance="publisher" project={project} />
            </Tabs.Panel>

            <Tabs.Panel value="dispatcher" p="md">
              <DispatcherView />
            </Tabs.Panel>

            <Tabs.Panel value="files" p="md">
              <FilesView rootPath={project.folderPath} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}; 