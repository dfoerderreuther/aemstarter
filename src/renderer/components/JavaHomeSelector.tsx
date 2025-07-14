import React, { useState, useEffect } from 'react';
import { Group, TextInput, Button, Menu, Box, Tooltip, ActionIcon } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface JavaHomeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const JavaHomeSelector: React.FC<JavaHomeSelectorProps> = ({
  value,
  onChange
}) => {
  const [javaHomePaths, setJavaHomePaths] = useState<string[]>([]);
  const [javaPathsLoading, setJavaPathsLoading] = useState(false);
  const [javaPathsError, setJavaPathsError] = useState<string | null>(null);

  useEffect(() => {
    loadJavaHomePaths();
  }, []);

  const loadJavaHomePaths = async () => {
    try {
      setJavaPathsLoading(true);
      setJavaPathsError(null);
      const paths = await window.electronAPI.getJavaHomePaths();
      setJavaHomePaths(paths);
    } catch (error) {
      console.error('Error loading Java home paths:', error);
      setJavaPathsError(error instanceof Error ? error.message : 'Failed to detect Java installations');
      setJavaHomePaths([]);
    } finally {
      setJavaPathsLoading(false);
    }
  };

  const handleBrowse = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Java Home Folder',
      buttonLabel: 'Select Folder',
      message: 'Select the Java home folder',
      defaultPath: value || undefined
    });
    if (!result.canceled && result.filePaths.length > 0) {
      onChange(result.filePaths[0]);
    }
  };

  return (
    <Group w="100%" gap="xs" align="end">
      <TextInput
        label="Java Home"
        description="Path to the Java home directory"
        value={value}
        style={{ flex: 1 }}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {javaPathsError ? (
        <Tooltip 
          label={`Automatic Java detection failed: ${javaPathsError}`}
          multiline
          w={300}
        >
          <ActionIcon 
            variant="light" 
            color="orange"
            size="lg"
            style={{ marginTop: '20px' }}
          >
            <IconAlertCircle size={16} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Box style={{ alignSelf: 'flex-end' }}>
          <Menu disabled={javaPathsLoading}>
            <Menu.Target>
              <Button 
                variant="outline" 
                size="xs"
                disabled={javaPathsLoading}
              >
                {javaPathsLoading ? "Loading" : "Select"}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {javaHomePaths.map(path => (
                <Menu.Item 
                  key={path}
                  onClick={() => onChange(path)}
                >
                  {path === value ? path + " ✓" : path}
                </Menu.Item>
              ))}
              {javaHomePaths.length === 0 && !javaPathsLoading && (
                <Menu.Item disabled>No Java paths found</Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Box>
      )}
      <Button 
        variant="outline" 
        size="xs"
        onClick={handleBrowse}
      >
        Browse
      </Button>
    </Group>
  );
}; 