import React, { useEffect, useState } from 'react';
import { 
  Modal, 
  Stack, 
  Text, 
  Button, 
  TextInput, 
  Group, 
  Loader, 
  Alert, 
  Box, 
  Table,
  Card,
  Title,
  Badge,
  ActionIcon,
  Flex,
  Divider,
  Center,
  Paper,
  ScrollArea,
  Checkbox
} from '@mantine/core';
import { Project } from '../../types/Project';
import { BackupInfo } from '../../types/BackupInfo';
import { IconDeviceFloppy, IconRestore, IconAlertCircle, IconPlus, IconCloudUpload, IconTrash } from '@tabler/icons-react';
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [backupName, setBackupName] = useState('');
  const [compress, setCompress] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listBackupsAll(project);
      setBackups(Array.isArray(result) ? result : []);
    } catch (err: unknown) {
      // Don't show error for common cases like "no backup directory exists yet"
      console.log('No backups found or backup directory not initialized:', err);
      setBackups([]); // Just show empty state instead of error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      setError(null); // Clear any previous errors when opening modal
      loadBackups();
    }
  }, [opened, project]);

  const handleRestore = async (name: string) => {
    setRestoring(name);
    setError(null);
    setConfirmRestore(null);
    try {
      await window.electronAPI.runRestoreAll(project, name);
      onClose();
    } catch (err: unknown) {
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
      await window.electronAPI.runBackupAll(project, backupName.trim(), compress);
      setBackupName('');
      await loadBackups();
    } catch (err: unknown) {
      setError('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    setError(null);
    setConfirmDelete(null);
    try {
      await window.electronAPI.deleteBackupAll(project, name);
      await loadBackups();
    } catch (err: unknown) {
      setError('Failed to delete backup');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <Modal 
        opened={opened} 
        onClose={onClose} 
        title={
          <Flex align="center" gap="sm">
            <IconDeviceFloppy size={24} />
            <Title order={3}>Project Backups</Title>
          </Flex>
        } 
        size="xl"
        padding="lg"
      >
        <Stack gap="lg">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} variant="filled">
              {error}
            </Alert>
          )}

          {/* Create New Backup Section */}
          <Card withBorder shadow="sm" padding="lg">
            <Stack gap="md">
              <Group gap="sm">
                <IconCloudUpload size={20} color="var(--mantine-color-green-6)" />
                <Title order={4} c="green">Create New Backup</Title>
              </Group>
              <Group>
                <TextInput
                  placeholder="Enter backup name"
                  value={backupName}
                  onChange={(e) => setBackupName(e.currentTarget.value)}
                  disabled={creating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  color="green"
                  loading={creating}
                  onClick={handleCreate}
                  disabled={!backupName.trim()}
                  leftSection={<IconPlus size={16} />}
                >
                  Create Backup
                </Button>
              </Group>
              <Checkbox
                label="Compress backup (slower)"
                checked={compress}
                onChange={(event) => setCompress(event.currentTarget.checked)}
                disabled={creating}
              />
            </Stack>
          </Card>

          <Divider />

          {/* Existing Backups Section */}
          <Stack gap="md">
            <Group gap="sm">
              <IconDeviceFloppy size={20} />
              <Title order={4}>Existing Backups</Title>
              <Badge variant="light" color="blue">
                {backups.length} {backups.length === 1 ? 'backup' : 'backups'}
              </Badge>
            </Group>

            {loading ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : backups.length === 0 ? (
              <Paper withBorder p="xl" bg="dark.6">
                <Center>
                  <Stack align="center" gap="sm">
                    <IconDeviceFloppy size={48} color="var(--mantine-color-gray-5)" />
                    <Text c="dimmed" size="lg">No backups found</Text>
                    <Text c="dimmed" size="sm">Create your first backup using the form above</Text>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              <Card withBorder>
                <ScrollArea h={400}>
                  <Table striped highlightOnHover withTableBorder={false} verticalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '35%' }}>Backup Name</Table.Th>
                        <Table.Th style={{ width: '25%' }}>Created Date</Table.Th>
                        <Table.Th style={{ width: '20%' }}>File Size</Table.Th>
                        <Table.Th style={{ width: '20%', textAlign: 'center' }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {backups.map((backup) => (
                        <Table.Tr key={backup.name}>
                          <Table.Td>
                            <Group gap="sm">
                              <ActionIcon variant="light" color="blue" size="sm">
                                <IconDeviceFloppy size={14} />
                              </ActionIcon>
                              <Box>
                                <Text fw={500} size="sm">{backup.name}</Text>
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {formatDate(backup.createdDate)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="sm">
                            <Text size="sm" c="dimmed">
                              {formatFileSize(backup.fileSize)}
                              </Text>
                              {backup.compressed && (
                                <Badge variant="light" color="gray" size="sm">
                                  GZ
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Center>
                              <Button
                                size="xs"
                                color="blue"
                                leftSection={<IconRestore size={14} />}
                                loading={restoring === backup.name}
                                disabled={restoring === backup.name}
                                onClick={() => setConfirmRestore(backup.name)}
                                variant="light"
                              >
                                Restore
                              </Button>
                              <Button
                                size="xs"
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                loading={deleting === backup.name}
                                disabled={deleting === backup.name}
                                onClick={() => setConfirmDelete(backup.name)}
                                variant="light"
                              >
                                Delete
                              </Button>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Card>
            )}
          </Stack>
        </Stack>
      </Modal>

      {/* Restore Confirmation Dialog */}
      <Modal
        opened={confirmRestore !== null}
        onClose={() => setConfirmRestore(null)}
        title="Confirm Restore"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to restore the backup "{confirmRestore}"? 
            This will overwrite your current project files.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button 
              variant="light" 
              onClick={() => setConfirmRestore(null)}
            >
              Cancel
            </Button>
            <Button 
              color="blue" 
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
            >
              Restore
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        opened={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete the backup "{confirmDelete}"? 
            This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button 
              variant="light" 
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button 
              color="red" 
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}; 