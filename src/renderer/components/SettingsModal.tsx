import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Stack, TextInput, NumberInput, Group, Button, Text, Checkbox, Select, ActionIcon } from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';
import { Project, ProjectSettings } from '../../types/Project';
import { EditorAvailableResults } from '../../types/EditorAvailableResults';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdated?: (updatedProject: Project) => void;
}



export const SettingsModal: React.FC<SettingsModalProps> = ({ opened, onClose, project, onProjectUpdated }) => {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorAvailability, setEditorAvailability] = useState<EditorAvailableResults | null>(null);

  useEffect(() => {
    if (opened && project) {
      loadSettings();
      loadEditorAvailability();
    }
  }, [opened, project]);

  const loadSettings = () => {
    try {
      // Use settings from the project object - should always be available now
      setSettings(project.settings || null);
    } catch (error) {
      console.error('Error loading settings:', error);
    } 
  };

  const loadEditorAvailability = async () => {
    try {
      const availability = await window.electronAPI.checkEditorAvailability();
      setEditorAvailability(availability);
    } catch (error) {
      console.error('Error checking editor availability:', error);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      const updatedProject = await window.electronAPI.saveProjectSettings(project, settings);
      
      // Notify parent component about the updated project
      if (onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateGeneralSettings = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      general: {
        ...settings.general,
        [field]: value
      }
    });
  };

  const updateAuthorSettings = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      author: {
        ...settings.author,
        [field]: value
      }
    });
  };

  const updatePublisherSettings = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      publisher: {
        ...settings.publisher,
        [field]: value
      }
    });
  };

  const updateDispatcherSettings = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      dispatcher: {
        ...settings.dispatcher,
        [field]: value
      }
    });
  };

  const updateDevSettings = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      dev: {
        ...(settings.dev || { path: '', editor: 'code', customEditorPath: '' }),
        [field]: value
      }
    });
  };

  const handleSelectDevPath = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Development Path',
      buttonLabel: 'Select Folder',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      updateDevSettings('path', result.filePaths[0]);
    }
  };

  const handleSelectCustomEditorPath = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Custom Editor Executable',
      buttonLabel: 'Select File',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      updateDevSettings('customEditorPath', result.filePaths[0]);
    }
  };

  const getEditorAvailabilityIcon = (editorKey: 'visualStudioCode' | 'cursor' | 'idea') => {
    if (!editorAvailability) return '';
    return editorAvailability[editorKey] ? ' ✓' : ' ✗';
  };

  if (!settings) {
    return (
      <Modal opened={opened} onClose={onClose} title="Project Settings" size="lg">
        <Text>Loading settings...</Text>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Project Settings" size="lg">
      <Tabs defaultValue="general">
        <Tabs.List>
          <Tabs.Tab value="general">General</Tabs.Tab>
          <Tabs.Tab value="author">Author</Tabs.Tab>
          <Tabs.Tab value="publisher">Publisher</Tabs.Tab>
          <Tabs.Tab value="dispatcher">Dispatcher</Tabs.Tab>
          <Tabs.Tab value="dev">Dev</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
            <TextInput
              label="Project Name"
              value={settings.general.name}
              onChange={(event) => updateGeneralSettings('name', event.currentTarget.value)}
            />
            <Checkbox
              label="Health Check"
              checked={settings.general.healthCheck}
              onChange={(event) => updateGeneralSettings('healthCheck', event.currentTarget.checked)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="author" pt="md">
          <Stack gap="md">
            <NumberInput
              label="Port"
              description="Port number for the author instance"
              value={settings.author.port}
              onChange={(value) => updateAuthorSettings('port', value)}
              min={1024}
              max={65535}
            />
            
            <TextInput
              label="Run Mode"
              description="Comma-separated run modes"
              value={settings.author.runmode}
              onChange={(event) => updateAuthorSettings('runmode', event.currentTarget.value)}
            />
            
            <TextInput
              label="JVM Options"
              description="JVM options for the author instance"
              value={settings.author.jvmOpts}
              onChange={(event) => updateAuthorSettings('jvmOpts', event.currentTarget.value)}
            />
            
            <TextInput
              label="Debug JVM Options"
              description="Additional JVM options for debugging"
              value={settings.author.debugJvmOpts}
              onChange={(event) => updateAuthorSettings('debugJvmOpts', event.currentTarget.value)}
            />
            
            <TextInput
              label="Health Check Path"
              description="Path to health check service"
              value={settings.author.healthCheckPath}
              onChange={(event) => updateAuthorSettings('healthCheckPath', event.currentTarget.value)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="publisher" pt="md">
          <Stack gap="md">
            <NumberInput
              label="Port"
              description="Port number for the publisher instance"
              value={settings.publisher.port}
              onChange={(value) => updatePublisherSettings('port', value)}
              min={1024}
              max={65535}
            />
            
            <TextInput
              label="Run Mode"
              description="Comma-separated run modes"
              value={settings.publisher.runmode}
              onChange={(event) => updatePublisherSettings('runmode', event.currentTarget.value)}
            />
            
            <TextInput
              label="JVM Options"
              description="JVM options for the publisher instance"
              value={settings.publisher.jvmOpts}
              onChange={(event) => updatePublisherSettings('jvmOpts', event.currentTarget.value)}
            />
            
            <TextInput
              label="Debug JVM Options"
              description="Additional JVM options for debugging"
              value={settings.publisher.debugJvmOpts}
              onChange={(event) => updatePublisherSettings('debugJvmOpts', event.currentTarget.value)}
            />
            
            <TextInput
              label="Health Check Path"
              description="Path to health check service"
              value={settings.publisher.healthCheckPath}
              onChange={(event) => updatePublisherSettings('healthCheckPath', event.currentTarget.value)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="dispatcher" pt="md">
          <Stack gap="md">
            <NumberInput
              label="Port"
              description="Port number for the dispatcher"
              value={settings.dispatcher.port}
              onChange={(value) => updateDispatcherSettings('port', value)}
              min={1}
              max={65535}
            />
            
            <Group align="end" gap="xs">
              <TextInput
                label="Config Path"
                description="Path to dispatcher configuration"
                value={settings.dispatcher.config}
                onChange={(event) => updateDispatcherSettings('config', event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  const result = await window.electronAPI.showOpenDialog({
                    properties: ['openDirectory'],
                    title: 'Select Dispatcher Configuration Folder',
                    buttonLabel: 'Select Folder',
                    message: 'Select the dispatcher configuration folder'
                  });
                  if (!result.canceled && result.filePaths.length > 0) {
                    updateDispatcherSettings('config', result.filePaths[0]);
                  }
                }}
              >
                Browse
              </Button>
            </Group>
            <TextInput
              label="Health Check Path"
              description="Path to health check service"
              value={settings.dispatcher.healthCheckPath}
              onChange={(event) => updateDispatcherSettings('healthCheckPath', event.currentTarget.value)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="dev" pt="md">
          <Stack gap="md">
            <Group gap="xs" align="end">
              <TextInput
                label="Development Path"
                description="Path to development folder"
                value={settings.dev?.path || ''}
                onChange={(event) => updateDevSettings('path', event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                variant="filled"
                onClick={handleSelectDevPath}
                size="lg"
              >
                <IconFolder size={16} />
              </ActionIcon>
            </Group>
            
            <Select
              label="Editor"
              description="Select your preferred code editor"
              value={settings.dev?.editor || ''}
              onChange={(value) => updateDevSettings('editor', value)}
              data={[
                { value: '', label: 'None' },
                { value: 'code', label: `Visual Studio Code${getEditorAvailabilityIcon('visualStudioCode')}` },
                { value: 'cursor', label: `Cursor${getEditorAvailabilityIcon('cursor')}` },
                { value: 'idea', label: `IntelliJ IDEA${getEditorAvailabilityIcon('idea')}` },
                { value: 'custom', label: 'Custom' }
              ]}
            />
            
            {(settings.dev?.editor || 'code') === 'custom' && (
              <Group gap="xs" align="end">
                <TextInput
                  label="Custom Editor Path"
                  description="Path to custom editor executable"
                  value={settings.dev?.customEditorPath || ''}
                  onChange={(event) => updateDevSettings('customEditorPath', event.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <ActionIcon
                  variant="filled"
                  onClick={handleSelectCustomEditorPath}
                  size="lg"
                >
                  <IconFolder size={16} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="xl">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Save Settings
        </Button>
      </Group>
    </Modal>
  );
}; 