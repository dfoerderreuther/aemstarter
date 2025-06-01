import React, { useEffect, useState } from 'react';
import { Modal, Stack, Text, Button, TextInput, Group, Loader, List, Alert, Box } from '@mantine/core';
import { Project } from '../../types/Project';
import { BackupInfo } from '../../types/BackupInfo';
import { IconDeviceFloppy, IconRestore, IconAlertCircle } from '@tabler/icons-react';
import { formatFileSize, formatDate } from '../utils/formatUtils';

interface BackupModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
}

export const BackupModal: React.FC<BackupModalProps> = ({ opened, onClose, project }) => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listBackupsAll(project);
      setBackups(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      loadBackups();
    }
  }, [opened, project]);

  const handleRestore = async (name: string) => {
    setRestoring(name);
    setError(null);
    try {
      await window.electronAPI.runRestoreAll(project, name);
      onClose();
    } catch (err: any) {
      setError('Failed to restore backup');
    } finally {
      setRestoring(null);
    }
  };

  const handleCreate = async () => {
    if (!backupName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await window.electronAPI.runBackupAll(project, backupName.trim());
      setBackupName('');
      await loadBackups();
    } catch (err: any) {
      setError('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Backups" size="lg">
      <Stack>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        )}
        <Text size="sm">Existing Backups:</Text>
        {loading ? (
          <Loader size="sm" />
        ) : (
          <List spacing="sm" size="sm" icon={<IconDeviceFloppy size={16} />}>
            {backups.length === 0 && <Text c="dimmed">No backups found.</Text>}
            {backups.map((backup) => (
              <List.Item key={backup.name}>
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Text fw={500}>{backup.name}</Text>
                    <Text size="xs" c="dimmed">
                      Created: {formatDate(backup.createdDate)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Size: {formatFileSize(backup.fileSize)}
                    </Text>
                  </Box>
                  <Button
                    size="xs"
                    color="blue"
                    leftSection={<IconRestore size={14} />}
                    loading={restoring === backup.name}
                    disabled={restoring === backup.name}
                    onClick={() => handleRestore(backup.name)}
                  >
                    Restore
                  </Button>
                </Group>
              </List.Item>
            ))}
          </List>
        )}
        <Text size="sm" mt="md">Create New Backup:</Text>
        <Group>
          <TextInput
            placeholder="Backup name"
            value={backupName}
            onChange={(e) => setBackupName(e.currentTarget.value)}
            disabled={creating}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <Button
            color="green"
            loading={creating}
            onClick={handleCreate}
            disabled={!backupName.trim()}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}; 