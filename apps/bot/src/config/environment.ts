import dotenv from 'dotenv';

dotenv.config();

interface Config {
  telegram: {
    botToken: string;
    userId: number;
    webAppUrl: string;
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
  llm: {
    provider: 'gemini' | 'openrouter';
    classificationEnabled: boolean;
    confidenceThreshold: number; // Legacy 0-1 threshold (deprecated)
    autoConfirmThreshold: number; // 0-100 threshold for auto-confirming categories
    showButtonThreshold: number; // 0-100 threshold for showing category buttons
    japaneseCategoryEnabled: boolean;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  openrouter: {
    apiKey: string;
    model: string;
    fallbackToGemini: boolean;
  };
  environment: string;
}

function validateEnv(): Config {
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_USER_ID',
    'WEB_APP_URL',
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

  // Parse LLM provider
  const llmProvider = (process.env.LLM_PROVIDER || 'gemini') as 'gemini' | 'openrouter';
  if (!['gemini', 'openrouter'].includes(llmProvider)) {
    throw new Error('LLM_PROVIDER must be either "gemini" or "openrouter"');
  }

  // Validate provider-specific API keys
  if (llmProvider === 'gemini' && !process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY is required when LLM_PROVIDER is "gemini"');
  }
  if (llmProvider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is required when LLM_PROVIDER is "openrouter"');
    }
    // Validate fallback configuration
    const fallbackEnabled = process.env.OPENROUTER_FALLBACK_TO_GEMINI !== 'false';
    if (fallbackEnabled && !process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY is required when OPENROUTER_FALLBACK_TO_GEMINI is enabled (default: true)');
    }
  }

  // Parse LLM configuration with defaults
  const confidenceThreshold = parseFloat(process.env.LLM_CONFIDENCE_THRESHOLD || '0.6');
  if (isNaN(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
    throw new Error('LLM_CONFIDENCE_THRESHOLD must be a number between 0 and 1');
  }

  // Parse new 0-100 thresholds
  const autoConfirmThreshold = parseInt(process.env.LLM_AUTO_CONFIRM_THRESHOLD || '95');
  if (isNaN(autoConfirmThreshold) || autoConfirmThreshold < 0 || autoConfirmThreshold > 100) {
    throw new Error('LLM_AUTO_CONFIRM_THRESHOLD must be a number between 0 and 100');
  }

  const showButtonThreshold = parseInt(process.env.LLM_SHOW_BUTTON_THRESHOLD || '60');
  if (isNaN(showButtonThreshold) || showButtonThreshold < 0 || showButtonThreshold > 100) {
    throw new Error('LLM_SHOW_BUTTON_THRESHOLD must be a number between 0 and 100');
  }

  // Validate threshold relationship
  if (autoConfirmThreshold < showButtonThreshold) {
    throw new Error('LLM_AUTO_CONFIRM_THRESHOLD must be >= LLM_SHOW_BUTTON_THRESHOLD');
  }

  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      userId,
      webAppUrl: process.env.WEB_APP_URL!
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
    llm: {
      provider: llmProvider,
      classificationEnabled: process.env.LLM_CLASSIFICATION_ENABLED !== 'false',
      confidenceThreshold, // Legacy (deprecated)
      autoConfirmThreshold,
      showButtonThreshold,
      japaneseCategoryEnabled: process.env.LLM_JAPANESE_CATEGORY_ENABLED !== 'false'
    },
    gemini: {
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      fallbackToGemini: process.env.OPENROUTER_FALLBACK_TO_GEMINI !== 'false'
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

export const config = validateEnv();
