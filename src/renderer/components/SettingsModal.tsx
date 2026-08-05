import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Stack, TextInput, NumberInput, Group, Button, Text, Checkbox, Select, ActionIcon, Tooltip, ButtonGroup, Menu, Box } from '@mantine/core';
import { IconFolder, IconAlertCircle } from '@tabler/icons-react';
import { Project, ProjectSettings, SslProxySettings } from '../../types/Project';
import { EditorAvailableResults } from '../../types/EditorAvailableResults';
import { JavaHomeSelector } from './JavaHomeSelector';

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
      const updated = await window.electronAPI.saveProjectSettings(project, settings);
      
      // Notify parent component about the updated project
      if (onProjectUpdated && updated) {
        onProjectUpdated(updated);
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

  const updateSslSettings = (proxyType: 'author' | 'publisher' | 'dispatcher', field: keyof SslProxySettings, value: any) => {
    if (!settings) return;
    
    const currentSsl = settings.ssl || {
      author: { enabled: false, port: 8502 },
      publisher: { enabled: false, port: 8503 },
      dispatcher: { enabled: false, port: 443 }
    };
    
    const updatedSsl = {
      ...currentSsl,
      [proxyType]: {
        ...currentSsl[proxyType],
        [field]: value
      }
    };
    
    // Keep https in sync with dispatcher for backward compatibility
    const updatedHttps = proxyType === 'dispatcher' 
      ? { enabled: updatedSsl.dispatcher.enabled, port: updatedSsl.dispatcher.port }
      : settings.https;
    
    setSettings({
      ...settings,
      ssl: updatedSsl,
      https: updatedHttps
    });
  };

  const updateDevSettings = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      dev: {
        ...(settings.dev || {
          path: '', editor: 'code', customEditorPath: '',
          claudeCodeEnabled: false, claudeCodeMcpSdkVersion: '^1.0.0',
          claudeCodeMcpTargets: { author: true, publisher: true, dispatcher: true }
        }),
        [field]: value
      }
    });
  };

  const updateClaudeTarget = (target: 'author' | 'publisher' | 'dispatcher', value: boolean) => {
    if (!settings) return;
    const currentTargets = settings.dev?.claudeCodeMcpTargets || { author: true, publisher: true, dispatcher: true };
    updateDevSettings('claudeCodeMcpTargets', { ...currentTargets, [target]: value });
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
          <Tabs.Tab value="https">SSL Proxy</Tabs.Tab>
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
              description="Turn off if health check interferes with debugging or log output."
              checked={settings.general.healthCheck}
              onChange={(event) => updateGeneralSettings('healthCheck', event.currentTarget.checked)}
            />

            <JavaHomeSelector
              value={settings.general.javaHome}
              onChange={(value) => updateGeneralSettings('javaHome', value)}
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
              label="Environment Variables"
              description="Environment variables for the author instance"
              value={settings.author.envVars}
              onChange={(event) => updateAuthorSettings('envVars', event.currentTarget.value)}
            />
            
            <TextInput
              label="Health Check Path"
              description="Path to the document the sytem should check for health and take screenshot of. Default is /."
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
              label="Environment Variables"
              description="Environment variables for the publisher instance"
              value={settings.publisher.envVars}
              onChange={(event) => updatePublisherSettings('envVars', event.currentTarget.value)}
            />
            
            <TextInput
              label="Health Check Path"
              description="Path to the document the sytem should check for health and take screenshot of. Default is /."
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
              description="Path to the document the sytem should check for health and take screenshot of. Default is /."
              value={settings.dispatcher.healthCheckPath}
              onChange={(event) => updateDispatcherSettings('healthCheckPath', event.currentTarget.value)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="https" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Configure SSL proxies for Author, Publisher, and Dispatcher. Each proxy can be enabled independently and will use a self-signed certificate generated with OpenSSL.
            </Text>
            
            {/* Author SSL Proxy */}
            <Box style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--mantine-color-dark-6)' }}>
              <Stack gap="sm">
                <Text fw={500}>Author SSL Proxy</Text>
                <Group grow align="flex-start">
                  <Checkbox
                    label="Enabled"
                    description={`Proxy HTTPS → http://localhost:${settings.author?.port || 4502}`}
                    checked={settings.ssl?.author?.enabled || false}
                    onChange={(event) => updateSslSettings('author', 'enabled', event.currentTarget.checked)}
                  />
                  <NumberInput
                    label="HTTPS Port"
                    description="SSL proxy port for Author"
                    value={settings.ssl?.author?.port || 8502}
                    onChange={(value) => updateSslSettings('author', 'port', value)}
                    min={1}
                    max={65535}
                    disabled={!settings.ssl?.author?.enabled}
                  />
                </Group>
              </Stack>
            </Box>
            
            {/* Publisher SSL Proxy */}
            <Box style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--mantine-color-dark-6)' }}>
              <Stack gap="sm">
                <Text fw={500}>Publisher SSL Proxy</Text>
                <Group grow align="flex-start">
                  <Checkbox
                    label="Enabled"
                    description={`Proxy HTTPS → http://localhost:${settings.publisher?.port || 4503}`}
                    checked={settings.ssl?.publisher?.enabled || false}
                    onChange={(event) => updateSslSettings('publisher', 'enabled', event.currentTarget.checked)}
                  />
                  <NumberInput
                    label="HTTPS Port"
                    description="SSL proxy port for Publisher"
                    value={settings.ssl?.publisher?.port || 8503}
                    onChange={(value) => updateSslSettings('publisher', 'port', value)}
                    min={1}
                    max={65535}
                    disabled={!settings.ssl?.publisher?.enabled}
                  />
                </Group>
              </Stack>
            </Box>
            
            {/* Dispatcher SSL Proxy */}
            <Box style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--mantine-color-dark-6)' }}>
              <Stack gap="sm">
                <Text fw={500}>Dispatcher SSL Proxy</Text>
                <Group grow align="flex-start">
                  <Checkbox
                    label="Enabled"
                    description={`Proxy HTTPS → http://localhost:${settings.dispatcher?.port || 80}`}
                    checked={settings.ssl?.dispatcher?.enabled || false}
                    onChange={(event) => updateSslSettings('dispatcher', 'enabled', event.currentTarget.checked)}
                  />
                  <NumberInput
                    label="HTTPS Port"
                    description="SSL proxy port for Dispatcher"
                    value={settings.ssl?.dispatcher?.port || 443}
                    onChange={(value) => updateSslSettings('dispatcher', 'port', value)}
                    min={1}
                    max={65535}
                    disabled={!settings.ssl?.dispatcher?.enabled}
                  />
                </Group>
              </Stack>
            </Box>
            
            <Text size="xs" c="dimmed">
              Note: All SSL proxies share the same self-signed certificate, which is generated on first start in the project's ssl folder.
            </Text>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="dev" pt="md">
          <Stack gap="md">
            <Group gap="xs" align="end">
              <TextInput
                label="Development Path"
                description="Path to development folder. This is usually the root folder of your AEM Maven project."
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
              description="Select your preferred code editor. Available editors are marked with a checkmark (✓)."
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

            {/* Claude Code integration */}
            <Box style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--mantine-color-dark-6)' }}>
              <Stack gap="sm">
                <Text fw={500}>Claude Code</Text>
                <Checkbox
                  label="Enable Claude Code integration"
                  description="Adds a Claude Code tab with MCP connections to the running AEM instances."
                  checked={settings.dev?.claudeCodeEnabled || false}
                  onChange={(event) => updateDevSettings('claudeCodeEnabled', event.currentTarget.checked)}
                />

                {settings.dev?.claudeCodeEnabled && (
                  <>
                    <Select
                      label="MCP SDK Version"
                      description="Version of @modelcontextprotocol/sdk the bundled MCP server uses."
                      value={settings.dev?.claudeCodeMcpSdkVersion || '^1.0.0'}
                      onChange={(value) => value && updateDevSettings('claudeCodeMcpSdkVersion', value)}
                      data={[
                        { value: '^1.0.0', label: '1.x (@modelcontextprotocol/sdk ^1.0.0)' }
                      ]}
                    />
                    <Text size="sm" fw={500}>MCP Connections</Text>
                    <Text size="xs" c="dimmed">
                      Each enabled target becomes an MCP connection Claude can use against the running instance. Author uses admin/admin.
                    </Text>
                    <Checkbox
                      label="aem-author"
                      description={`Content read/write against http://localhost:${settings.author?.port || 4502}`}
                      checked={settings.dev?.claudeCodeMcpTargets?.author ?? true}
                      onChange={(event) => updateClaudeTarget('author', event.currentTarget.checked)}
                    />
                    <Checkbox
                      label="aem-publisher"
                      description={`Content read/write against http://localhost:${settings.publisher?.port || 4503}`}
                      checked={settings.dev?.claudeCodeMcpTargets?.publisher ?? true}
                      onChange={(event) => updateClaudeTarget('publisher', event.currentTarget.checked)}
                    />
                    <Checkbox
                      label="aem-dispatcher"
                      description="Cache, config and container inspection for the dispatcher"
                      checked={settings.dev?.claudeCodeMcpTargets?.dispatcher ?? true}
                      onChange={(event) => updateClaudeTarget('dispatcher', event.currentTarget.checked)}
                    />
                  </>
                )}
              </Stack>
            </Box>
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