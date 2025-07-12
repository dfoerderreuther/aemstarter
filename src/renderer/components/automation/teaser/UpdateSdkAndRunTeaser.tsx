import { AutomationTaskTeaser } from "../AutomationTaskTeaser";
import { Project } from '../../../../types/Project';
import { Text, TextInput, Group, Button, Badge } from '@mantine/core';
import { useState } from "react";


interface UpdateSdkAndRunTeaserProps {
    project: Project;
    onTaskStart: (taskType: string, taskTitle: string) => void;
  }

export const UpdateSdkAndRunTeaser: React.FC<UpdateSdkAndRunTeaserProps> = ({  
    project,
    onTaskStart
}) => {
    const [sdkPath, setSdkPath] = useState('');
    
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

    return (
        <AutomationTaskTeaser
            task="update-sdk-and-run"
            project={project}
            onTaskStart={onTaskStart}
            parameters={{
                sdkPath : sdkPath
            }}
        >
            <div>
                <Text fw={500} size="sm" mb={4}>Update SDK and run</Text>
                <Text size="xs" c="dimmed" mb={8}>
                    This will update the SDK and run.
                </Text>
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
                <Group gap="xs">
                    <Badge variant="outline" color="orange" size="xs">Destructive</Badge>
                    <Badge variant="outline" color="red" size="xs">CS only. Not for classic.</Badge>
                </Group>
            </div>
        </AutomationTaskTeaser>
    )
}