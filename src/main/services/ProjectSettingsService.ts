import { Project, ProjectSettings, SslProxySettings } from '../../types/Project';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

export class ProjectSettingsService {

    static getDefaultSslProxySettings(): SslProxySettings {
        return {
            enabled: false,
            port: 443
        };
    }

    static getDefaultSettings(project: Project): ProjectSettings {
        return {
            version: "1.0.0",
            general: {
                name: project.name,
                healthCheck: true, 
                javaHome: ""
            },
            author: {
                port: 4502,
                runmode: "author,default",
                jvmOpts: "-server -Xmx4096m -Djava.awt.headless=true",
                debugJvmOpts: " -server -agentlib:jdwp=transport=dt_socket,address=0.0.0.0:5005,suspend=n,server=y",
                envVars: "",
                healthCheckPath: ""
            },
            publisher: {
                port: 4503,
                runmode: "publish,default",
                jvmOpts: "-server -Xmx4096m -Djava.awt.headless=true",
                debugJvmOpts: " -server -agentlib:jdwp=transport=dt_socket,address=0.0.0.0:5006,suspend=n,server=y",
                envVars: "",
                healthCheckPath: ""
            },
            dispatcher: {
                port: 80,
                config: "./config",
                healthCheckPath: ""
            },
            ssl: {
                author: {
                    enabled: false,
                    port: 8502
                },
                publisher: {
                    enabled: false,
                    port: 8503
                },
                dispatcher: {
                    enabled: false,
                    port: 443
                }
            },
            dev: {
                path: "",
                editor: "",
                customEditorPath: ""
            }
        };
    }

    static getSettings(project: Project): ProjectSettings {
        log.info('[ProjectSettingsService] Loading settings for project:', project.name);
        const settingsPath = path.join(project.folderPath, 'settings.json');
        
        if (fs.existsSync(settingsPath)) {
            try {
                const settingsData = fs.readFileSync(settingsPath, 'utf8');
                const parsedSettings = JSON.parse(settingsData) as ProjectSettings;
                
                log.info('[ProjectSettingsService] Loaded javaHome from file:', parsedSettings.general?.javaHome);
                
                // Validate and merge with defaults to ensure all required fields exist
                const defaultSettings = this.getDefaultSettings(project);
                const mergedSettings = this.mergeWithDefaults(parsedSettings, defaultSettings);
                
                log.info('[ProjectSettingsService] Final javaHome after merge:', mergedSettings.general.javaHome);
                
                return mergedSettings;
            } catch (error) {
                log.error('Error parsing settings file:', error);
                // Return default settings if parsing fails
                return this.getDefaultSettings(project);
            }
        }
        
        log.info('[ProjectSettingsService] No settings file found, using defaults');
        return this.getDefaultSettings(project);
    }

    static saveSettings(project: Project, settings: ProjectSettings): void {
        log.info('[ProjectSettingsService] Saving settings for project:', project.name);
        const settingsPath = path.join(project.folderPath, 'settings.json');
        
        try {
            
            // Write settings as formatted JSON
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (error) {
            log.error('Error saving settings file:', error);
            throw error;
        }
    }

    /**
     * Migrate old settings format (with https) to new format (with ssl).
     * Old format: https: { enabled, port } - only dispatcher proxy
     * New format: ssl: { author: {...}, publisher: {...}, dispatcher: {...} }
     */
    private static migrateOldSettings(settings: any, defaults: ProjectSettings): ProjectSettings['ssl'] {
        // If new ssl settings exist, use them
        if (settings.ssl) {
            return {
                author: {
                    enabled: settings.ssl.author?.enabled ?? defaults.ssl!.author.enabled,
                    port: settings.ssl.author?.port ?? defaults.ssl!.author.port
                },
                publisher: {
                    enabled: settings.ssl.publisher?.enabled ?? defaults.ssl!.publisher.enabled,
                    port: settings.ssl.publisher?.port ?? defaults.ssl!.publisher.port
                },
                dispatcher: {
                    enabled: settings.ssl.dispatcher?.enabled ?? defaults.ssl!.dispatcher.enabled,
                    port: settings.ssl.dispatcher?.port ?? defaults.ssl!.dispatcher.port
                }
            };
        }
        
        // If old https settings exist, migrate them to the new ssl.dispatcher format
        if (settings.https) {
            log.info('[ProjectSettingsService] Migrating old https settings to new ssl format');
            return {
                author: {
                    enabled: defaults.ssl!.author.enabled,
                    port: defaults.ssl!.author.port
                },
                publisher: {
                    enabled: defaults.ssl!.publisher.enabled,
                    port: defaults.ssl!.publisher.port
                },
                dispatcher: {
                    enabled: settings.https.enabled ?? defaults.ssl!.dispatcher.enabled,
                    port: settings.https.port ?? defaults.ssl!.dispatcher.port
                }
            };
        }
        
        // Return defaults
        return defaults.ssl!;
    }

    private static mergeWithDefaults(settings: any, defaults: ProjectSettings): ProjectSettings {
        // Deep merge to ensure all required properties exist
        const mergedSsl = this.migrateOldSettings(settings, defaults);
        
        return {
            version: settings.version || defaults.version,
            general: {
                name: settings.general?.name || defaults.general.name,
                healthCheck: settings.general?.healthCheck ?? defaults.general.healthCheck,
                javaHome: settings.general?.javaHome ?? defaults.general.javaHome
            },
            author: {
                port: settings.author?.port || defaults.author.port,
                runmode: settings.author?.runmode || defaults.author.runmode,
                jvmOpts: settings.author?.jvmOpts || defaults.author.jvmOpts,
                debugJvmOpts: settings.author?.debugJvmOpts || defaults.author.debugJvmOpts,
                envVars: settings.author?.envVars || defaults.author.envVars,
                healthCheckPath: settings.author?.healthCheckPath ?? defaults.author.healthCheckPath
            },
            publisher: {
                port: settings.publisher?.port || defaults.publisher.port,
                runmode: settings.publisher?.runmode || defaults.publisher.runmode,
                jvmOpts: settings.publisher?.jvmOpts || defaults.publisher.jvmOpts,
                debugJvmOpts: settings.publisher?.debugJvmOpts || defaults.publisher.debugJvmOpts,
                envVars: settings.publisher?.envVars || defaults.publisher.envVars,
                healthCheckPath: settings.publisher?.healthCheckPath ?? defaults.publisher.healthCheckPath
            },
            dispatcher: {
                port: settings.dispatcher?.port || defaults.dispatcher.port,
                config: settings.dispatcher?.config ?? defaults.dispatcher.config,
                healthCheckPath: settings.dispatcher?.healthCheckPath ?? defaults.dispatcher.healthCheckPath
            },
            // Keep old https settings for backward compatibility (read-only, synced from ssl.dispatcher)
            https: {
                enabled: mergedSsl.dispatcher.enabled,
                port: mergedSsl.dispatcher.port
            },
            ssl: mergedSsl,
            dev: {
                path: settings.dev?.path ?? defaults.dev.path,
                editor: settings.dev?.editor ?? defaults.dev.editor,
                customEditorPath: settings.dev?.customEditorPath ?? defaults.dev.customEditorPath
            }
        };
    }
}