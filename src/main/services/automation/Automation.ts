import { Project } from '../../../types/Project';
import { ProjectSettings } from '../ProjectSettings';
import { AutomatedLastBackupAndRun } from './AutomatedLastBackupAndRun';

export interface AutoTask {
    project: Project;
    run() : Promise<void>;
}

// Type for task constructors
type AutoTaskConstructor = new (project: Project) => AutoTask;

export class Automation {

    private project: Project;

    // Store class constructors as static - shared across all instances
    private static taskRegistry: Map<string, AutoTaskConstructor> = new Map([
        ['last-backup-and-run', AutomatedLastBackupAndRun]
    ]);

    private constructor(project: Project) {
        this.project = project;
        // No longer need to register tasks here
    }

    static async run(project: Project, type: string) : Promise<void> {
        const automation = new Automation(project);
        await automation.run(type);
    }

    private async run(type: string) : Promise<void> {
        // Get the constructor from static registry
        const TaskConstructor = Automation.taskRegistry.get(type);
        
        if (TaskConstructor) {
            // Instantiate the task only when needed
            const task = new TaskConstructor(this.project);
            await task.run();
        } else {
            switch (type) {
                case 'run':
                    // Add specific automation logic here
                    console.log('Running automation...');
                    break;
                default:
                    console.log(`Unknown automation type: ${type}`);
            }
        }
    }

    




}