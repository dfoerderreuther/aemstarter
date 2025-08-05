import { AutomationTaskTeaser } from "../AutomationTaskTeaser";
import { Project } from '../../../../types/Project';
import { Text, Group, Badge, Checkbox, MultiSelect, Stack } from '@mantine/core';
import { useEffect, useState } from "react";
import { PackageInfo } from "../../../../types/PackageInfo";
import { IconPackage } from "@tabler/icons-react";

interface FirstStartAndInitialSetupTeaserProps {
    project: Project;
    onTaskStart: (taskType: string, taskTitle: string) => void;
  }

export const FirstStartAndInitialSetupTeaser: React.FC<FirstStartAndInitialSetupTeaserProps> = ({  
    project,
    onTaskStart
}) => {

    const [authorPackages, setAuthorPackages] = useState<string[]>([]);
    const [publisherPackages, setPublisherPackages] = useState<string[]>([]);
    const [replication, setReplication] = useState(true);
    const [availablePackages, setAvailablePackages] = useState<string[]>([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    
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
          typeof (item as any).size === 'number'
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

      const handleAuthorPackageSelection = (values: string[]) => {
        setAuthorPackages(values);
      };

      const handlePublisherPackageSelection = (values: string[]) => {
        setPublisherPackages(values);
      };

    return (
        <AutomationTaskTeaser
            task="first-start-and-initial-setup"
            project={project}
            onTaskStart={onTaskStart}
            icon={IconPackage}
            color="pink"
            parameters={{
                authorPackages: authorPackages, 
                publisherPackages: publisherPackages, 
                replication: replication
            }}
        >
            <div>
                <Text fw={500} size="sm" mb={4}>First start and initial setup</Text>
                <Text size="xs" c="dimmed" mb={8}>
                    This will start all instances, 
                    configure replication between Author, Publisher, and Dispatcher instances, 
                    load matching oak-run.jar
                    and can install local packages to Author and/or Publisher instances in the specified order.
                </Text>        
                <Stack gap="xs" mb="md">
                    <MultiSelect
                        label="Author packages"
                        placeholder="Select packages for Author instance"
                        data={availablePackages}
                        value={authorPackages}
                        onChange={handleAuthorPackageSelection}
                        disabled={loadingPackages}
                        searchable
                        clearable
                        nothingFoundMessage="No packages found"
                        size="xs"
                        description="Packages will be installed in the selected order"
                    />
                    <MultiSelect
                        label="Publisher packages"
                        placeholder="Select packages for Publisher instance"
                        data={availablePackages}
                        value={publisherPackages}
                        onChange={handlePublisherPackageSelection}
                        disabled={loadingPackages}
                        searchable
                        clearable
                        nothingFoundMessage="No packages found"
                        size="xs"
                        description="Packages will be installed in the selected order"
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