import { useEffect, useRef } from 'react';

export interface ChatMessage {
  sender: string;
  text: string;
  mode: string;
  time: string;
}

interface BattleChatPanelProps {
  messages: ChatMessage[];
  chatMsg: string;
  chatMode: string;
  onMsgChange: (v: string) => void;
  onModeChange: (v: string) => void;
  onSend: () => void;
}

export default function BattleChatPanel({
  messages,
  chatMsg,
  chatMode,
  onMsgChange,
  onModeChange,
  onSend,
}: BattleChatPanelProps) {
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-panel-fixed">
      <div className="chat-wrapper chat-expanded">
        <div className="chat-messages" ref={messagesRef}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '2px' }}>
              {msg.sender === 'SYSTEM' ? (
                <span style={{ color: 'var(--px-warning)' }}>{msg.text}</span>
              ) : (
                <span>
                  <span style={{ color: 'var(--px-warning)', fontSize: '14px' }}>{msg.mode}</span>{' '}
                  <span style={{ color: 'var(--px-primary)' }}>{msg.sender}</span>{' '}
                  <span style={{ color: '#ccc' }}>{msg.text}</span>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <select className="chat-mode-select" value={chatMode} onChange={(e) => onModeChange(e.target.value)}>
            <option value="ALL">모두에게</option>
            <option value="FRIEND">친구에게</option>
          </select>
          <input
            type="text"
            className="chat-input"
            placeholder="메시지..."
            value={chatMsg}
            onChange={(e) => onMsgChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
          />
          <button type="button" className="chat-send-btn" onClick={onSend}>
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
