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
  cloudflareR2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl: string;
  };
  environment: string;
}

function validateEnv(): Config {
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_USER_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'CLOUDFLARE_R2_ACCOUNT_ID',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_URL'
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
    cloudflareR2: {
      accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID!,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL!
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

export const config = validateEnv();
