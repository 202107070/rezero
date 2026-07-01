import { PROBLEM_IMAGES_BASE_URL } from '../constants/problemImages';
import type { BattleProblem, ProblemVisual } from '../types/battle';

const RENDERABLE_KINDS = new Set<ProblemVisual['kind']>(['ascii', 'html', 'css', 'svg', 'canvas', 'image']);

function sanitizeImageFileName(fileName: string): string {
  return fileName.replace(/^\/+/, '').replace(/\.\./g, '').trim();
}

/** problem-images 디렉터리 기준 파일명 → 로드 URL */
export function resolveProblemImageUrl(imageFile?: string | null): string | null {
  const safe = sanitizeImageFileName(imageFile || '');
  if (!safe) return null;
  return `${PROBLEM_IMAGES_BASE_URL}${safe}`;
}

/** 화면에 실제로 그릴 수 있는 visual 데이터인지 판별 */
export function hasRenderableVisual(visual?: ProblemVisual | null): boolean {
  if (!visual || !RENDERABLE_KINDS.has(visual.kind)) return false;

  switch (visual.kind) {
    case 'ascii':
    case 'svg':
    case 'canvas':
      return Boolean(visual.content?.trim());
    case 'html':
      return Boolean(visual.previewHtml?.trim());
    case 'css':
      return Boolean(visual.previewHtml?.trim());
    case 'image':
      return Boolean(resolveProblemImageUrl(visual.imageFile));
    default:
      return false;
  }
}

/** 문제에 표시 가능한 보기(그림)가 있는지 */
export function problemHasVisual(problem?: Pick<BattleProblem, 'visual'> | null): boolean {
  return hasRenderableVisual(problem?.visual);
}

/** 렌더 불가 visual은 null 로 정규화 */
export function normalizeProblemVisual(visual?: ProblemVisual | null): ProblemVisual | null {
  if (!visual) return null;
  return hasRenderableVisual(visual) ? visual : null;
}
