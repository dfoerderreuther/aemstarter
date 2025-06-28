import { Box, Stack, Text, Accordion } from '@mantine/core';
import { Project } from '../../types/Project';
import { useState, useEffect } from 'react';

interface CommandItem {
  command?: string;
  url?: string;
  name?: string;
  active?: boolean;
}

interface CommandSection {
  [sectionName: string]: {
    type?: 'project' | 'dev';
    items: CommandItem[];
  };
}

interface TerminalTabQuickCommandsProps {
  rootPath: string;
  project: Project;
  type: 'project' | 'dev';
  viewMode: 'tabs' | 'columns';
  onCommandClick: (command: string) => void;
}

export const TerminalTabQuickCommands = ({ 
  rootPath, 
  project, 
  type, 
  viewMode, 
  onCommandClick 
}: TerminalTabQuickCommandsProps) => {
  const [containerId, setContainerId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchContainerId = async () => {
      try {
        const id = await window.electronAPI.getDispatcherContainerId(project);
        setContainerId(id);
      } catch (error) {
        console.error('Error fetching dispatcher container ID:', error);
        setContainerId(null);
      }
    };
    
    // Fetch container ID initially
    fetchContainerId();
    
    // Listen for dispatcher status changes
    const cleanup = window.electronAPI.onDispatcherStatus((data) => {
      if (data.projectId === project.id) {
        if (data.isRunning) {
          // Dispatcher started, fetch new container ID
          fetchContainerId();
        } else {
          // Dispatcher stopped, clear container ID
          setContainerId(null);
        }
      }
    });
    
    return cleanup;
  }, [project]);
  const commands: CommandSection = {
    'Basic': {
      items: [
        { command: `clear` },
        { command: `cd ${rootPath}` },
        { command: 'ls -la' }
      ]
    },
    'AEM Instance Management': {
      type: 'project',
      items: [
        { command: `cd ${rootPath}/author`, name: 'Navigate to Author' },
        { command: `cd ${rootPath}/publisher`, name: 'Navigate to Publisher' },
        { command: 'tail -f crx-quickstart/logs/*', name: 'Watch Instance Logs' },
        { command: 'java -Xss16m -Xmx8g -jar oak-run.jar compact crx-quickstart/repository/segmentstore', name: 'Compact Repository' }
      ]
    },
    'Dispatcher Management': {
      type: 'project',
      items: [
        { url: 'https://docs.docker.com/reference/cli/docker/', name: 'Docker CLI Reference' },
        { command: `cd ${rootPath}/dispatcher`, name: 'Navigate to Dispatcher' },
        { command: `docker ps`, name: 'Docker Processes' },
        { command: `docker logs  --follow ${containerId || 'dispatcher'}`, active: containerId !== null, name: 'Dispatcher Logs' },
        { command: `docker exec -it ${containerId || 'dispatcher'} /bin/bash`, active: containerId !== null, name: 'Shell into Dispatcher' }
      ]
    },
    'Maven': {
      type: 'dev',
      items: [
        { url: 'https://github.com/adobe/aem-project-archetype', name: 'AEM Project Archetype' },
        { command: `mvn -B org.apache.maven.plugins:maven-archetype-plugin:3.3.1:generate \
-D archetypeGroupId=com.adobe.aem \
-D archetypeArtifactId=aem-project-archetype \
-D archetypeVersion=54 \
-D appTitle="My Site" \
-D appId="mysite" \
-D groupId="com.mysite"`, name: 'Create AEM Project' },
        { command: `mvn clean install -PautoInstallSinglePackage -Daem.port=${project.settings?.author?.port}`, name: `Deploy to Author (Port ${project.settings?.author?.port})` },
        { command: `mvn clean install -PautoInstallSinglePackage -Daem.port=${project.settings?.publisher?.port}`, name: `Deploy to Publisher (Port ${project.settings?.publisher?.port})` }
      ]
    },
    'Frontend': {
      type: 'dev',
      items: [
        { command: `cd ${rootPath}/ui.frontend`, name: 'Navigate to Frontend' },
        { command: 'npm install & npm run start', name: 'Install & Start Frontend' }
      ]
    },
    'RDE': {
      type: 'dev',
      items: [
        { url: 'https://experienceleague.adobe.com/docs/experience-manager-learn/cloud-service/developing/rde/overview.html', name: 'RDE Documentation' },
        { command: 'aio aem:rde:status', name: 'Check RDE Status' },
        { command: 'aio aem:rde:setup', name: 'Setup RDE' },
        { command: 'aio aem:rde:deploy', name: 'Deploy to RDE' }
      ]
    },
    'AEM Starter Logging': {
      items: [
        { command: 'tail -f ~/Library/Application\\ Support/AEM-Starter/logs/main.log', name: 'Watch AEM Starter Logs' }
      ]
    }
  };
  
  // Filter sections based on type matching
  const filteredCommands = Object.entries(commands).filter(([, section]) => 
    !section.type || section.type === type
  );
  
  // Open first filtered section by default
  const defaultOpenSection = filteredCommands.length > 0 ? filteredCommands[0][0] : '';
  
  const handleItemClick = (item: CommandItem) => {
    // Don't handle clicks for inactive items
    const isActive = item.active !== false; // Default to true if not specified
    if (!isActive) return;
    
    if (item.command) {
      onCommandClick(item.command);
    } else if (item.url) {
      window.electronAPI.openUrl(item.url);
    }
  };

  return (
    <Box style={{ 
      flex: 1, 
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Accordion defaultValue={defaultOpenSection}>
        {filteredCommands.map(([sectionName, section]) => (
          <Accordion.Item key={sectionName} value={sectionName}>
            <Accordion.Control>
              <Text fw={500} size="sm">{sectionName}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {section.items.map((item, index) => {
                  const isActive = item.active !== false; // Default to true if not specified
                  return (
                    <Text 
                      key={index}
                      size="xs" 
                      fw={400} 
                      c={!isActive ? "gray.5" : (item.url ? "blue" : "dimmed")}
                      style={{ 
                        cursor: isActive ? 'pointer' : 'not-allowed',
                        textDecoration: item.url ? 'underline' : 'none',
                        opacity: isActive ? 1 : 0.5
                      }}
                      onClick={() => handleItemClick(item)}
                      title={item.command || item.url || ''}
                    >
                      {item.name || item.command || item.url}
                    </Text>
                  );
                })}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}; 