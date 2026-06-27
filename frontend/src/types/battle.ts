export interface ProblemVisual {
  kind: 'ascii' | 'html' | 'css' | 'svg' | 'canvas';
  content?: string;
  previewHtml?: string;
  previewCss?: string;
  caption?: string;
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
