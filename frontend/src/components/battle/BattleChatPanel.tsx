import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

interface BattleChatPanelProps {
  messages: ChatMessage[];
  chatMsg: string;
  onMsgChange: (v: string) => void;
  onSend: () => void;
}

export default function BattleChatPanel({
  messages,
  chatMsg,
  onMsgChange,
  onSend,
}: BattleChatPanelProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  return (
    <div className={`battle-spectator-chat${open ? ' is-open' : ''}`}>
      {open && (
        <div className="battle-spectator-chat-panel pixel-card">
          <div className="battle-spectator-chat-header">
            <span>💬 채팅</span>
            <button
              type="button"
              className="battle-spectator-chat-close"
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <div className="battle-spectator-chat-body">
            <div className="chat-messages" ref={messagesRef}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '2px' }}>
                  {msg.sender === 'SYSTEM' ? (
                    <span style={{ color: 'var(--px-warning)' }}>{msg.text}</span>
                  ) : (
                    <span>
                      <span style={{ color: 'var(--px-primary)' }}>{msg.sender}</span>{' '}
                      <span style={{ color: '#ccc' }}>{msg.text}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="chat-input-row battle-spectator-chat-input-row">
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
      )}
      <button
        type="button"
        className={`battle-spectator-chat-toggle pixel-btn pixel-btn-primary${open ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        💬 채팅
      </button>
    </div>
  );
}
