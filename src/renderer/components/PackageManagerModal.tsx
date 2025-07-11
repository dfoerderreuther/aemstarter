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
  Checkbox,
  Textarea
} from '@mantine/core';
import { Project } from '../../types/Project';
import { IconPackage, IconAlertCircle, IconPlus, IconCloudUpload, IconTrash, IconDownload } from '@tabler/icons-react';

interface PackageManagerModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
}

export const PackageManagerModal: React.FC<PackageManagerModalProps> = ({ opened, onClose, project }) => {
  const [packages, setPackages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packagePaths, setPackagePaths] = useState('');
  const [includeAuthor, setIncludeAuthor] = useState(true);
  const [includePublisher, setIncludePublisher] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listPackages(project);
      setPackages(Array.isArray(result) ? result : []);
    } catch (err: unknown) {
      console.log('No packages found or packages directory not initialized:', err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      setError(null);
      loadPackages();
    }
  }, [opened, project]);

  const handleCreate = async () => {
    if (!packageName.trim()) {
      setError('Package name is required');
      return;
    }

    if (!packagePaths.trim()) {
      setError('At least one path is required');
      return;
    }

    if (!includeAuthor && !includePublisher) {
      setError('At least one instance must be selected');
      return;
    }

    setCreating(true);
    setError(null);
    
    try {
      const instances: string[] = [];
      if (includeAuthor) instances.push('author');
      if (includePublisher) instances.push('publisher');
      
      const paths = packagePaths
        .split('\n')
        .map(path => path.trim())
        .filter(path => path.length > 0);

      await window.electronAPI.createPackage(project, packageName.trim(), instances, paths);
      
      // Reset form
      setPackageName('');
      setPackagePaths('');
      setIncludeAuthor(true);
      setIncludePublisher(false);
      
      await loadPackages();
    } catch (err: unknown) {
      setError('Failed to create package');
      console.error('Package creation error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (packageName: string) => {
    setDeleting(packageName);
    setError(null);
    setConfirmDelete(null);
    try {
      await window.electronAPI.deletePackage(project, packageName);
      await loadPackages();
    } catch (err: unknown) {
      setError('Failed to delete package');
    } finally {
      setDeleting(null);
    }
  };

  const handleInstall = async (packageName: string, instance: 'author' | 'publisher') => {
    setError(null);
    try {
      const packagePath = `${project.folderPath}/packages/${packageName}`;
      await window.electronAPI.installPackage(project, instance, packagePath);
    } catch (err: unknown) {
      setError(`Failed to install package on ${instance}`);
    }
  };

  return (
    <>
      <Modal 
        opened={opened} 
        onClose={onClose} 
        title={
          <Flex align="center" gap="sm">
            <IconPackage size={24} />
            <Title order={3}>Package Manager</Title>
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

          {/* Create New Package Section */}
          <Card withBorder shadow="sm" padding="lg">
            <Stack gap="md">
              <Group gap="sm">
                <IconCloudUpload size={20} color="var(--mantine-color-green-6)" />
                <Title order={4} c="green">Create New Package</Title>
              </Group>
              
              <TextInput
                label="Package Name"
                placeholder="Enter package name"
                value={packageName}
                onChange={(e) => setPackageName(e.currentTarget.value)}
                disabled={creating}
                required
              />
              
              <Textarea
                label="Paths to Include"
                placeholder="Enter paths, one per line (e.g., /content/mysite, /etc/workflow)"
                value={packagePaths}
                onChange={(e) => setPackagePaths(e.currentTarget.value)}
                disabled={creating}
                required
                rows={4}
                description="Enter one path per line. These paths will be included in the package."
              />
              
              <Group>
                <Text size="sm" fw={500}>Target Instances:</Text>
                <Checkbox
                  label="Author"
                  checked={includeAuthor}
                  onChange={(event) => setIncludeAuthor(event.currentTarget.checked)}
                  disabled={creating}
                />
                <Checkbox
                  label="Publisher"
                  checked={includePublisher}
                  onChange={(event) => setIncludePublisher(event.currentTarget.checked)}
                  disabled={creating}
                />
              </Group>
              
              <Group justify="flex-end">
                <Button
                  color="green"
                  loading={creating}
                  onClick={handleCreate}
                  disabled={!packageName.trim() || !packagePaths.trim()}
                  leftSection={<IconPlus size={16} />}
                >
                  Create Package
                </Button>
              </Group>
            </Stack>
          </Card>

          <Divider />

          {/* Existing Packages Section */}
          <Stack gap="md">
            <Group gap="sm">
              <IconPackage size={20} />
              <Title order={4}>Existing Packages</Title>
              <Badge variant="light" color="blue">
                {packages.length} {packages.length === 1 ? 'package' : 'packages'}
              </Badge>
            </Group>

            {loading ? (
              <Center p="xl">
                <Loader size="lg" />
              </Center>
            ) : packages.length === 0 ? (
              <Paper withBorder p="xl" bg="dark.6">
                <Center>
                  <Stack align="center" gap="sm">
                    <IconPackage size={48} color="var(--mantine-color-gray-5)" />
                    <Text c="dimmed" size="lg">No packages found</Text>
                    <Text c="dimmed" size="sm">Create your first package using the form above</Text>
                  </Stack>
                </Center>
              </Paper>
            ) : (
              <Card withBorder>
                <ScrollArea h={400}>
                  <Table striped highlightOnHover withTableBorder={false} verticalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '40%' }}>Package Name</Table.Th>
                        <Table.Th style={{ width: '30%' }}>Install</Table.Th>
                        <Table.Th style={{ width: '30%', textAlign: 'center' }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {packages.map((packageName) => (
                        <Table.Tr key={packageName}>
                          <Table.Td>
                            <Group gap="sm">
                              <ActionIcon variant="light" color="blue" size="sm">
                                <IconPackage size={14} />
                              </ActionIcon>
                              <Box>
                                <Text fw={500} size="sm">{packageName}</Text>
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="sm">
                              <Button
                                size="xs"
                                color="blue"
                                leftSection={<IconDownload size={14} />}
                                onClick={() => handleInstall(packageName, 'author')}
                                variant="light"
                              >
                                Author
                              </Button>
                              <Button
                                size="xs"
                                color="green"
                                leftSection={<IconDownload size={14} />}
                                onClick={() => handleInstall(packageName, 'publisher')}
                                variant="light"
                              >
                                Publisher
                              </Button>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Center>
                              <Button
                                size="xs"
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                loading={deleting === packageName}
                                disabled={deleting === packageName}
                                onClick={() => setConfirmDelete(packageName)}
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
            Are you sure you want to delete the package "{confirmDelete}"? 
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

