import type { ProblemVisual } from '../../types/battle';
import './ProblemVisualPreview.css';

interface ProblemVisualPreviewProps {
  visual?: ProblemVisual | null;
  compact?: boolean;
}

export default function ProblemVisualPreview({ visual, compact = false }: ProblemVisualPreviewProps) {
  if (!visual) return null;

  const { kind, content, previewHtml, previewCss, caption } = visual;

  return (
    <div className={`problem-visual ${compact ? 'compact' : ''}`}>
      {caption && <div className="problem-visual-caption">{caption}</div>}
      {kind === 'ascii' && content && (
        <pre className="problem-visual-ascii" aria-label="목표 출력 모양">
          {content}
        </pre>
      )}
      {(kind === 'svg' || kind === 'canvas') && content && (
        <div className="problem-visual-svg-frame" aria-label="목표 그래픽">
          <div
            className="problem-visual-svg-stage"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      )}
      {kind === 'html' && previewHtml && (
        <div className="problem-visual-html-frame">
          <div className="problem-visual-html-label">미리보기</div>
          <div className="problem-visual-html-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
      {kind === 'css' && previewHtml && (
        <div className="problem-visual-css-frame">
          <div className="problem-visual-html-label">목표 레이아웃</div>
          {previewCss && <style>{previewCss}</style>}
          <div className="problem-visual-css-stage" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
    </div>
  );
}
