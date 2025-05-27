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
        // TODO: author replication, publisher dispatcher flush
        // TODO: dynamic ports
        let command = "curl -u admin:admin 'http://localhost:4502/etc/replication/agents.author/publish/jcr:content' " + 
                    "-H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' " + 
                    "--data-raw '.%2Fsling%3AresourceType=cq%2Freplication%2Fcomponents%2Fagent&.%2Fjcr%3AlastModified=&.%2Fjcr%3AlastModifiedBy=&_charset_=utf-8&%3Astatus=browser&.%2Fjcr%3Atitle=Default%20Agent3&.%2Fjcr%3Adescription=Agent%20that%20replicates%20to%20the%20default%20publish%20instance.&.%2Fenabled=true&.%2Fenabled%40Delete=&.%2FserializationType=durbo&.%2FretryDelay=60000&.%2FuserId=&.%2FlogLevel=info&.%2FreverseReplication%40Delete=&.%2FtransportUri=http%3A%2F%2Flocalhost%3A4503%2Fbin%2Freceive%3Fsling%3AauthRequestLogin%3D1&.%2FtransportUser=admin&.%2FtransportPassword=admin&.%2FtransportNTLMDomain=&.%2FtransportNTLMHost=&.%2Fssl=&.%2FprotocolHTTPExpired%40Delete=&.%2FproxyHost=&.%2FproxyPort=&.%2FproxyUser=&.%2FproxyPassword=&.%2FproxyNTLMDomain=&.%2FproxyNTLMHost=&.%2FprotocolInterface=&.%2FprotocolHTTPMethod=&.%2FprotocolHTTPHeaders%40Delete=&.%2FprotocolHTTPConnectionClose%40Delete=true&.%2FprotocolConnectTimeout=&.%2FprotocolSocketTimeout=&.%2FprotocolVersion=&.%2FtriggerSpecific%40Delete=&.%2FtriggerModified%40Delete=&.%2FtriggerDistribute%40Delete=&.%2FtriggerOnOffTime%40Delete=&.%2FtriggerReceive%40Delete=&.%2FnoStatusUpdate%40Delete=&.%2FnoVersioning%40Delete=&.%2FqueueBatchMode%40Delete=&.%2FqueueBatchWaitTime=&.%2FqueueBatchMaxSize='"

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