export interface InstanceStartData {
  usedProcessEnv: { [key: string]: string | undefined };
  envVarsObj: { [key: string]: string };
  port: number;
  runmode: string;
  jvmOptions: string;
  isDebugMode: boolean;
  startedWithStartScript: boolean;
  timestamp: Date;
} 