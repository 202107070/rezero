import { useEffect, useRef } from 'react';
import type { RoomChatMessage } from '../../../types/room';

interface RoomChatPanelProps {
  messages: RoomChatMessage[];
  chatMsg: string;
  chatMode: string;
  whisperTarget?: string | null;
  onChatMsgChange: (value: string) => void;
  onChatModeChange: (value: string) => void;
  onSend: () => void;
}

export function RoomChatPanel({
  messages,
  chatMsg,
  chatMode,
  whisperTarget,
  onChatMsgChange,
  onChatModeChange,
  onSend,
}: RoomChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      <div className="room-chat-container">
        <div className="room-chat-messages">
          {messages.map((m, i) => (
            <div key={i} className="room-chat-msg">
              {m.type === 'sys' ? (
                <div className="msg-sys">{m.text}</div>
              ) : (
                <div>
                  {m.mode ? <span className="msg-mode">{m.mode}</span> : null}
                  <span className="msg-user">[{m.name}]</span> <span className="msg-text">{m.text}</span>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>
      <div className="room-chat-input-wrapper">
        <select className="room-chat-mode-btn" value={chatMode} onChange={(e) => onChatModeChange(e.target.value)}>
          <option value="ALL">모두에게</option>
          <option value="FRIEND">친구에게</option>
          {whisperTarget && <option value="WHISPER">{`귓속말: ${whisperTarget}`}</option>}
        </select>
        <input
          type="text"
          className="room-chat-input"
          placeholder={whisperTarget && chatMode === 'WHISPER' ? `${whisperTarget}에게 귓속말...` : 'Enter Chat (Enter)'}
          value={chatMsg}
          onChange={(e) => onChatMsgChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button type="button" className="room-chat-btn" onClick={onSend}>
          SEND
        </button>
      </div>
    </>
  );
}
