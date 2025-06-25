import { Project } from '../../../types/Project';
import { AutomatedCreateBackupAndRun } from './AutomatedCreateBackupAndRun';
import { AutomatedFirstBackupAndRun } from './AutomatedFirstBackupAndRun';
import { AutomatedLastBackupAndDebug } from './AutomatedLastBackupAndDebug';
import { AutomatedLastBackupAndRun } from './AutomatedLastBackupAndRun';
import { AutomatedReinstall } from './AutomatedReinstall';
import { BrowserWindow } from 'electron';

export interface AutoTask {
    project: Project;
    run(progressCallback?: (message: string) => void) : Promise<void>;
}

type AutoTaskConstructor = new (project: Project) => AutoTask;

export class Automation {

    private project: Project;

    private static taskRegistry: Map<string, AutoTaskConstructor> = new Map<string, AutoTaskConstructor>([
        ['create-backup-and-run', AutomatedCreateBackupAndRun],
        ['last-backup-and-run', AutomatedLastBackupAndRun],
        ['last-backup-and-debug', AutomatedLastBackupAndDebug],
        ['first-backup-and-run', AutomatedFirstBackupAndRun],
        ['reinstall', AutomatedReinstall]   
    ]);

    private constructor(project: Project) {
        this.project = project;
    }

    static async run(project: Project, type: string, mainWindow?: BrowserWindow) : Promise<void> {
        const automation = new Automation(project);
        await automation.run(type, mainWindow);
    }

    private async run(type: string, mainWindow?: BrowserWindow) : Promise<void> {
        const TaskConstructor = Automation.taskRegistry.get(type);
        if (TaskConstructor) {
            console.log(`[Automation] Running task: ${type}`);
            
            // Create progress callback to send updates to frontend
            const progressCallback = (message: string) => {
                console.log(`[Automation] ${type}: ${message}`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('automation-progress', {
                        projectId: this.project.id,
                        taskType: type,
                        message: message,
                        timestamp: new Date().toISOString()
                    });
                }
            };

            const task = new TaskConstructor(this.project);
            await task.run(progressCallback);
            
            console.log(`[Automation] Task ${type} completed`);
            progressCallback('Task completed successfully');
        } else {
            console.log(`[Automation] Unknown task: ${type}`);
        } 
    }

}