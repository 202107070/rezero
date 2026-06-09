import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../types/lobby';

interface LobbyChatPanelProps {
  messages: ChatMessage[];
  chatMsg: string;
  chatMode: string;
  onChatMsgChange: (value: string) => void;
  onChatModeChange: (value: string) => void;
  onSend: () => void;
}

export function LobbyChatPanel({
  messages,
  chatMsg,
  chatMode,
  onChatMsgChange,
  onChatModeChange,
  onSend,
}: LobbyChatPanelProps) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-wrapper pixel-card" style={{ padding: '4px', flex: 1, minHeight: 0 }}>
      <div className="chat-messages" ref={chatRef}>
        {messages.length === 0 ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: '100%' }}>
            <span className="pixel-text-muted" style={{ fontSize: '24px' }}>
              CHAT WINDOW
            </span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '4px', color: '#eee', fontSize: '16px' }}>
              <span style={{ color: '#888', fontSize: '16px' }}>{msg.time}</span>
              <span style={{ color: 'var(--px-warning)', marginLeft: '8px', fontSize: '16px' }}>{msg.mode}</span>
              <span style={{ color: 'var(--px-success)', marginLeft: '8px' }}>{msg.sender}</span>
              <br />
              {msg.text}
            </div>
          ))
        )}
      </div>
      <div className="chat-input-row">
        <select className="chat-mode-select" value={chatMode} onChange={(e) => onChatModeChange(e.target.value)}>
          <option value="ALL">모두에게</option>
          <option value="FRIEND">친구에게</option>
        </select>
        <input
          type="text"
          className="chat-input"
          value={chatMsg}
          onChange={(e) => onChatMsgChange(e.target.value)}
          placeholder="메시지 입력..."
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button type="button" className="chat-send-btn" onClick={onSend}>
          전송
        </button>
      </div>
    </div>
  );
}
