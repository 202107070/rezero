import type { ProblemVisual } from '../../types/battle';
import { hasRenderableVisual, resolveProblemImageUrl } from '../../utils/problemVisualUtils';
import './ProblemVisualPreview.css';

interface ProblemVisualPreviewProps {
  visual?: ProblemVisual | null;
  compact?: boolean;
  suppressCaption?: boolean;
}

export default function ProblemVisualPreview({
  visual,
  compact = false,
  suppressCaption = false,
}: ProblemVisualPreviewProps) {
  if (!hasRenderableVisual(visual)) return null;

  const { kind, content, previewHtml, previewCss, caption, imageFile } = visual!;
  const imageUrl = kind === 'image' ? resolveProblemImageUrl(imageFile) : null;

  return (
    <div className={`problem-visual ${compact ? 'compact' : ''}`}>
      {caption && !suppressCaption && <div className="problem-visual-caption">{caption}</div>}
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
      {kind === 'image' && imageUrl && (
        <div className="problem-visual-image-frame" aria-label="문제 보기 그림">
          <img
            className="problem-visual-image"
            src={imageUrl}
            alt={caption || '문제 보기'}
            draggable={false}
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
