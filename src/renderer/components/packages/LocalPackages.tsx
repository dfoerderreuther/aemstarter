import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { 
  Stack, 
  Text, 
  Button, 
  TextInput, 
  Group, 
  Loader, 
  Alert, 
  Table,
  Card,
  Title,
  Badge,
  ActionIcon,
  Divider,
  Center,
  Paper,
  Checkbox,
  Textarea,
  Tooltip,
  Code,
  ButtonGroup,
  Modal,
  Radio,
  Tabs,
  FileInput
} from '@mantine/core';
import { Project } from '../../../types/Project';
import { IconAlertCircle, IconPlus, IconCloudUpload, IconTrash, IconInfoCircle, IconCopy, IconUpload, IconPackage, IconFileImport, IconDownload } from '@tabler/icons-react';
import { formatFileSize } from '../../utils/fileUtils';

interface PackageInfo {
  name: string;
  createdDate: Date;
  paths: string[];
  size: number;
}

interface LocalPackagesProps {
  project: Project;
  isAuthorRunning: boolean;
  isPublisherRunning: boolean;
}

export const LocalPackages = forwardRef<{ refreshPackages: () => Promise<void> }, LocalPackagesProps>(({ project, isAuthorRunning, isPublisherRunning }, ref) => {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [_deleting, setDeleting] = useState<string | null>(null);


  const [packageName, setPackageName] = useState('');
  const [packagePaths, setPackagePaths] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<'author' | 'publisher'>('author');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [installTargets, setInstallTargets] = useState<Record<string, { author: boolean; publisher: boolean }>>({});

  // Import tab state
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('create');



  const isPackageInfoArray = (value: unknown): value is PackageInfo[] => {
    return Array.isArray(value) && value.every(item => 
      typeof item === 'object' && 
      item !== null && 
      typeof (item as any).name === 'string' && 
      (item as any).createdDate &&
      Array.isArray((item as any).paths) &&
      typeof (item as any).size === 'number'
    );
  };

  const loadPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listPackages(project);
      
      if (isPackageInfoArray(result)) {
        // Convert dates from string to Date objects
        const packageInfos: PackageInfo[] = (result as any[]).map((pkg: any) => ({
          ...pkg,
          createdDate: new Date(pkg.createdDate)
        }));
        // Sort by date (newest first)
        packageInfos.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
        setPackages(packageInfos);
        
        // Initialize install targets (both instances available by default)
        const initialTargets: Record<string, { author: boolean; publisher: boolean }> = {};
        packageInfos.forEach(pkg => {
          initialTargets[pkg.name] = {
            author: true,
            publisher: true
          };
        });
        setInstallTargets(initialTargets);
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
    setError(null);
    loadPackages();
  }, [project]);

  useImperativeHandle(ref, () => ({
    refreshPackages: loadPackages
  }));

  const handleCreate = async () => {
    if (!packageName.trim()) {
      setError('Package name is required');
      return;
    }

    // Validate package name is URL-safe (no spaces, special characters except hyphens and underscores)
    const urlSafePattern = /^[a-zA-Z0-9_-]+$/;
    if (!urlSafePattern.test(packageName.trim())) {
      setError('Package name must only contain letters, numbers, hyphens (-), and underscores (_). No spaces or special characters allowed.');
      return;
    }

    if (!packagePaths.trim()) {
      setError('At least one path is required');
      return;
    }

    // Check if selected instance is running
    if (selectedInstance === 'author' && !isAuthorRunning) {
      setError('Author instance is not running. Please start the author instance first.');
      return;
    }
    if (selectedInstance === 'publisher' && !isPublisherRunning) {
      setError('Publisher instance is not running. Please start the publisher instance first.');
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
      const paths = packagePaths
        .split('\n')
        .map(path => path.trim())
        .filter(path => path.length > 0);

      await window.electronAPI.createPackage(project, packageName.trim(), selectedInstance, paths);
      
      // Reset form
      setPackageName('');
      setPackagePaths('');
      setSelectedInstance('author');
      
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

  const handleInstallSelected = async (packageName: string) => {
    setError(null);
    try {
      const targets = installTargets[packageName];
      if (!targets || (!targets.author && !targets.publisher)) {
        setError('Please select at least one instance to install');
        return;
      }

      // Check if selected instances are running
      if (targets.author && !isAuthorRunning) {
        setError('Author instance is not running. Please start the author instance first.');
        return;
      }
      if (targets.publisher && !isPublisherRunning) {
        setError('Publisher instance is not running. Please start the publisher instance first.');
        return;
      }

      const promises: Promise<any>[] = [];
      if (targets.author) {
        promises.push(window.electronAPI.installPackage(project, 'author', packageName));
      }
      if (targets.publisher) {
        promises.push(window.electronAPI.installPackage(project, 'publisher', packageName));
      }
      
      await Promise.all(promises);
      
      // Reset to default state after successful install
      setInstallTargets(prev => ({
        ...prev,
        [packageName]: { author: true, publisher: true }
      }));
    } catch (err: unknown) {
      setError(`Failed to install selected packages for ${packageName}`);
    }
  };



  const handleInstallTargetSelection = (packageName: string, instance: 'author' | 'publisher', checked: boolean) => {
    setInstallTargets(prev => ({
      ...prev,
      [packageName]: {
        ...prev[packageName],
        [instance]: checked
      }
    }));
  };

  const getInstanceLabel = (instance: 'author' | 'publisher') => {
    const instanceName = instance.charAt(0).toUpperCase() + instance.slice(1);
    const isRunning = instance === 'author' ? isAuthorRunning : isPublisherRunning;
    const statusText = isRunning ? ' (Running)' : ' (Stopped)';
    const statusColor = isRunning ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)';
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{instanceName}</span>
        <span style={{ fontSize: '0.8em', color: statusColor, fontWeight: 500 }}>
          {statusText}
        </span>
      </div>
    );
  };

  const handleCopyPaths = (paths: string[]) => {
    setPackagePaths(paths.join('\n'));
  };

  const handleSelectPackageFile = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Package File',
      buttonLabel: 'Select Package',
      message: 'Select the AEM package file to import',
      filters: [{ name: 'Package Files', extensions: ['zip'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      setSelectedFilePath(result.filePaths[0]);
    }
  };

  const handleImportOnly = async () => {
    if (!selectedFilePath) {
      setError('Please select a package file');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      // Use importPackage API to copy the file to packages directory without installing
      await window.electronAPI.importPackage(project, selectedFilePath);
      setSelectedFilePath('');
      await loadPackages();
    } catch (err: unknown) {
      setError('Failed to import package file');
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleImportAndInstallToInstance = async (instance: 'author' | 'publisher') => {
    if (!selectedFilePath) {
      setError('Please select a package file');
      return;
    }

    if ((instance === 'author' && !isAuthorRunning) || (instance === 'publisher' && !isPublisherRunning)) {
      setError(`${instance.charAt(0).toUpperCase() + instance.slice(1)} instance is not running. Please start it first.`);
      return;
    }

    setImporting(true);
    setError(null);
    try {
      // First import to get the package name, then install
      const packageName = await window.electronAPI.importPackage(project, selectedFilePath);
      await window.electronAPI.installPackage(project, instance, packageName);
      setSelectedFilePath('');
      await loadPackages();
    } catch (err: unknown) {
      setError(`Failed to import and install package to ${instance}`);
      console.error('Import and install error:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleImportAndInstallToBoth = async () => {
    if (!selectedFilePath) {
      setError('Please select a package file');
      return;
    }

    if (!isAuthorRunning && !isPublisherRunning) {
      setError('No AEM instances are running. Please start at least one instance first.');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      // First import to get the package name
      const packageName = await window.electronAPI.importPackage(project, selectedFilePath);
      
      // Then install to running instances
      const promises: Promise<any>[] = [];
      if (isAuthorRunning) {
        promises.push(window.electronAPI.installPackage(project, 'author', packageName));
      }
      if (isPublisherRunning) {
        promises.push(window.electronAPI.installPackage(project, 'publisher', packageName));
      }
      
      await Promise.all(promises);
      setSelectedFilePath('');
      await loadPackages();
    } catch (err: unknown) {
      setError('Failed to import and install package to instances');
      console.error('Import and install error:', err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Stack gap="lg">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} variant="filled">
            {error}
          </Alert>
        )}

        {!isAuthorRunning && !isPublisherRunning && (
          <Alert color="yellow" icon={<IconInfoCircle size={16} />} variant="light">
            No AEM instances are currently running. You can display packages, but install operations require running instances.
          </Alert>
        )}

        {/* Package Operations Section */}
        <Card withBorder shadow="sm" padding="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="create" leftSection={<IconCloudUpload size={16} />}>
                Create New Package
              </Tabs.Tab>
              <Tabs.Tab value="import" leftSection={<IconFileImport size={16} />}>
                Import Package
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="create" pt="md">
              <Stack gap="md">
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
                
                <Group justify="space-between" align="flex-end">
                  <Radio.Group
                    label="Source Instance"
                    description="Select which instance to create the package from"
                    value={selectedInstance}
                    onChange={(value) => setSelectedInstance(value as 'author' | 'publisher')}
                  >
                    <Group mt="xs">
                      <Radio value="author" label={getInstanceLabel('author')} disabled={creating || !isAuthorRunning} />
                      <Radio value="publisher" label={getInstanceLabel('publisher')} disabled={creating || !isPublisherRunning} />
                    </Group>
                  </Radio.Group>
                  
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
            </Tabs.Panel>

            <Tabs.Panel value="import" pt="md">
              <Stack gap="md">
                <Group gap="sm" align="flex-end">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500} mb="xs">Package File</Text>
                    <Text size="xs" c="dimmed" mb="sm">Select an AEM package (.zip) file to import</Text>
                    {selectedFilePath ? (
                      <Group gap="xs">
                        <Text size="sm" style={{ fontFamily: 'monospace', flex: 1 }}>
                          {selectedFilePath.split('/').pop() || selectedFilePath.split('\\').pop()}
                        </Text>
                        <Button 
                          size="xs" 
                          variant="light" 
                          onClick={() => setSelectedFilePath('')}
                        >
                          Clear
                        </Button>
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">No file selected</Text>
                    )}
                  </div>
                  <Button
                    variant="light"
                    onClick={handleSelectPackageFile}
                    leftSection={<IconPackage size={16} />}
                    disabled={importing}
                  >
                    Select File
                  </Button>
                </Group>

                <ButtonGroup>
                  <Tooltip label="Import package to local packages directory">
                    <Button
                      size="sm"
                      variant="light"
                      color="blue"
                      leftSection={<IconDownload size={14} />}
                      onClick={handleImportOnly}
                      loading={importing}
                      disabled={!selectedFilePath.trim()}
                    >
                      Import
                    </Button>
                  </Tooltip>
                  <Tooltip label="Import and install to Author instance">
                    <Button
                      size="sm"
                      color="green"
                      leftSection={<IconUpload size={14} />}
                      onClick={() => handleImportAndInstallToInstance('author')}
                      loading={importing}
                      disabled={!selectedFilePath.trim() || !isAuthorRunning}
                    >
                      Author
                    </Button>
                  </Tooltip>
                  <Tooltip label="Import and install to Publisher instance">
                    <Button
                      size="sm"
                      color="orange"
                      leftSection={<IconUpload size={14} />}
                      onClick={() => handleImportAndInstallToInstance('publisher')}
                      loading={importing}
                      disabled={!selectedFilePath.trim() || !isPublisherRunning}
                    >
                      Publisher
                    </Button>
                  </Tooltip>
                  <Tooltip label="Import and install to both running instances">
                    <Button
                      size="sm"
                      color="violet"
                      leftSection={<IconPackage size={14} />}
                      onClick={handleImportAndInstallToBoth}
                      loading={importing}
                      disabled={!selectedFilePath.trim() || (!isAuthorRunning && !isPublisherRunning)}
                    >
                      Both
                    </Button>
                  </Tooltip>
                </ButtonGroup>
              </Stack>
            </Tabs.Panel>
          </Tabs>
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
                    <Table.Th style={{ width: '30%' }}>Package Info</Table.Th>
                    <Table.Th style={{ width: '35%' }}>Paths</Table.Th>
                    <Table.Th style={{ width: '35%' }}>Install Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {packages.map((packageInfo) => (
                    <Table.Tr key={packageInfo.name}>
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        <Stack gap="xs">
                          <Text fw={500}>{packageInfo.name}.zip</Text>
                          <Text size="sm" c="dimmed">
                            {packageInfo.createdDate.toLocaleDateString()} {packageInfo.createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {formatFileSize(packageInfo.size)}
                          </Text>
                          <Tooltip label="Delete package">
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => setConfirmDelete(packageInfo.name)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Stack>
                      </Table.Td>
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        {packageInfo.paths.length > 0 ? (
                          <Group gap="xs" align="flex-start">
                            <div style={{ 
                              flex: 1, 
                              maxWidth: '300px', 
                              maxHeight: '120px', 
                              overflow: 'auto' 
                            }}>
                              <Code c="dimmed" style={{ whiteSpace: 'pre-wrap', display: 'block' }}>
                                {packageInfo.paths.map((path) => (
                                  <React.Fragment key={path}>{path}<br /></React.Fragment>
                                ))}
                              </Code>
                            </div>
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
                        <Stack gap="md">
                          <Stack gap="xs">
                            <Text size="sm" fw={500}>Install to:</Text>
                            <Checkbox
                              label={getInstanceLabel('author')}
                              checked={installTargets[packageInfo.name]?.author || false}
                              onChange={(event) => handleInstallTargetSelection(packageInfo.name, 'author', event.currentTarget.checked)}
                              color="gray"
                              size="sm"
                            />
                            <Checkbox
                              label={getInstanceLabel('publisher')}
                              checked={installTargets[packageInfo.name]?.publisher || false}
                              onChange={(event) => handleInstallTargetSelection(packageInfo.name, 'publisher', event.currentTarget.checked)}
                              color="gray"
                              size="sm"
                            />
                          </Stack>
                          <ButtonGroup>
                            <Tooltip label="Upload and install package to the selected AEM instances">
                              <Button
                                size="xs"
                                color="blue"
                                leftSection={<IconUpload size={14} />}
                                onClick={() => handleInstallSelected(packageInfo.name)}
                                variant="filled"
                                disabled={!installTargets[packageInfo.name]?.author && !installTargets[packageInfo.name]?.publisher}
                              >
                                Install
                              </Button>
                            </Tooltip>
                          </ButtonGroup>
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
});