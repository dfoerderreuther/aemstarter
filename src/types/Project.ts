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

export interface SslProxySettings {
  enabled: boolean;
  port: number;
}

export interface ProjectSettings {
  version: string;
  general: {
    name: string;
    healthCheck: boolean;
    javaHome: string;
  };
  author: {
    port: number;
    runmode: string;
    jvmOpts: string;
    debugJvmOpts: string;
    envVars: string;
    healthCheckPath: string;
  };
  publisher: {
    port: number;
    runmode: string;
    jvmOpts: string;
    debugJvmOpts: string;
    envVars: string;
    healthCheckPath: string;
  };
  dispatcher: {
    port: number;
    config: string;
    healthCheckPath: string;
  };
  // Legacy https settings - kept for backward compatibility
  https?: {
    enabled: boolean;
    port: number;
  };
  // New SSL proxy settings with separate proxies for author, publisher, and dispatcher
  ssl?: {
    author: SslProxySettings;
    publisher: SslProxySettings;
    dispatcher: SslProxySettings;
  };
  dev: {
    path: string;
    editor: string;
    customEditorPath: string;
    // Claude Code integration
    claudeCodeEnabled: boolean;
    claudeCodeMcpSdkVersion: string;
    claudeCodeMcpTargets: {
      author: boolean;
      publisher: boolean;
      dispatcher: boolean;
    };
    // When false, the MCP control endpoint refuses mutating tools (start/stop,
    // settings, restore, package install). Defaults to allowed when unset.
    claudeCodeControl?: boolean;
  };
} 