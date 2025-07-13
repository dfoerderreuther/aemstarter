import { Group, Paper, Button, Stack } from "@mantine/core";
import { IconPackage } from "@tabler/icons-react";
import { useState } from "react";
import { Project } from '../../../types/Project';

interface AutomationTaskTeaserProps {
    task: string;
    project: Project;
    parameters?: { [key: string]: string | boolean | number };
    children: React.ReactNode;
    icon?: React.ComponentType<{ size: number; color?: string }>;
    taskTitle?: string;
    color?: string;
    onTaskStart?: (taskType: string, taskTitle: string) => void;
}

export const AutomationTaskTeaser: React.FC<AutomationTaskTeaserProps> = ({ 
    task, 
    project, 
    parameters,
    children, 
    icon: Icon = IconPackage,
    taskTitle = "Automation Task",
    color = "orange",
    onTaskStart
}) => {
    const [isRunning, setIsRunning] = useState(false);

    const handleTaskRun = async () => {
        try {
            setIsRunning(true);
            if (onTaskStart) {
                onTaskStart(task, taskTitle);
            }
            console.log(`[AutomationTaskTeaser] Running task: ${task}`);
            await window.electronAPI.runAutomationTask(project, task, parameters);
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
        <Paper style={taskItemStyles} radius={0}>
          <Group align="flex-start" gap="md">
            <div style={{ 
              width: '48px', 
              height: '48px', 
              backgroundColor: `var(--mantine-color-${color}-1)`, 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={24} color={`var(--mantine-color-${color}-6)`} />
            </div>
            
            <div style={{ flex: 1 }}>
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs" style={{ flex: 1 }}>
                  {children}
                </Stack>
                
                <Button
                  color={color}
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
    )
}