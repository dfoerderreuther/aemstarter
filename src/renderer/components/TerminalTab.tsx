import { useState, useRef, useEffect } from 'react';
import { Group, Stack, Text, Box, ActionIcon, Select } from '@mantine/core';
import { Terminal as XTerm } from '@xterm/xterm';
import { Terminal, TerminalRef } from './Terminal';
import { IconChevronLeft, IconChevronRight, IconTextSize, IconEraser } from '@tabler/icons-react';
import { Project } from '../../types/Project';

interface TerminalTabProps {
  rootPath: string;
  visible?: boolean;
  viewMode?: 'tabs' | 'columns';
  project: Project;
  type: 'project' | 'dev';
}

export const TerminalTab = ({ 
  rootPath, 
  visible = true, 
  viewMode = 'tabs', 
  type = 'project',
  project
}: TerminalTabProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [terminalFontSize, setTerminalFontSize] = useState(11);
  
  const terminalRef = useRef<XTerm | null>(null);
  const terminalComponentRef = useRef<TerminalRef>(null);


  // Toggle collapse state
  const onToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Resize terminal after collapse state changes (CSS transition completes)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (terminalComponentRef.current) {
        terminalComponentRef.current.resize();
      }
    }, 350); // Slightly longer than the 300ms CSS transition

    return () => clearTimeout(timer);
  }, [isCollapsed]);

  useEffect(() => {
    if (visible) {
      setIsCollapsed(false);
    }
  }, [visible]);

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal;
    // Terminal is now connected to real shell, no need for custom messages
  };

  // Handle text size change from dropdown
  const handleFontSizeChange = (value: string | null) => {
    if (value) {
      setTerminalFontSize(parseInt(value));
    }
  };

  // Handle clear terminal
  const handleClearTerminal = () => {
    if (terminalComponentRef.current) {
      terminalComponentRef.current.clear();
    }
  };

  // Handle clicking on command text to insert into terminal
  const handleCommandClick = (command: string) => {
    if (terminalComponentRef.current) {
      terminalComponentRef.current.writeToShell(command);
      terminalComponentRef.current.focus();
    }
  };

  return (
    <>
      <Stack gap="0" style={{ height: '100%' }}>
        <Box p="xs" style={{ borderBottom: '1px solid #2C2E33', margin: 0 }}>
          <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
            <Text size="xs" fw={700} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              TERMINAL
            </Text>
            <Box style={{ flex: 1 }} />
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={handleClearTerminal}
              title="Clear terminal"
              style={{ cursor: 'pointer' }}
            >
              <IconEraser size={14} />
            </ActionIcon>
            <Select
              size="xs"
              value={terminalFontSize.toString()}
              onChange={handleFontSizeChange}
              data={[
                { value: '9', label: '9px' },
                { value: '11', label: '11px' },
                { value: '13', label: '13px' },
                { value: '16', label: '16px' }
              ]}
              style={{ width: '32px' }}
              variant="subtle"
              comboboxProps={{ withinPortal: true, width: 80 }}
              leftSection={<IconTextSize size={14} />}
              styles={{
                input: {
                  cursor: 'pointer',
                  caretColor: 'transparent',
                  color: 'transparent',
                  padding: '0 8px',
                  textAlign: 'center'
                },
                section: {
                  pointerEvents: 'none'
                },
                dropdown: {
                  minWidth: '80px'
                }
              }}
            />
          </Group>
        </Box>

        {/* Main content area with collapsible sidebar */}
        <Box style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: viewMode === 'columns' ? 'column' : 'row',
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* Collapsible Column - Left in tabs mode, Top in columns mode */}
          <Box style={{
            width: viewMode === 'columns' ? '100%' : (isCollapsed ? '40px' : '260px'),
            height: viewMode === 'columns' ? (isCollapsed ? '40px' : '170px') : '100%',
            transition: viewMode === 'columns' ? 'height 0.3s ease' : 'width 0.3s ease',
            borderRight: viewMode === 'columns' ? 'none' : '1px solid #2C2E33',
            borderBottom: viewMode === 'columns' ? '1px solid #2C2E33' : 'none',
            backgroundColor: '#1E1E1E',
            display: 'flex',
            flexDirection: viewMode === 'columns' ? 'column' : 'column',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Collapse/Expand Button - Integrated */}
            <Box style={{
              position: 'absolute',
              top: viewMode === 'columns' ? '8px' : '50%',
              right: viewMode === 'columns' ? '8px' : '8px',
              transform: viewMode === 'columns' ? 'none' : 'translateY(-50%)',
              zIndex: 10
            }}>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={onToggleCollapse}
                style={{ 
                  backgroundColor: 'rgba(58,58,58,1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px'
                }}
              >
                {viewMode === 'columns' ? 
                  (isCollapsed ? 
                    <IconChevronRight style={{ transform: 'rotate(90deg)' }} size={14} /> : 
                    <IconChevronLeft style={{ transform: 'rotate(90deg)' }} size={14} />
                  ) :
                  (isCollapsed ? 
                    <IconChevronRight size={14} /> : 
                    <IconChevronLeft size={14} />
                  )
                }
              </ActionIcon>
            </Box>

            {/* Column Content */}
            {!isCollapsed && (
              <Box p="sm" style={{ 
                flex: 1, 
                overflow: 'auto',
                display: 'flex',
                flexDirection: viewMode === 'columns' ? 'row' : 'column',
                gap: '12px',
                alignItems: viewMode === 'columns' ? 'flex-start' : 'stretch'
              }}>
                {/* Command shortcuts */}
                {(() => {
                  const projectCommands = [
                    `cd ${rootPath}`,
                    'ls -la',
                    'cd author',
                    'cd publisher', 
                    'tail -f crx-quickstart/logs/*',
                    'java -Xss16m -Xmx8g -jar oak-run.jar compact crx-quickstart/repository/segmentstore', 
                    'tail -f ~/Library/Application\\ Support/AEM-Starter/logs/main.log'
                  ];
                  
                  const devCommands = [
                    `cd ${rootPath}`,
                    'ls -la',
                    'mvn clean install -PautoInstallSinglePackage',
                    'mvn clean install -PautoInstallSinglePackagePublish',
                    `mvn clean install -PautoInstallSinglePackage -Daem.port=${project.settings?.author?.port}`,
                    `mvn clean install -PautoInstallSinglePackage -Daem.port=${project.settings?.publisher?.port}`,
                    'cd ui.frontend',
                    'npm install & npm run start'
                  ];
                  
                  const commands = type === 'project' ? projectCommands : devCommands;
                  
                  return (
                    <Stack gap="xs">
                      {commands.map((command, index) => (
                        <Text 
                          key={index}
                          size="xs" 
                          fw={500} 
                          c="dimmed" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleCommandClick(command)}
                          title="Click to insert into terminal"
                        >
                          {command}
                        </Text>
                      ))}
                    </Stack>
                  );
                })()}

                  
              </Box>
            )}
          </Box>

          {/* Terminal Section */}
          <Box style={{ 
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column', 
            backgroundColor: '#1A1A1A'
          }}>
            <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
              <Terminal 
                onReady={handleTerminalReady} 
                visible={visible} 
                fontSize={terminalFontSize} 
                cwd={rootPath}
                ref={terminalComponentRef} 
              />
            </div>
          </Box>
        </Box>
      </Stack>
    </>
  );
};