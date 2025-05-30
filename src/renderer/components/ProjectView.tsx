import React, { useEffect, useState } from 'react';
import { Tabs, Stack, SegmentedControl, Grid } from '@mantine/core';
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
  const [viewMode, setViewMode] = useState<'tabs' | 'columns'>('tabs');

  useEffect(() => {
    if (viewMode === 'columns') {
      setActiveTab('instances');
    } else {
      setActiveTab('author');
    }
  }, [viewMode]);

  return (
    <Stack 
      gap={0} 
      style={{ 
        height: 'calc(100vh - 60px)', // Subtract header height
        minHeight: 'calc(100vh - 60px)',
        backgroundColor: '#1A1B1E'
      }}
    >
      <MainActionsView project={project} viewMode={viewMode} setViewMode={setViewMode} />

        <Tabs 
          defaultValue="author" 
          style={{ 
            flex: 1, 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
          value={activeTab || 'author'}
          onChange={setActiveTab}
        >
          <Tabs.List>
            {viewMode === 'columns' ? (
              <Tabs.Tab value="instances">Instances</Tabs.Tab>
            ) : (
              <>
                <Tabs.Tab value="author">Author</Tabs.Tab>
                <Tabs.Tab value="publisher">Publisher</Tabs.Tab>
                <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
              </>
            )
            }
            <Tabs.Tab value="files">Files</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="instances" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Grid style={{ flex: 1, height: '100%' }} gutter="md">
              <Grid.Col span={4} style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2C2E33' }}>
                <AemInstanceView instance="author" project={project} visible={true} />
              </Grid.Col>
              <Grid.Col span={4} style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2C2E33' }}>
                <AemInstanceView instance="publisher" project={project} visible={true} />
              </Grid.Col>
              <Grid.Col span={4} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <DispatcherView project={project} visible={true} />
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="author" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <AemInstanceView 
              instance="author" 
              project={project} 
              visible={activeTab === 'author'}
            />
          </Tabs.Panel>

          <Tabs.Panel value="publisher" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <AemInstanceView 
              instance="publisher" 
              project={project} 
              visible={activeTab === 'publisher'}
            />
          </Tabs.Panel>

          <Tabs.Panel value="dispatcher" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <DispatcherView 
              project={project} 
              visible={activeTab === 'dispatcher'}
            />
          </Tabs.Panel>

          <Tabs.Panel value="files" p="md">
            <FilesView rootPath={project.folderPath} />
          </Tabs.Panel>
        </Tabs>

    </Stack>
  );
}; 