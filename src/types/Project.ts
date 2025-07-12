export interface Project {
  id: string;
  name: string;
  folderPath: string;
  aemSdkPath: string;
  licensePath: string;
  createdAt: Date;
  lastModified: Date;
  settings: ProjectSettings;
  classic: boolean;
  classicQuickstartPath: string;
}

export interface ProjectSettings {
  version: string;
  general: {
    name: string;
    healthCheck: boolean;
  };
  author: {
    port: number;
    runmode: string;
    jvmOpts: string;
    debugJvmOpts: string;
    healthCheckPath: string;
  };
  publisher: {
    port: number;
    runmode: string;
    jvmOpts: string;
    debugJvmOpts: string;
    healthCheckPath: string;
  };
  dispatcher: {
    port: number;
    config: string;
    healthCheckPath: string;
  };
  https: {
    enabled: boolean;
    port: number;
  };
  dev: {
    path: string;
    editor: string;
    customEditorPath: string;
  };
} 