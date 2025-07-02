import { Project, ProjectSettings } from '../../types/Project';
import fs from 'fs';
import path from 'path';

export class ProjectSettingsService {

    static getDefaultSettings(project: Project): ProjectSettings {
        return {
            version: "1.0.0",
            general: {
                name: project.name,
                healthCheck: true
            },
            author: {
                port: 4502,
                runmode: "author,default",
                jvmOpts: "-server -Xmx4096m -Djava.awt.headless=true",
                debugJvmOpts: " -server -agentlib:jdwp=transport=dt_socket,address=0.0.0.0:5005,suspend=n,server=y",
                healthCheckPath: ""
            },
            publisher: {
                port: 4503,
                runmode: "publish,default",
                jvmOpts: "-server -Xmx4096m -Djava.awt.headless=true",
                debugJvmOpts: " -server -agentlib:jdwp=transport=dt_socket,address=0.0.0.0:5006,suspend=n,server=y",
                healthCheckPath: ""
            },
            dispatcher: {
                port: 80,
                config: "./config",
                healthCheckPath: ""
            },
            dev: {
                path: "",
                editor: "",
                customEditorPath: ""
            }
        };
    }

    static getSettings(project: Project): ProjectSettings {
        console.log('[ProjectSettingsService] Loading settings for project:', project.name);
        const settingsPath = path.join(project.folderPath, 'settings.json');
        
        if (fs.existsSync(settingsPath)) {
            try {
                const settingsData = fs.readFileSync(settingsPath, 'utf8');
                const parsedSettings = JSON.parse(settingsData) as ProjectSettings;
                
                // Validate and merge with defaults to ensure all required fields exist
                const defaultSettings = this.getDefaultSettings(project);
                return this.mergeWithDefaults(parsedSettings, defaultSettings);
            } catch (error) {
                console.error('Error parsing settings file:', error);
                // Return default settings if parsing fails
                return this.getDefaultSettings(project);
            }
        }
        
        return this.getDefaultSettings(project);
    }

    static saveSettings(project: Project, settings: ProjectSettings): void {
        console.log('[ProjectSettingsService] Saving settings for project:', project.name);
        const settingsPath = path.join(project.folderPath, 'settings.json');
        
        try {
            
            // Write settings as formatted JSON
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving settings file:', error);
            throw error;
        }
    }

    private static mergeWithDefaults(settings: any, defaults: ProjectSettings): ProjectSettings {
        // Deep merge to ensure all required properties exist
        return {
            version: settings.version || defaults.version,
            general: {
                name: settings.general?.name || defaults.general.name,
                healthCheck: settings.general?.healthCheck ?? defaults.general.healthCheck
            },
            author: {
                port: settings.author?.port || defaults.author.port,
                runmode: settings.author?.runmode || defaults.author.runmode,
                jvmOpts: settings.author?.jvmOpts || defaults.author.jvmOpts,
                debugJvmOpts: settings.author?.debugJvmOpts || defaults.author.debugJvmOpts,
                healthCheckPath: settings.author?.healthCheckPath || defaults.author.healthCheckPath
            },
            publisher: {
                port: settings.publisher?.port || defaults.publisher.port,
                runmode: settings.publisher?.runmode || defaults.publisher.runmode,
                jvmOpts: settings.publisher?.jvmOpts || defaults.publisher.jvmOpts,
                debugJvmOpts: settings.publisher?.debugJvmOpts || defaults.publisher.debugJvmOpts,
                healthCheckPath: settings.publisher?.healthCheckPath || defaults.publisher.healthCheckPath
            },
            dispatcher: {
                port: settings.dispatcher?.port || defaults.dispatcher.port,
                config: settings.dispatcher?.config || defaults.dispatcher.config,
                healthCheckPath: settings.dispatcher?.healthCheckPath || defaults.dispatcher.healthCheckPath
            },
            dev: {
                path: settings.dev?.path || defaults.dev.path,
                editor: settings.dev?.editor || defaults.dev.editor,
                customEditorPath: settings.dev?.customEditorPath || defaults.dev.customEditorPath
            }
        };
    }
}