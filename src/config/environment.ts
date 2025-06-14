import dotenv from 'dotenv';

dotenv.config();

interface Config {
  telegram: {
    botToken: string;
    userId: number;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  environment: string;
}

function validateEnv(): Config {
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_USER_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const userId = parseInt(process.env.TELEGRAM_USER_ID!);
  if (isNaN(userId)) {
    throw new Error('TELEGRAM_USER_ID must be a valid number');
  }

  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      userId
    },
    supabase: {
      url: process.env.SUPABASE_URL!,
      anonKey: process.env.SUPABASE_ANON_KEY!
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

export const config = validateEnv();
