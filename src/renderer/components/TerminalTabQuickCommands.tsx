import { Box, Stack, Text, Accordion } from '@mantine/core';
import { Project } from '../../types/Project';

interface CommandItem {
  command?: string;
  url?: string;
  name?: string;
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
  const commands: CommandSection = {
    'Basic': {
      items: [
        { command: `clear` },
        { command: `cd ${rootPath}` },
        { command: 'ls -la' }
      ]
    },
    'Instance Management': {
      type: 'project',
      items: [
        { command: `cd ${rootPath}/author`, name: 'Navigate to Author' },
        { command: `cd ${rootPath}/publisher`, name: 'Navigate to Publisher' },
        { command: 'tail -f crx-quickstart/logs/*', name: 'Watch Instance Logs' },
        { command: 'java -Xss16m -Xmx8g -jar oak-run.jar compact crx-quickstart/repository/segmentstore', name: 'Compact Repository' }
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
                {section.items.map((item, index) => (
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