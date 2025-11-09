import React, { useState, useEffect } from 'react';
import { Modal, Stack, Switch, Text, Button, Select, Group, Loader, Alert, ActionIcon, Badge } from '@mantine/core';
import { IconRefresh, IconDownload, IconExternalLink, IconCheck } from '@tabler/icons-react';

interface GithubRelease {
  version: string;
  name: string;
  publishedAt: string;
  url: string;
  isCurrentVersion: boolean;
}

interface UpdatesModalProps {
  opened: boolean;
  onClose: () => void;
}

export const UpdatesModal: React.FC<UpdatesModalProps> = ({ opened, onClose }) => {
  const [autoUpdatesEnabled, setAutoUpdatesEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');

  useEffect(() => {
    if (opened) {
      loadSettings();
      loadReleases();
    }
  }, [opened]);

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.getGlobalSettings();
      setAutoUpdatesEnabled(settings.autoUpdatesEnabled ?? true);
    } catch (error) {
      console.error('Error loading update settings:', error);
    }
  };

  const loadReleases = async () => {
    try {
      setLoadingReleases(true);
      const fetchedReleases = await window.electronAPI.fetchGithubReleases();
      setReleases(fetchedReleases);

      // Set current version as selected by default
      const currentRelease = fetchedReleases.find(release => release.isCurrentVersion);
      if (currentRelease) {
        setSelectedVersion(currentRelease.version);
      }
    } catch (error) {
      console.error('Error fetching releases:', error);
    } finally {
      setLoadingReleases(false);
    }
  };

  const handleAutoUpdatesToggle = async (enabled: boolean) => {
    try {
      setLoading(true);
      await window.electronAPI.setAutoUpdatesEnabled(enabled);
      setAutoUpdatesEnabled(enabled);
    } catch (error) {
      console.error('Error toggling auto-updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      setCheckingForUpdates(true);
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setCheckingForUpdates(false);
    }
  };

  const handleVersionSwitch = async () => {
    if (!selectedVersion) return;

    try {
      setLoading(true);
      await window.electronAPI.downloadAndInstallVersion(selectedVersion);
    } catch (error) {
      console.error('Error switching version:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getVersionSelectData = () => {
    return releases.map(release => ({
      value: release.version,
      label: `${release.version} - ${release.name}`,
      disabled: release.isCurrentVersion
    }));
  };

  const currentRelease = releases.find(release => release.isCurrentVersion);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Updates"
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Auto-updates toggle */}
        <Group justify="space-between" align="center">
          <div>
            <Text size="sm" fw={500}>Automatic Updates</Text>
            <Text size="xs" c="dimmed">
              Automatically check for and install updates
            </Text>
          </div>
          <Switch
            checked={autoUpdatesEnabled}
            onChange={(event) => handleAutoUpdatesToggle(event.currentTarget.checked)}
            disabled={loading}
          />
        </Group>

        {/* Current version info */}
        {currentRelease && (
          <Alert>
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" fw={500}>Current Version</Text>
                <Text size="sm">{currentRelease.version} - {currentRelease.name}</Text>
                <Text size="xs" c="dimmed">Released {formatDate(currentRelease.publishedAt)}</Text>
              </div>
              <Badge color="green" leftSection={<IconCheck size={12} />}>
                Current
              </Badge>
            </Group>
          </Alert>
        )}

        {/* Manual update check */}
        <Group justify="space-between" align="center">
          <div>
            <Text size="sm" fw={500}>Check for Updates</Text>
            <Text size="xs" c="dimmed">
              Manually check for available updates
            </Text>
          </div>
          <Button
            variant="light"
            leftSection={checkingForUpdates ? <Loader size="xs" /> : <IconRefresh size="sm" />}
            onClick={handleCheckForUpdates}
            disabled={checkingForUpdates}
            size="sm"
          >
            {checkingForUpdates ? 'Checking...' : 'Check Now'}
          </Button>
        </Group>

        {/* Version switching */}
        <div>
          <Text size="sm" fw={500} mb="xs">Switch Version</Text>
          <Text size="xs" c="dimmed" mb="sm">
            Select a different version to install. Note: This feature is currently limited.
          </Text>

          <Group align="flex-start">
            <Select
              data={getVersionSelectData()}
              value={selectedVersion}
              onChange={(value) => setSelectedVersion(value || '')}
              placeholder="Select version"
              style={{ flex: 1 }}
              disabled={loadingReleases}
              leftSection={loadingReleases ? <Loader size="xs" /> : undefined}
            />

            <Button
              variant="outline"
              leftSection={<IconDownload size="sm" />}
              onClick={handleVersionSwitch}
              disabled={!selectedVersion || loading || selectedVersion === currentRelease?.version}
              loading={loading}
              size="sm"
            >
              Switch
            </Button>
          </Group>

          {releases.length > 0 && (
            <Text size="xs" c="dimmed" mt="xs">
              Showing {releases.length} available {releases.length === 1 ? 'version' : 'versions'}
            </Text>
          )}
        </div>

        {/* Release notes link */}
        {releases.length > 0 && (
          <Alert>
            <Group justify="space-between" align="center">
              <Text size="sm">View all releases and release notes</Text>
              <ActionIcon
                variant="subtle"
                component="a"
                href="https://github.com/dfoerderreuther/aemstarter/releases"
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconExternalLink size="sm" />
              </ActionIcon>
            </Group>
          </Alert>
        )}

        {/* Action buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
