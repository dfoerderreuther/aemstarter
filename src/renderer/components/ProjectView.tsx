import React, { useEffect, useState } from 'react';
import { Tabs, Stack, Button, Tooltip, Divider } from '@mantine/core';
import { 
  IconColumns3, 
  IconColumns1, 
  IconServer, 
  IconEdit, 
  IconWorld, 
  IconRoute, 
  IconFolder, 
  IconTerminal, 
  IconCode, 
  IconTerminal2 
} from '@tabler/icons-react';
import { Project, ProjectSettings } from '../../types/Project';
import { AemInstanceView } from './AemInstanceView';
import { FilesView } from './files/FilesView';
import { DispatcherView } from './DispatcherView';
import { MainActionsView } from './MainActionsView';

interface ProjectViewProps {
  project: Project;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<string | null>('author');
  const [viewMode, setViewMode] = useState<'tabs' | 'columns'>('columns');
  const [isColumnsCollapsed, setIsColumnsCollapsed] = useState(false);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);

  useEffect(() => {
    if (viewMode === 'columns') {
      setActiveTab('instances');
    } else {
      setActiveTab('author');
    }
  }, [viewMode]);

  useEffect(() => {
    const loadProjectSettings = async () => {
      try {
        const settings = await window.electronAPI.getProjectSettings(project);
        setProjectSettings(settings);
      } catch (error) {
        console.error('Error loading project settings:', error);
      }
    };

    loadProjectSettings();
  }, [project]);

  const handleColumnsToggleCollapse = () => {
    setIsColumnsCollapsed(!isColumnsCollapsed);
  };



  return (
    <Stack 
      gap={0} 
      style={{ 
        height: 'calc(100vh - 55px)', // Subtract header height
        minHeight: 'calc(100vh - 55px)',
        backgroundColor: '#1A1B1E'
      }}
    >
      <MainActionsView project={project} projectSettings={projectSettings} setProjectSettings={setProjectSettings} />

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
            <>
            <Tabs.Tab value="instances" color="blue" leftSection={<IconServer size={16} />}>AEM Instances</Tabs.Tab>
            </>
          ) : (
            <>
              <Tabs.Tab value="author" color="blue" leftSection={<IconServer size={16} />}>AEM Author</Tabs.Tab>
              <Tabs.Tab value="publisher" color="blue" leftSection={<IconServer size={16} />}>AEM Publisher</Tabs.Tab>
              <Tabs.Tab value="dispatcher" color="blue" leftSection={<IconServer size={16} />}>AEM Dispatcher</Tabs.Tab>
            </>
          )
          }
          <Tabs.Tab value="files" color="blue" leftSection={<IconFolder size={16} />}>AEM Files</Tabs.Tab>
          <Tabs.Tab value="terminal" color="blue" leftSection={<IconTerminal size={16} />}>AEM Terminal</Tabs.Tab>
          {projectSettings?.dev?.path && (
            <>
              <Divider orientation='vertical' />
              <Tabs.Tab value="devfiles" color="green" leftSection={<IconFolder size={16} />}>Dev Files</Tabs.Tab>
              <Tabs.Tab value="devterminal" color="green" leftSection={<IconTerminal size={16} />}>Dev Terminal</Tabs.Tab>
            </>
          )}
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <Button.Group>
              <Tooltip label="Columns">
                <Button
                  color={viewMode === 'columns' ? 'blue' : 'gray'}
                  variant="subtle"
                  size="xs"
                  styles={{
                    root: { 
                      height: 30,
                      width: 30,
                      padding: 0,
                      backgroundColor: 'transparent',
                      border: 'none',
                      '&:hover': {
                        backgroundColor: 'transparent'
                      }
                    }
                  }}
                  onClick={() => setViewMode('columns')}
                >
                  <IconColumns3 size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="Tabs">
                <Button
                  color={viewMode === 'tabs' ? 'blue' : 'gray'}
                  variant="subtle"
                  size="xs"
                  styles={{
                    root: { 
                      height: 30,
                      width: 30,
                      padding: 0,
                      backgroundColor: 'transparent',
                      border: 'none',
                      '&:hover': {
                        backgroundColor: 'transparent'
                      }
                    }
                  }}
                  onClick={() => setViewMode('tabs')}
                >
                  <IconColumns1 size={16} />
                </Button>
              </Tooltip>
            </Button.Group>
          </div>
        </Tabs.List>

        <Tabs.Panel value="instances" style={{ height: '100%', padding: 0 }}>
          <div
            style={{
              display: 'flex',
              height: '100%'
            }}
          >
            <div
              style={{
                width: '33.33%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid #2C2E33'
              }}
            >
              <AemInstanceView 
                instance="author" 
                project={project} 
                visible={activeTab === 'instances'} 
                viewMode={viewMode}
                isCollapsed={viewMode === 'columns' ? isColumnsCollapsed : undefined}
                onToggleCollapse={viewMode === 'columns' ? handleColumnsToggleCollapse : undefined}
              />
            </div>
            <div
              style={{
                width: '33.33%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid #2C2E33'
              }}
            >
              <AemInstanceView 
                instance="publisher" 
                project={project} 
                visible={activeTab === 'instances'} 
                viewMode={viewMode}
                isCollapsed={viewMode === 'columns' ? isColumnsCollapsed : undefined}
                onToggleCollapse={viewMode === 'columns' ? handleColumnsToggleCollapse : undefined}
              />
            </div>
            <div
              style={{
                width: '33.33%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <DispatcherView 
                project={project} 
                visible={activeTab === 'instances'} 
                viewMode={viewMode}
                isCollapsed={viewMode === 'columns' ? isColumnsCollapsed : undefined}
                onToggleCollapse={viewMode === 'columns' ? handleColumnsToggleCollapse : undefined}
              />
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="author" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <AemInstanceView 
            instance="author" 
            project={project} 
            visible={activeTab === 'author'}
            viewMode={viewMode}
          />
        </Tabs.Panel>

        <Tabs.Panel value="publisher" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <AemInstanceView 
            instance="publisher" 
            project={project} 
            visible={activeTab === 'publisher'}
            viewMode={viewMode}
          />
        </Tabs.Panel>

        <Tabs.Panel value="dispatcher" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <DispatcherView 
            project={project} 
            visible={activeTab === 'dispatcher'}
            viewMode={viewMode}
          />
        </Tabs.Panel>

        <Tabs.Panel value="files" p="md">
          <FilesView rootPath={project.folderPath} />
        </Tabs.Panel>

        <Tabs.Panel value="devfiles" p="md">
          <FilesView rootPath={projectSettings?.dev?.path || ''} />
        </Tabs.Panel>
      </Tabs>

    </Stack>
  );
}; 