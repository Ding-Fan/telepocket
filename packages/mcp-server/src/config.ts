/**
 * Environment configuration for MCP server
 */

export interface Config {
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  googleAI: {
    apiKey: string;
  };
}

/**
 * Load and validate environment variables
 */
export function loadConfig(): Config {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_AI_API_KEY'
  ];

  // Validate all required env vars are present
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
    },
    googleAI: {
      apiKey: process.env.GOOGLE_AI_API_KEY!
    }
  };
}
