const env = import.meta.env;

export const PRODUCT = {
  id: env.VITE_PRODUCT_ID || 'traceops',
  name: env.VITE_PRODUCT_NAME || 'TraceOps',
  description:
    env.VITE_PRODUCT_DESCRIPTION ||
    'TraceOps turns AI agent logs and compliance documents into auditor-ready evidence with tamper-proof controls, PII redaction, and human approval gates.',
  assistantContext:
    env.VITE_ASSISTANT_CONTEXT ||
    'TraceOps turns AI agent logs and compliance documents into auditor-ready evidence with tamper-proof controls, PII redaction, and human approval gates.',
  paywallTitle: env.VITE_PAYWALL_TITLE || 'You have used your 3 free Controls',
  paywallDescription: env.VITE_PAYWALL_DESCRIPTION || 'Upgrade to get unlimited Controls.',
  freeLimit: 3,
};

export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const DEEPSEEK_API_KEY = env.VITE_DEEPSEEK_API_KEY || '';
