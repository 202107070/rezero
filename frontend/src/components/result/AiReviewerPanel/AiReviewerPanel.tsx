export interface AiMessage {
  type: 'system' | 'user';
  text: string;
}

interface AiReviewerPanelProps {
  isOpen: boolean;
  messages: AiMessage[];
  aiInput: string;
  onOpen: () => void;
  onClose: () => void;
  onAiInputChange: (value: string) => void;
  onSend: () => void;
}

export function AiReviewerPanel({
  isOpen,
  messages,
  aiInput,
  onOpen,
  onClose,
  onAiInputChange,
  onSend,
}: AiReviewerPanelProps) {
  return (
    <>
      <button type="button" className="ai-floating-btn" onClick={onOpen}>
        🤖
      </button>
      <div className={`ai-floating-panel ${!isOpen ? 'hidden' : ''}`}>
        <div className="ai-panel-header">
          <h4 className="ai-panel-title">ROCKY AI 리뷰어</h4>
          <button type="button" className="ai-close-btn" onClick={onClose}>
            ✖
          </button>
        </div>
        <div className="ai-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ${msg.type === 'system' ? 'system' : 'user'}`}>
              {msg.text}
            </div>
          ))}
        </div>
        <div className="ai-input-area">
          <input
            type="text"
            className="ai-input"
            placeholder="AI에게 질문하기..."
            value={aiInput}
            onChange={(e) => onAiInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
          />
          <button type="button" className="ai-submit-btn" onClick={onSend}>
            전송
          </button>
        </div>
      </div>
    </>
  );
}
