import { useEffect, useRef, useState } from 'react';
import { askAssistant, assistantReady, type ChatMessage } from '../lib/assistant';
import { PRODUCT } from '../lib/product';

interface Props {
  context: string;
  onClose: () => void;
}

export function AssistantDrawer({ context, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: `Hi — I'm the ${PRODUCT.name} assistant. Ask me about evidence statuses, due dates, or how to clear a blocked control.`,
      },
    ]);
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    const reply = await askAssistant(next, context);
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    setBusy(false);
  }

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            {assistantReady() ? 'DeepSeek connected' : 'Offline guidance mode'}
          </div>
        </div>
        <button className="btn btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="drawer-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user' ? 'msg user' : m.role === 'assistant' ? 'msg bot' : 'msg sys'
            }
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="msg sys">
            <span className="spinner" style={{ display: 'inline-block' }} /> thinking…
          </div>
        ) : null}
      </div>
      <div className="drawer-foot">
        <input
          className="input"
          placeholder="Ask about a control, status, or due date…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn btn-primary" onClick={() => void send()} disabled={busy}>
          Send
        </button>
      </div>
    </div>
  );
}

export default AssistantDrawer;
