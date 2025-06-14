export interface SystemCheckResults {
    javaAvailable: boolean;
    javaVersion: string;
    dockerAvailable: boolean;
    dockerDaemonRunning: boolean;
    dockerVersion: string;
    portDispatcherAvailable: boolean;
    portAuthorAvailable: boolean;
    portPublisherAvailable: boolean;
    portAuthorDebugAvailable: boolean;
    portPublisherDebugAvailable: boolean;
} 