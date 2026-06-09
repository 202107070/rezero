import { useEffect, useRef } from 'react';

export interface ResultChatMessage {
  sender: string;
  text: string;
  type: 'sys' | 'user';
  mode?: string;
  time?: string;
}

interface ResultChatPanelProps {
  messages: ResultChatMessage[];
  chatInput: string;
  chatMode: string;
  myUserId: string;
  onChatInputChange: (value: string) => void;
  onChatModeChange: (value: string) => void;
  onSend: () => void;
}

export function ResultChatPanel({
  messages,
  chatInput,
  chatMode,
  myUserId,
  onChatInputChange,
  onChatModeChange,
  onSend,
}: ResultChatPanelProps) {
  const chatDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="chat-wrapper">
      <div className="chat-messages" ref={chatDisplayRef}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '2px' }}>
            {msg.type === 'sys' ? (
              <span style={{ color: 'var(--px-primary)' }}>[시스템] {msg.text}</span>
            ) : (
              <span>
                <span style={{ color: '#888', fontSize: '14px' }}>{msg.time}</span>
                <span style={{ color: 'var(--px-warning)', fontSize: '14px', marginLeft: '6px' }}>{msg.mode}</span>
                <span
                  className={msg.sender === myUserId ? 'pixel-text-success' : 'pixel-text-danger'}
                  style={{ marginLeft: '6px' }}
                >
                  {msg.sender}:
                </span>
                <span style={{ color: '#eee', marginLeft: '6px' }}>{msg.text}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <select className="chat-mode-select" value={chatMode} onChange={(e) => onChatModeChange(e.target.value)}>
          <option value="ALL">모두에게</option>
          <option value="FRIEND">친구에게</option>
        </select>
        <input
          type="text"
          className="chat-input"
          placeholder="메시지 입력..."
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button type="button" className="chat-send-btn" onClick={onSend}>
          전송
        </button>
      </div>
    </div>
  );
}
