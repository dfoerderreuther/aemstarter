import { Project } from "../../types/Project";
import { exec } from 'child_process';
import { promisify } from 'util';

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
    async setReplication(project: Project, instance: 'author' | 'publisher') {
        if (instance === 'author') {
            await this.setReplicationAuthor(project, instance);
        } else {
            await this.setReplicationPublisher(project, instance);
        }
    }

    private async setReplicationPublisher(project: Project, instance: 'author' | 'publisher') {
        console.log('setReplicationPublisher', project, instance);

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
        './transportUri=http://localhost:80/dispatcher/invalidate.cache&' + 
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
        const command = "curl -u admin:admin 'http://localhost:4503/etc/replication/agents.publish/flush/jcr:content' " + 
                    "-H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' " + 
                    "--data-raw '." + dataRaw + "'"

        try {
            const { stdout, stderr } = await execAsync(command);
            console.log('Replication agent configured successfully:', stdout);
            return { success: true, output: stdout };
        } catch (error) {
            console.error('Error configuring replication agent:', error);
            return { success: false, error: error };
        }
    }

    private async setReplicationAuthor(project: Project, instance: 'author' | 'publisher') {
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
        './transportUri=http://localhost:4503/bin/receive?sling:authRequestLogin=1&' + 
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
        const command = "curl -u admin:admin 'http://localhost:4502/etc/replication/agents.author/publish/jcr:content' " + 
                    "-H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' " + 
                    "--data-raw '." + dataRaw + "'"

        try {
            const { stdout, stderr } = await execAsync(command);
            console.log('Replication agent configured successfully:', stdout);
            return { success: true, output: stdout };
        } catch (error) {
            console.error('Error configuring replication agent:', error);
            return { success: false, error: error };
        }
    }
}