import { Config } from './config.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolContext {
  config: Config;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

export function createToolRegistry(tools: RegisteredTool[]): Map<string, RegisteredTool> {
  return new Map(tools.map((tool) => [tool.definition.name, tool]));
}
