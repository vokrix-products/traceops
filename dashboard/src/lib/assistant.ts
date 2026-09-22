import { DEEPSEEK_API_KEY, PRODUCT } from './product';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are the TraceOps assistant. ${PRODUCT.assistantContext}
You help compliance operators understand evidence records, explain statuses
(valid, expired, flagged, pending_approval, non_compliant, tampered, legal_hold,
in_review, missing), and suggest remediation steps. Be concise and concrete.
Never invent record data you were not given.`;

export function assistantReady(): boolean {
  return Boolean(DEEPSEEK_API_KEY);
}

export async function askAssistant(
  history: ChatMessage[],
  context: string,
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    return (
      'The assistant is not configured. Set VITE_DEEPSEEK_API_KEY to enable it.\n\n' +
      'Meanwhile: expired items must be re-reviewed, tampered or non-compliant ' +
      'items require an approval gate, and legal_hold items cannot be edited until released.'
    );
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: context },
    ...history.slice(-10),
  ];
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.3,
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      throw new Error(`Assistant responded with ${res.status}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    throw new Error('Empty assistant response');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return `Assistant unavailable (${message}). Review the evidence status and due dates manually.`;
  }
}
