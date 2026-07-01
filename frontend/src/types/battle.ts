export interface ProblemVisual {
  kind: 'ascii' | 'html' | 'css' | 'svg' | 'canvas' | 'image';
  content?: string;
  previewHtml?: string;
  previewCss?: string;
  caption?: string;
  /** public/assets/problem-images/ 내 파일명 (예: v01-star-pyramid.svg) */
  imageFile?: string;
}

export type ProblemStyle = 'code' | 'multiple_choice' | 'short_answer';

export interface ProblemCapabilities {
  style: ProblemStyle;
  hasVisual: boolean;
  hasImage: boolean;
  items: Record<keyof ItemInventory, boolean>;
  canUseHint: boolean;
  canUseAutoSolve: boolean;
  canUseBuildBonus: boolean;
  showCodePanel: boolean;
  showMultipleChoicePanel: boolean;
  showShortAnswerPanel: boolean;
}

export interface BattleProblem {
  id?: string;
  type: 'fill_blank' | 'visual_fill_blank' | 'multiple_choice' | 'short_answer' | string;
  difficulty?: string;
  title?: string;
  question?: string;
  answer?: Record<string, string[]>;
  options?: string[] | null;
  correctIndex?: number | null;
  explanation?: string;
  description?: string;
  input?: string;
  output?: string;
  visual?: ProblemVisual | null;
  /** 특수 문제만 아이템 허용 정책 덮어쓰기 */
  capabilityOverrides?: Partial<Record<keyof ItemInventory, boolean>>;
}

export interface ItemInventory {
  paint: number;
  revealLength: number;
  revealPrev: number;
  lightning: number;
  timeReduce: number;
  scribble: number;
  blankBreak: number;
  buildCharge: number;
}

export interface RoomUser {
  id: string;
  name: string;
  avatar: string;
  problem: number;
  solvedCount: number;
  solvedProblems: number[];
  ingameScore: number;
  totalSolveTime: number;
  completionTime?: number;
  finishedAtElapsed?: number;
  status?: string;
  problemResults?: boolean[];
}
