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
  Textarea,
  Tooltip,
  Code
} from '@mantine/core';
import { Project } from '../../types/Project';
import { IconPackage, IconAlertCircle, IconPlus, IconCloudUpload, IconTrash, IconDownload, IconInfoCircle, IconCopy } from '@tabler/icons-react';
import { formatFileSize } from '../utils/fileUtils';

interface PackageInfo {
  name: string;
  createdDate: Date;
  paths: string[];
  hasAuthor: boolean;
  hasPublisher: boolean;
  authorSize?: number;
  publisherSize?: number;
}

interface PackageManagerModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
}

export const PackageManagerModal: React.FC<PackageManagerModalProps> = ({ opened, onClose, project }) => {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packagePaths, setPackagePaths] = useState('');
  const [includeAuthor, setIncludeAuthor] = useState(true);
  const [includePublisher, setIncludePublisher] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
  };

  const isPackageInfoArray = (value: unknown): value is PackageInfo[] => {
    return Array.isArray(value) && value.every(item => 
      typeof item === 'object' && 
      item !== null && 
      typeof (item as any).name === 'string' && 
      ((item as any).createdDate || (item as any).size) && // Support both old and new format
      Array.isArray((item as any).paths) &&
      typeof (item as any).hasAuthor === 'boolean' &&
      typeof (item as any).hasPublisher === 'boolean' &&
      (typeof (item as any).authorSize === 'number' || typeof (item as any).authorSize === 'undefined') &&
      (typeof (item as any).publisherSize === 'number' || typeof (item as any).publisherSize === 'undefined')
    );
  };

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listPackages(project);
      
      if (isStringArray(result)) {
        // Convert old string[] format to PackageInfo[] (legacy support)
        const packageInfos: PackageInfo[] = result.map((name: string) => ({
          name: name,
          createdDate: new Date(),
          paths: [],
          hasAuthor: false,
          hasPublisher: false,
          authorSize: undefined,
          publisherSize: undefined
        }));
        // Sort by date (newest first)
        packageInfos.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
        setPackages(packageInfos);
      } else if (isPackageInfoArray(result)) {
        // New PackageInfo[] format - convert dates from string to Date objects
        const packageInfos: PackageInfo[] = (result as any[]).map((pkg: any) => ({
          ...pkg,
          createdDate: new Date(pkg.createdDate)
        }));
        // Sort by date (newest first)
        packageInfos.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
        setPackages(packageInfos);
      } else {
        setPackages([]);
      }
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

    // Check if package with this name already exists
    if (packages.some(pkg => pkg.name === packageName.trim())) {
      setError(`Package '${packageName.trim()}' already exists. Please choose a different name.`);
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
      await window.electronAPI.installPackage(project, instance, packageName);
    } catch (err: unknown) {
      setError(`Failed to install package on ${instance}`);
    }
  };

  const handleInstallAll = async (packageName: string) => {
    setError(null);
    try {
      // Install both author and publisher if they exist
      const packageInfo = packages.find(p => p.name === packageName);
      if (!packageInfo) {
        throw new Error('Package not found');
      }
      
      const promises: Promise<any>[] = [];
      if (packageInfo.hasAuthor) {
        promises.push(window.electronAPI.installPackage(project, 'author', packageName));
      }
      if (packageInfo.hasPublisher) {
        promises.push(window.electronAPI.installPackage(project, 'publisher', packageName));
      }
      
      if (promises.length === 0) {
        throw new Error('No packages to install');
      }
      
      await Promise.all(promises);
    } catch (err: unknown) {
      setError(`Failed to install all packages for ${packageName}`);
    }
  };

  const handleCopyPaths = (paths: string[]) => {
    setPackagePaths(paths.join('\n'));
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
                                  <Table striped highlightOnHover withTableBorder={false} verticalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '25%' }}>Package Info</Table.Th>
                        <Table.Th style={{ width: '40%' }}>Paths</Table.Th>
                        <Table.Th style={{ width: '35%' }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {packages.map((packageInfo) => (
                        <Table.Tr key={packageInfo.name}>
                          <Table.Td style={{ verticalAlign: 'top' }}>
                            <Group gap="sm">
                              <Box>
                                <Text fw={500} size="sm">{packageInfo.name}</Text>
                                                                  <Text size="sm" c="dimmed" mt="xs">
                                    {packageInfo.createdDate.toLocaleDateString()} {packageInfo.createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: 'top' }}>
                            {packageInfo.paths.length > 0 ? (
                              <Group gap="xs" align="flex-start">
                                <Stack gap="xs" style={{ flex: 1 }}>
                                  {packageInfo.paths.map((path, index) => (
                                    <Code key={index} c="dimmed">{path}</Code>
                                  ))}
                                </Stack>
                                <Tooltip label="Copy paths to form">
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => handleCopyPaths(packageInfo.paths)}
                                  >
                                    <IconCopy size={12} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            ) : (
                              <Text size="sm" c="dimmed">No paths specified</Text>
                            )}
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: 'top' }}>
                            <Stack gap="xs">
                              <Group gap="xs">
                                <Button
                                  size="xs"
                                  color="blue"
                                  leftSection={<IconDownload size={14} />}
                                  onClick={() => handleInstall(packageInfo.name, 'author')}
                                  variant="light"
                                  disabled={!packageInfo.hasAuthor}
                                >
                                  Author{packageInfo.authorSize ? ` (${formatFileSize(packageInfo.authorSize)})` : ''}
                                </Button>
                                <Button
                                  size="xs"
                                  color="green"
                                  leftSection={<IconDownload size={14} />}
                                  onClick={() => handleInstall(packageInfo.name, 'publisher')}
                                  variant="light"
                                  disabled={!packageInfo.hasPublisher}
                                >
                                  Publisher{packageInfo.publisherSize ? ` (${formatFileSize(packageInfo.publisherSize)})` : ''}
                                </Button>
                              </Group>
                              <Button
                                size="xs"
                                color="indigo"
                                leftSection={<IconDownload size={14} />}
                                onClick={() => handleInstallAll(packageInfo.name)}
                                variant="filled"
                                disabled={!packageInfo.hasAuthor && !packageInfo.hasPublisher}
                              >
                                Install All
                              </Button>
                              <Button
                                size="xs"
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                loading={deleting === packageInfo.name}
                                disabled={deleting === packageInfo.name}
                                onClick={() => setConfirmDelete(packageInfo.name)}
                                variant="light"
                              >
                                Delete
                              </Button>
                            </Stack>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
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

