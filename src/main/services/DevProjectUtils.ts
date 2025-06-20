import { Project } from "../../types/Project";
import { ProjectSettingsService } from "./ProjectSettingsService";
import { spawn } from 'child_process';

export class DevProjectUtils {

    async open(project: Project, type: 'files' | 'terminal' | 'editor') : Promise<void> {
        switch (type) {
            case 'files':
                await this.openFiles(project);
                break;
            case 'terminal':
                await this.openTerminal(project);
                break;
            case 'editor':
                await this.openEditor(project);
                break;
        }
    }

    private async openFiles(project: Project) : Promise<void> {
        const settings = ProjectSettingsService.getSettings(project);
        await this.execCommand('open', settings.dev.path)
    }

    private async openTerminal(project: Project) : Promise<void> {
        const settings = ProjectSettingsService.getSettings(project);
        await this.execCommand('open -a Terminal', settings.dev.path)
    }

    private async openEditor(project: Project) : Promise<void> {
        const settings = ProjectSettingsService.getSettings(project);

        const customEditorPath = settings.dev.customEditorPath;
        const editor = settings.dev.editor;

        const command = editor === 'custom' && customEditorPath ? customEditorPath : editor;

        await this.execCommand(command, settings.dev.path);
    }

    private async execCommand(command: string, path: string) : Promise<void> {
        try {
            // Parse command and arguments
            const parts = command.split(' ');
            const cmd = parts[0];
            const args = [...parts.slice(1), path];

            // Create enhanced PATH like enhancedExecAsync
            const enhancedPath = [
                process.env.PATH || '',
                '/usr/local/bin', 
                '/opt/homebrew/bin', 
                '/usr/bin',
                '/bin'
            ].filter(Boolean).join(':');

            // Spawn detached process that runs independently of the app
            const child = spawn(cmd, args, {
                detached: true,
                stdio: 'ignore',
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    PATH: enhancedPath
                }
            });

            // Unreference the child process so parent can exit independently
            child.unref();

        } catch (error) {
            console.error('[DevProjectUtils] Error executing command: ', command, error);
        }
    }


}