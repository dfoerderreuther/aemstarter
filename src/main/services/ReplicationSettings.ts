import { Project } from "../../types/Project";
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProjectSettingsService } from "./ProjectSettingsService";
import path from "path";
import fs from 'fs';

const execAsync = promisify(exec);

export class ReplicationSettings {
    private static instance: ReplicationSettings;
    
    private constructor() {
        // private constructor
    }

    public static getInstance(): ReplicationSettings {
        if (!ReplicationSettings.instance) {
            ReplicationSettings.instance = new ReplicationSettings();
        }
        return ReplicationSettings.instance;
    }
    async setReplication(project: Project, instance: 'author' | 'publisher' | 'dispatcher') {
        console.log('setReplication', project, instance);
        if (instance === 'dispatcher') {
            await this.setReplicationDispatcher(project);
        } else if (instance === 'author') {
            await this.setReplicationAuthor(project);
        } else if (instance === 'publisher') {
            await this.setReplicationPublisher(project);
        } else {
            throw new Error(`Invalid instance: ${instance}`);
        }
    }

    private async setReplicationDispatcher(project: Project) {
        const settings = ProjectSettingsService.getSettings(project);
        
        const dispatcherConfig = settings.dispatcher.config;

        const dispatcherConfigPath = dispatcherConfig.startsWith('/') ? dispatcherConfig : path.join(project.folderPath, 'dispatcher', dispatcherConfig);

        console.log('dispatcherConfigPath', dispatcherConfigPath);
        
        try {
            // Use Node.js fs operations instead of shell commands for better cross-platform compatibility
            const enabledFarmsDir = path.join(dispatcherConfigPath, 'conf.dispatcher.d', 'enabled_farms');
            const availableFarmsDir = path.join(dispatcherConfigPath, 'conf.dispatcher.d', 'available_farms');
            const defaultFarmPath = path.join(enabledFarmsDir, 'default.farm');
            const sourceFarmPath = path.join(availableFarmsDir, 'default.farm');
            const targetFarmPath = path.join(availableFarmsDir, 'aem-starter.farm');
            const symlinkPath = path.join(enabledFarmsDir, 'aem-starter.farm');

            console.log('Disabling default.farm');
            // Remove default.farm if it exists
            if (fs.existsSync(defaultFarmPath)) {
                await fs.promises.unlink(defaultFarmPath);
            }

            console.log('Copying default.farm to aem-starter.farm');
            // Copy default.farm to aem-starter.farm
            if (fs.existsSync(sourceFarmPath)) {
                await fs.promises.copyFile(sourceFarmPath, targetFarmPath);
            } else {
                throw new Error(`Source farm file not found: ${sourceFarmPath}`);
            }
    
            // Modify the aem-starter.farm file to update allowedClients configuration
            console.log('Updating farm file configuration');

            // Read the farm file
            const farmFileContent = await fs.promises.readFile(targetFarmPath, 'utf8');

            // Handle comments starting with #
            let updatedContent = farmFileContent;
            
            // Remove all lines starting with # using regex
            updatedContent = updatedContent.replace(/^#.*$/gm, '');
            
            // Remove any resulting empty lines at the beginning
            updatedContent = updatedContent.replace(/^\s*\n/, '');
            
            // Add the new comment at the beginning
            updatedContent = '#\n# AEM-Starter farm file. Feel free to change.\n#\n\n' + updatedContent;
            
            // Define the search pattern and replacement
            const searchPattern = /\/allowedClients\s*\{\s*\$include\s+"\.\.\/cache\/default_invalidate\.any"\s*\}/g;
            const replacement = `/allowedClients {

            $include "../cache/default_invalidate.any"
            /0003 {
                /type "allow"
                /glob "*"
            }
		}`;
            
            // Replace the pattern with the new configuration
            const finalContent = updatedContent.replace(searchPattern, replacement);
            
            // Write the modified content back to the file
            await fs.promises.writeFile(targetFarmPath, finalContent, 'utf8');

            console.log('Creating symbolic link');
            // Create symbolic link using fs.symlink instead of shell command
            const relativePath = '../available_farms/aem-starter.farm';
            
            // Remove existing symlink if it exists
            if (fs.existsSync(symlinkPath)) {
                await fs.promises.unlink(symlinkPath);
            }
            
            // Create new symlink
            await fs.promises.symlink(relativePath, symlinkPath);
            
            console.log('Successfully updated dispatcher farm configuration');
            return { success: true, message: 'Dispatcher replication configured successfully' };
        } catch (error) {
            console.error('Error updating dispatcher farm configuration:', error);
            throw error;
        }
    }

    private async setReplicationPublisher(project: Project) {
        console.log('setReplicationPublisher', project);

        const data = '/sling:resourceType=cq/replication/components/agent&' + 
        './jcr:lastModified=&' + 
        './jcr:lastModifiedBy=&' + 
        '_charset_=utf-8&' + 
        ':status=browser&' + 
        './jcr:title=Dispatcher Flush (aem-start)&' + 
        './jcr:description=Example agent that is triggered on modification and sends flush requests to the dispatcher.&' + 
        './enabled=true&./enabled@Delete=&' + 
        './serializationType=flush&' + 
        './retryDelay=60000&' + 
        './userId=&' + 
        './logLevel=error&' + 
        './reverseReplication@Delete=&' + 
        './transportUri=http://localhost:' + project.settings.dispatcher.port + '/dispatcher/invalidate.cache&' + 
        './transportUser=&' + 
        './transportPassword=&' + 
        './transportNTLMDomain=&' + 
        './transportNTLMHost=&' + 
        './ssl=default&' + 
        './protocolHTTPExpired@Delete=&' + 
        './proxyHost=&' + 
        './proxyPort=&' + 
        './proxyUser=&' + 
        './proxyPassword=&' + 
        './proxyNTLMDomain=&' + 
        './proxyNTLMHost=&' + 
        './protocolInterface=&' + 
        './protocolHTTPMethod=GET&' + 
        './protocolHTTPHeaders=CQ-Action:{action}&' + 
        './protocolHTTPHeaders=CQ-Handle:{path}&' + 
        './protocolHTTPHeaders=CQ-Path: {path}&' + 
        './protocolHTTPHeaders@Delete=&' + 
        './protocolHTTPConnectionClose@Delete=true&' + 
        './protocolConnectTimeout=&' + 
        './protocolSocketTimeout=&' + 
        './protocolVersion=&' + 
        './triggerSpecific=true&' + 
        './triggerSpecific@Delete=&' + 
        './triggerModified=true&' + 
        './triggerModified@Delete=&' + 
        './triggerDistribute=true&' + 
        './triggerDistribute@Delete=&' + 
        './triggerOnOffTime=true&' + 
        './triggerOnOffTime@Delete=&' + 
        './triggerReceive=true&' + 
        './triggerReceive@Delete=&' + 
        './noStatusUpdate@Delete=&' + 
        './noVersioning=true&' + 
        './noVersioning@Delete=&' + 
        './queueBatchMode@Delete=&' + 
        './queueBatchWaitTime=&' + 
        './queueBatchMaxSize=';
        
        const dataRaw = encodeURI(data);
        const command = "curl -u admin:admin 'http://localhost:" + project.settings.publisher.port + "/etc/replication/agents.publish/flush/jcr:content' " + 
                    "-H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' " + 
                    "--data-raw '." + dataRaw + "'"

        try {
            const { stdout } = await execAsync(command);
            console.log('Replication agent configured successfully:', stdout);
            return { success: true, output: stdout };
        } catch (error) {
            console.error('Error configuring replication agent:', error);
            return { success: false, error: error };
        }
    }

    private async setReplicationAuthor(project: Project) {
        // TODO: dynamic ports
        const data = '/sling:resourceType=cq/replication/components/agent&' + 
        './jcr:lastModified=&' + 
        './jcr:lastModifiedBy=&' + 
        '_charset_=utf-8&' + 
        ':status=browser&' + 
        './jcr:title=Default Agent (aem-start)&' + 
        './jcr:description=Agent that replicates to the default publish instance.&' + 
        './enabled=true&' + 
        './enabled@Delete=&' + 
        './serializationType=durbo&' + 
        './retryDelay=60000&' + 
        './userId=&' + 
        './logLevel=info&' + 
        './reverseReplication@Delete=&' + 
        './transportUri=http://localhost:' + project.settings.publisher.port + '/bin/receive?sling:authRequestLogin=1&' + 
        './transportUser=admin&' + 
        './transportPassword=admin&' + 
        './transportNTLMDomain=&' + 
        './transportNTLMHost=&' + 
        './ssl=&' + 
        './protocolHTTPExpired@Delete=&' + 
        './proxyHost=&' + 
        './proxyPort=&' + 
        './proxyUser=&' + 
        './proxyPassword=&' + 
        './proxyNTLMDomain=&' + 
        './proxyNTLMHost=&' + 
        './protocolInterface=&' + 
        './protocolHTTPMethod=&' + 
        './protocolHTTPHeaders@Delete=&' + 
        './protocolHTTPConnectionClose@Delete=true&' + 
        './protocolConnectTimeout=&' + 
        './protocolSocketTimeout=&' + 
        './protocolVersion=&' + 
        './triggerSpecific@Delete=&' + 
        './triggerModified@Delete=&' + 
        './triggerDistribute@Delete=&' + 
        './triggerOnOffTime@Delete=&' + 
        './triggerReceive@Delete=&' + 
        './noStatusUpdate@Delete=&' + 
        './noVersioning@Delete=&' + 
        './queueBatchMode@Delete=&' + 
        './queueBatchWaitTime=&' + 
        './queueBatchMaxSize=';
        
        const dataRaw = encodeURI(data);
        const command = "curl -u admin:admin 'http://localhost:" + project.settings.author.port + "/etc/replication/agents.author/publish/jcr:content' " + 
                    "-H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' " + 
                    "--data-raw '." + dataRaw + "'"

        try {
            const { stdout } = await execAsync(command);
            console.log('Replication agent configured successfully:', stdout);
            return { success: true, output: stdout };
        } catch (error) {
            console.error('Error configuring replication agent:', error);
            return { success: false, error: error };
        }
    }
}