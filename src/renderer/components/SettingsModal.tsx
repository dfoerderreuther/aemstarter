import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Stack, TextInput, NumberInput, Group, Button, Text, Checkbox } from '@mantine/core';
import { Project } from '../../types/Project';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
}

interface ProjectSettings {
  version: string;
  general: {
    name: string;
  };
  author: {
    port: number;
    runmode: string;
    jvmOpts: string;
    debugJvmOpts: string;
    healthCheck: boolean;
  };
  publisher: {
    port: number;
    runmode: string;
    jvmOpts: string;
    debugJvmOpts: string;
    healthCheck: boolean;
  };
  dispatcher: {
    port: number;
    config: string;
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ opened, onClose, project }) => {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && project) {
      loadSettings();
    }
  }, [opened, project]);

  const loadSettings = async () => {
    try {
      const projectSettings = await window.electronAPI.getProjectSettings(project);
      setSettings(projectSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } 
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      await window.electronAPI.saveProjectSettings(project, settings);
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
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
            <TextInput
              label="Project Name"
              value={settings.general.name}
              onChange={(event) => updateGeneralSettings('name', event.currentTarget.value)}
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
            
            <Checkbox
              label="Health Check"
              checked={settings.author.healthCheck}
              onChange={(event) => updateAuthorSettings('healthCheck', event.currentTarget.checked)}
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
            
            <Checkbox
              label="Health Check"
              checked={settings.publisher.healthCheck}
              onChange={(event) => updatePublisherSettings('healthCheck', event.currentTarget.checked)}
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
            
            
            <TextInput
              label="Config Path"
              description="Path to dispatcher configuration"
              value={settings.dispatcher.config}
              onChange={(event) => updateDispatcherSettings('config', event.currentTarget.value)}
            />
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