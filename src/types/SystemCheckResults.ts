export interface SystemCheckResults {
    javaAvailable: boolean;
    javaVersion: string;
    dockerAvailable: boolean;
    dockerDaemonRunning: boolean;
    dockerVersion: string;
    portDispatcherAvailable: [number, boolean];
    portHttpsAvailable: [number, boolean];
    portAuthorAvailable: [number, boolean];
    portPublisherAvailable: [number, boolean];
    portAuthorDebugAvailable: [number, boolean];
    portPublisherDebugAvailable: [number, boolean];
} 