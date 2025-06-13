export interface SystemCheckResults {
    javaAvailable: boolean;
    javaVersion: string;
    dockerAvailable: boolean;
    dockerDaemonRunning: boolean;
    dockerVersion: string;
    port80Available: boolean;
    port4502Available: boolean;
    port4503Available: boolean;
    portAuthorDebugAvailable: boolean;
    portPublisherDebugAvailable: boolean;
} 