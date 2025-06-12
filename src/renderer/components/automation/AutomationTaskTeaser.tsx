import { Group, Paper, Button, LoadingOverlay } from "@mantine/core";
import { IconPackage } from "@tabler/icons-react";
import { useState } from "react";
import { Project } from '../../../types/Project';

interface AutomationTaskTeaserProps {
    task: string;
    project: Project;
    children: React.ReactNode;
    icon?: React.ComponentType<{ size: number; color?: string }>;
}

export const AutomationTaskTeaser: React.FC<AutomationTaskTeaserProps> = ({ 
    task, 
    project, 
    children, 
    icon: Icon = IconPackage 
}) => {
    const [isRunning, setIsRunning] = useState(false);

    const handleTaskRun = async () => {
        try {
            setIsRunning(true);
            console.log(`[AutomationTaskTeaser] Running task: ${task}`);
            await window.electronAPI.runAutomationTask(project, task);
        } catch (error) {
            console.error(`[AutomationTaskTeaser] Failed to run task ${task}:`, error);
        } finally {
            setIsRunning(false);
        }
    }
    
    const taskItemStyles = {
        padding: '16px',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        '&:hover': {
        backgroundColor: 'var(--mantine-color-gray-0)',
        }
    };
    return (
        <>
          <LoadingOverlay 
            visible={isRunning} 
            zIndex={1000} 
            overlayProps={{ 
              radius: "sm", 
              blur: 2,
              style: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }
            }}
            loaderProps={{ color: 'orange', type: 'dots' }}
          />
          <Paper style={taskItemStyles} radius={0}>
            <Group align="flex-start" gap="md">
              <div style={{ 
                width: '48px', 
                height: '48px', 
                backgroundColor: 'var(--mantine-color-orange-1)', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={24} color="var(--mantine-color-orange-6)" />
              </div>
              
              <div style={{ flex: 1 }}>
                <Group justify="space-between" align="flex-start">
                  {children}
                  
                  <Button
                    color="orange"
                    size="xs"
                    loading={isRunning}
                    disabled={isRunning}
                    onClick={handleTaskRun}
                    leftSection={<Icon size={14} />}
                  >
                    Activate
                  </Button>
                </Group>
              </div>
            </Group>
          </Paper>
        </>
    )
}