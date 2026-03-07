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
    model: string;
  };
  telepocket: {
    userId: number;
  };
}

/**
 * Load and validate environment variables
 */
export function loadConfig(): Config {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_AI_API_KEY',
    'TELEGRAM_USER_ID'
  ];

  // Validate all required env vars are present
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const userId = Number(process.env.TELEGRAM_USER_ID);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('TELEGRAM_USER_ID must be a positive integer');
  }

  return {
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
    },
    googleAI: {
      apiKey: process.env.GOOGLE_AI_API_KEY!,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    },
    telepocket: {
      userId
    }
  };
}
