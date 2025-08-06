import React, { useState } from 'react';
import { 
  Stack, 
  Text, 
  Button, 
  Group, 
  Alert, 
  Table,
  Card,
  Title,
  Badge,
  ButtonGroup,
  Tooltip,
  TextInput
} from '@mantine/core';
import { 
  IconWorld, 
  IconAlertCircle, 
  IconInfoCircle, 
  IconDownload, 
  IconUpload, 
  IconPackage,
  IconLink
} from '@tabler/icons-react';
import { Project } from "../../../types/Project";

interface WebPackagesProps {
    project: Project;
    isAuthorRunning: boolean;
    isPublisherRunning: boolean;
    onPackageDownloaded?: () => Promise<void>;
}

interface WebPackage {
    name: string;
    displayName: string;
    url: string;
    description: string;
}

export const WebPackages: React.FC<WebPackagesProps> = ({ project, isAuthorRunning, isPublisherRunning, onPackageDownloaded }) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [customUrl, setCustomUrl] = useState<string>('');

    const webPackages: WebPackage[] = [
        {
            name: "aem-cif-guides-venia.all-2025.04.11.zip",
            displayName: "Venia CIF Demo",
            url: "https://github.com/adobe/aem-cif-guides-venia/releases/download/venia-2025.04.11/aem-cif-guides-venia.all-2025.04.11.zip",
            description: "Adobe Experience Manager CIF Venia demo site"
        },
        {
            name: "aem-guides-wknd.all-3.2.0.zip",
            displayName: "WKND Tutorial Site",
            url: "https://github.com/adobe/aem-guides-wknd/releases/download/aem-guides-wknd-3.2.0/aem-guides-wknd.all-3.2.0.zip",
            description: "AEM WKND tutorial reference implementation"
        },
        {
            name: "acs-aem-commons-all-6.12.0-cloud.zip",
            displayName: "ACS AEM Commons",
            url: "https://github.com/Adobe-Consulting-Services/acs-aem-commons/releases/download/acs-aem-commons-6.12.0/acs-aem-commons-all-6.12.0-cloud.zip",
            description: "ACS AEM Commons - utilities and features for AEM"
        },
        {
            name: "aem-guides-wknd.all-3.2.0-classic.zip",
            displayName: "WKND Tutorial Site (Classic)",
            url: "https://github.com/adobe/aem-guides-wknd/releases/download/aem-guides-wknd-3.2.0/aem-guides-wknd.all-3.2.0-classic.zip",
            description: "AEM WKND tutorial reference implementation for AEM 6.5 (Classic)"
        }
    ];



    const handleDownloadOnly = async (webPackage: WebPackage) => {
        setLoading(`download-${webPackage.name}`);
        setError(null);
        try {
            await window.electronAPI.downloadWebPackage(project, webPackage.url);
            if (onPackageDownloaded) {
                await onPackageDownloaded();
            }
        } catch (err: unknown) {
            setError(`Failed to download ${webPackage.displayName}`);
            console.error('Download error:', err);
        } finally {
            setLoading(null);
        }
    };

    const handleInstallToInstance = async (webPackage: WebPackage, instance: 'author' | 'publisher') => {
        if ((instance === 'author' && !isAuthorRunning) || (instance === 'publisher' && !isPublisherRunning)) {
            setError(`${instance.charAt(0).toUpperCase() + instance.slice(1)} instance is not running. Please start it first.`);
            return;
        }

        setLoading(`install-${webPackage.name}-${instance}`);
        setError(null);
        try {
            // First download to packages directory
            const packageName = await window.electronAPI.downloadWebPackage(project, webPackage.url);
            // Then install to the specified instance
            await window.electronAPI.installPackage(project, instance, packageName);
            if (onPackageDownloaded) {
                await onPackageDownloaded();
            }
        } catch (err: unknown) {
            setError(`Failed to install ${webPackage.displayName} to ${instance}`);
            console.error('Install error:', err);
        } finally {
            setLoading(null);
        }
    };

    const handleInstallToBoth = async (webPackage: WebPackage) => {
        if (!isAuthorRunning && !isPublisherRunning) {
            setError('No AEM instances are running. Please start at least one instance first.');
            return;
        }

        setLoading(`install-${webPackage.name}-both`);
        setError(null);
        try {
            // First download to packages directory
            const packageName = await window.electronAPI.downloadWebPackage(project, webPackage.url);
            
            // Then install to running instances
            const promises: Promise<any>[] = [];
            if (isAuthorRunning) {
                promises.push(window.electronAPI.installPackage(project, 'author', packageName));
            }
            if (isPublisherRunning) {
                promises.push(window.electronAPI.installPackage(project, 'publisher', packageName));
            }
            
            await Promise.all(promises);
            if (onPackageDownloaded) {
                await onPackageDownloaded();
            }
        } catch (err: unknown) {
            setError(`Failed to install ${webPackage.displayName} to instances`);
            console.error('Install error:', err);
        } finally {
            setLoading(null);
        }
    };

    const handleCustomUrlDownloadOnly = async () => {
        if (!customUrl.trim()) {
            setError('Please enter a valid URL');
            return;
        }

        setLoading('download-custom-url');
        setError(null);
        try {
            await window.electronAPI.downloadWebPackage(project, customUrl.trim());
            if (onPackageDownloaded) {
                await onPackageDownloaded();
            }
            setCustomUrl(''); // Clear the input after successful download
        } catch (err: unknown) {
            setError('Failed to download package from custom URL');
            console.error('Download error:', err);
        } finally {
            setLoading(null);
        }
    };

    const handleCustomUrlInstallToInstance = async (instance: 'author' | 'publisher') => {
        if (!customUrl.trim()) {
            setError('Please enter a valid URL');
            return;
        }

        if ((instance === 'author' && !isAuthorRunning) || (instance === 'publisher' && !isPublisherRunning)) {
            setError(`${instance.charAt(0).toUpperCase() + instance.slice(1)} instance is not running. Please start it first.`);
            return;
        }

        setLoading(`install-custom-url-${instance}`);
        setError(null);
        try {
            // First download to packages directory
            const packageName = await window.electronAPI.downloadWebPackage(project, customUrl.trim());
            // Then install to the specified instance
            await window.electronAPI.installPackage(project, instance, packageName);
            if (onPackageDownloaded) {
                await onPackageDownloaded();
            }
            setCustomUrl(''); // Clear the input after successful install
        } catch (err: unknown) {
            setError(`Failed to install package from custom URL to ${instance}`);
            console.error('Install error:', err);
        } finally {
            setLoading(null);
        }
    };

    const handleCustomUrlInstallToBoth = async () => {
        if (!customUrl.trim()) {
            setError('Please enter a valid URL');
            return;
        }

        if (!isAuthorRunning && !isPublisherRunning) {
            setError('No AEM instances are running. Please start at least one instance first.');
            return;
        }

        setLoading('install-custom-url-both');
        setError(null);
        try {
            // First download to packages directory
            const packageName = await window.electronAPI.downloadWebPackage(project, customUrl.trim());
            
            // Then install to running instances
            const promises: Promise<any>[] = [];
            if (isAuthorRunning) {
                promises.push(window.electronAPI.installPackage(project, 'author', packageName));
            }
            if (isPublisherRunning) {
                promises.push(window.electronAPI.installPackage(project, 'publisher', packageName));
            }
            
            await Promise.all(promises);
            if (onPackageDownloaded) {
                await onPackageDownloaded();
            }
            setCustomUrl(''); // Clear the input after successful install
        } catch (err: unknown) {
            setError('Failed to install package from custom URL to instances');
            console.error('Install error:', err);
        } finally {
            setLoading(null);
        }
    };

    return (
        <Stack gap="lg">
            {error && (
                <Alert color="red" icon={<IconAlertCircle size={16} />} variant="filled">
                    {error}
                </Alert>
            )}

            {!isAuthorRunning && !isPublisherRunning && (
                <Alert color="yellow" icon={<IconInfoCircle size={16} />} variant="light">
                    No AEM instances are currently running. You can download packages, but install operations require running instances.
                </Alert>
            )}

            <Group gap="sm">
                <IconWorld size={20} />
                <Title order={4}>Web Packages</Title>
                <Badge variant="light" color="blue">
                    {webPackages.length} {webPackages.length === 1 ? 'package' : 'packages'}
                </Badge>
            </Group>

            {/* Custom URL Input Section */}
            <Card withBorder>
                <Stack gap="md">
                    <Group gap="sm">
                        <IconLink size={16} />
                        <Text fw={500} size="sm">Custom Package URL</Text>
                    </Group>
                    <TextInput
                        placeholder="Enter package URL (e.g., https://example.com/package.zip)"
                        value={customUrl}
                        onChange={(event) => setCustomUrl(event.currentTarget.value)}
                    />
                    <ButtonGroup>
                        <Tooltip label="Download package to local packages directory">
                            <Button
                                size="xs"
                                variant="light"
                                color="blue"
                                leftSection={<IconDownload size={14} />}
                                onClick={handleCustomUrlDownloadOnly}
                                loading={loading === 'download-custom-url'}
                                disabled={!customUrl.trim()}
                            >
                                Download
                            </Button>
                        </Tooltip>
                        <Tooltip label="Download and install to Author instance">
                            <Button
                                size="xs"
                                color="green"
                                leftSection={<IconUpload size={14} />}
                                onClick={() => handleCustomUrlInstallToInstance('author')}
                                loading={loading === 'install-custom-url-author'}
                                disabled={!customUrl.trim() || !isAuthorRunning}
                            >
                                Author
                            </Button>
                        </Tooltip>
                        <Tooltip label="Download and install to Publisher instance">
                            <Button
                                size="xs"
                                color="orange"
                                leftSection={<IconUpload size={14} />}
                                onClick={() => handleCustomUrlInstallToInstance('publisher')}
                                loading={loading === 'install-custom-url-publisher'}
                                disabled={!customUrl.trim() || !isPublisherRunning}
                            >
                                Publisher
                            </Button>
                        </Tooltip>
                        <Tooltip label="Download and install to both running instances">
                            <Button
                                size="xs"
                                color="violet"
                                leftSection={<IconPackage size={14} />}
                                onClick={handleCustomUrlInstallToBoth}
                                loading={loading === 'install-custom-url-both'}
                                disabled={!customUrl.trim() || (!isAuthorRunning && !isPublisherRunning)}
                            >
                                Both
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                </Stack>
            </Card>

            <Card withBorder>
                <Table striped highlightOnHover withTableBorder={false} verticalSpacing="md">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ width: '40%' }}>Package Info</Table.Th>
                            <Table.Th style={{ width: '60%' }}>Actions</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {webPackages.map((webPackage) => (
                            <Table.Tr key={webPackage.name}>
                                <Table.Td style={{ verticalAlign: 'top' }}>
                                    <Stack gap="xs">
                                        <Text fw={500}>{webPackage.displayName}</Text>
                                        <Text size="sm" c="dimmed">
                                            {webPackage.description}
                                        </Text>
                                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                                            {webPackage.name}
                                        </Text>
                                    </Stack>
                                </Table.Td>
                                <Table.Td style={{ verticalAlign: 'top' }}>
                                    <ButtonGroup>
                                        <Tooltip label="Download package to local packages directory">
                                            <Button
                                                size="xs"
                                                variant="light"
                                                color="blue"
                                                leftSection={<IconDownload size={14} />}
                                                onClick={() => handleDownloadOnly(webPackage)}
                                                loading={loading === `download-${webPackage.name}`}
                                            >
                                                Download
                                            </Button>
                                        </Tooltip>
                                        <Tooltip label="Download and install to Author instance">
                                            <Button
                                                size="xs"
                                                color="green"
                                                leftSection={<IconUpload size={14} />}
                                                onClick={() => handleInstallToInstance(webPackage, 'author')}
                                                loading={loading === `install-${webPackage.name}-author`}
                                                disabled={!isAuthorRunning}
                                            >
                                                Author
                                            </Button>
                                        </Tooltip>
                                        <Tooltip label="Download and install to Publisher instance">
                                            <Button
                                                size="xs"
                                                color="orange"
                                                leftSection={<IconUpload size={14} />}
                                                onClick={() => handleInstallToInstance(webPackage, 'publisher')}
                                                loading={loading === `install-${webPackage.name}-publisher`}
                                                disabled={!isPublisherRunning}
                                            >
                                                Publisher
                                            </Button>
                                        </Tooltip>
                                        <Tooltip label="Download and install to both running instances">
                                            <Button
                                                size="xs"
                                                color="violet"
                                                leftSection={<IconPackage size={14} />}
                                                onClick={() => handleInstallToBoth(webPackage)}
                                                loading={loading === `install-${webPackage.name}-both`}
                                                disabled={!isAuthorRunning && !isPublisherRunning}
                                            >
                                                Both
                                            </Button>
                                        </Tooltip>
                                    </ButtonGroup>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Card>
        </Stack>
    );
};