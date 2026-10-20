export const COPILOT_MCP_CONFIG_FILE = '.aem-starter-copilot-mcp.json';

export interface CodeAssistantAvailability {
  available: boolean;
  version?: string;
}

export interface McpEndpointConfig {
  type: 'http';
  url: string;
  tools?: string[];
}

export interface CodeAssistantSetupResult {
  mcpConfigPath: string;
  port: number;
  url: string;
  targets: string[];
  endpoints: Record<string, McpEndpointConfig>;
}
