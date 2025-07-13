import { AutomationTaskTeaser } from "../AutomationTaskTeaser";
import { Project } from '../../../../types/Project';
import { Text, TextInput, Group, Button, Badge, Stack, Checkbox, Select } from '@mantine/core';
import { useEffect, useState } from "react";
import { PackageInfo } from "../../../../types/PackageInfo";
import { IconRocket } from "@tabler/icons-react";


interface UpdateSdkAndInstallAndRunTeaserProps {
    project: Project;
    onTaskStart: (taskType: string, taskTitle: string) => void;
  }

export const UpdateSdkAndInstallAndRunTeaser: React.FC<UpdateSdkAndInstallAndRunTeaserProps> = ({  
    project,
    onTaskStart
}) => {
    const [sdkPath, setSdkPath] = useState('');
    const [wknd, setWknd] = useState(false);
    const [localPackage, setLocalPackage] = useState('');
    const [replication, setReplication] = useState(true);
    const [availablePackages, setAvailablePackages] = useState<string[]>([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    
    const handleSelectSdkPath = async () => {
        const result = await window.electronAPI.showOpenDialog({
            properties: ['openFile'],
            title: 'Select SDK Zip File',
            buttonLabel: 'Select File',
            filters: [
                { name: 'Zip Files', extensions: ['zip'] }
            ]
        });
        if (!result.canceled && result.filePaths.length > 0) {
            setSdkPath(result.filePaths[0]);
        }
    };
    const isStringArray = (value: unknown): value is string[] => {
        return Array.isArray(value) && value.every(item => typeof item === 'string');
      };
  
      const isPackageInfoArray = (value: unknown): value is PackageInfo[] => {
        return Array.isArray(value) && value.every(item => 
          typeof item === 'object' && 
          item !== null && 
          typeof (item as any).name === 'string' && 
          ((item as any).createdDate || (item as any).size) && 
          Array.isArray((item as any).paths) &&
          typeof (item as any).hasAuthor === 'boolean' &&
          typeof (item as any).hasPublisher === 'boolean'
        );
      };
  
      const loadPackages = async () => {
        setLoadingPackages(true);
        try {
          const result = await window.electronAPI.listPackages(project);
          
          if (isStringArray(result)) {
            setAvailablePackages(result);
          } else if (isPackageInfoArray(result)) {
            const packageNames = result.map((pkg: PackageInfo) => pkg.name);
            setAvailablePackages(packageNames);
          } else {
            setAvailablePackages([]);
          }
        } catch (err: unknown) {
          console.log('No packages found or packages directory not initialized:', err);
          setAvailablePackages([]);
        } finally {
          setLoadingPackages(false);
        }
      };
  
      useEffect(() => {
        loadPackages();
      }, [project]);
  
      const handlePackageSelection = (value: string | null) => {
        setLocalPackage(value || '');
      };

    return (
        <AutomationTaskTeaser
            task="update-sdk-and-install-and-run"
            project={project}
            onTaskStart={onTaskStart}
            icon={IconRocket}
            color="pink"
            parameters={{
                sdkPath : sdkPath, 
                wknd: wknd, 
                localPackage: localPackage, 
                replication: replication
            }}
        >
            <div>
                <Text fw={500} size="sm" mb={4}>Update SDK, install and run</Text>
                <Text size="xs" c="dimmed" mb={8}>
                    This will update the SDK, 
                    configure replication between Author, Publisher, and Dispatcher instances, 
                    load matching oak-run.jar
                    and can install WKND or any local package.
                </Text>        
                <Stack gap="xs" mb="md">
                    <Group align="end" gap="xs" mb="md">
                        <TextInput
                            label="SDK"
                            value={sdkPath}
                            onChange={(e) => setSdkPath(e.target.value)}
                            size="xs"
                            style={{ flex: 1 }}
                        />
                        <Button 
                            variant="outline" 
                            size="xs"
                            onClick={handleSelectSdkPath}
                        >
                            Browse
                        </Button>
                    </Group>
                    <Checkbox
                        label="WKND"
                        checked={wknd}
                        onChange={(e) => setWknd(e.target.checked)}
                        size="xs"
                    />
                    <Select
                    label="Local package"
                    placeholder="Select a package"
                    data={availablePackages}
                    value={localPackage}
                    onChange={handlePackageSelection}
                    disabled={loadingPackages}
                    searchable
                    clearable
                    nothingFoundMessage="No packages found"
                    size="xs"
                    />
                    <Checkbox
                        label="Replication"
                        checked={replication}
                        onChange={(e) => setReplication(e.target.checked)}
                        size="xs"
                    />
                </Stack>
                <Group gap="xs">
                    <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
                    <Badge variant="outline" color="red" size="xs">CS only. Not for classic.</Badge>
                </Group>
            </div>
        </AutomationTaskTeaser>
    )
}