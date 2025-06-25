import { Box, Stack, Text, Accordion } from '@mantine/core';
import { Project } from '../../types/Project';

interface CommandItem {
  command?: string;
  url?: string;
  name?: string;
}

interface CommandSection {
  [sectionName: string]: CommandItem[];
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
  const commands: CommandSection = {
    'Instance Management': [
      { command: 'cd author', name: 'Navigate to Author' },
      { command: 'cd publisher', name: 'Navigate to Publisher' },
      { command: 'tail -f crx-quickstart/logs/*', name: 'Watch Instance Logs' },
      { command: 'java -Xss16m -Xmx8g -jar oak-run.jar compact crx-quickstart/repository/segmentstore', name: 'Compact Repository' }
    ],
    'Maven': [
      { command: 'mvn clean install -PautoInstallSinglePackage', name: 'Build & Deploy to Author' },
      { command: 'mvn clean install -PautoInstallSinglePackagePublish', name: 'Build & Deploy to Publisher' },
      { command: `mvn clean install -PautoInstallSinglePackage -Daem.port=${project.settings?.author?.port}`, name: `Deploy to Author (Port ${project.settings?.author?.port})` },
      { command: `mvn clean install -PautoInstallSinglePackage -Daem.port=${project.settings?.publisher?.port}`, name: `Deploy to Publisher (Port ${project.settings?.publisher?.port})` }
    ],
    'Frontend': [
      { command: 'cd ui.frontend', name: 'Navigate to Frontend' },
      { command: 'npm install & npm run start', name: 'Install & Start Frontend' }
    ],
    'Navigation': [
      { command: `cd ${rootPath}`, name: 'Go to Project Root' },
      { command: 'ls -la', name: 'List Files' }
    ],
    'AEM Starter Logging': [
      { command: 'tail -f ~/Library/Application\\ Support/AEM-Starter/logs/main.log', name: 'Watch AEM Starter Logs' }
    ],
    'RDE (Rapid Development Environment)': [
      { url: 'https://experienceleague.adobe.com/docs/experience-manager-learn/cloud-service/developing/rde/overview.html', name: 'RDE Documentation' },
      { command: 'aio aem:rde:status', name: 'Check RDE Status' },
      { command: 'aio aem:rde:setup', name: 'Setup RDE' },
      { command: 'aio aem:rde:deploy', name: 'Deploy to RDE' }
    ]
  };
  const defaultOpenSection = type === 'project' ? 'Instance Management' : 'Maven';
  
  const handleItemClick = (item: CommandItem) => {
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
        {Object.entries(commands).map(([sectionName, items]) => (
          <Accordion.Item key={sectionName} value={sectionName}>
            <Accordion.Control>
              <Text fw={500} size="sm">{sectionName}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {items.map((item, index) => (
                  <Text 
                    key={index}
                    size="xs" 
                    fw={400} 
                    c={item.url ? "blue" : "dimmed"}
                    style={{ 
                      cursor: 'pointer',
                      textDecoration: item.url ? 'underline' : 'none'
                    }}
                    onClick={() => handleItemClick(item)}
                    title={item.command || item.url || ''}
                  >
                    {item.name || item.command || item.url}
                  </Text>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}; 