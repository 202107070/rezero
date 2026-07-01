declare const problems: Array<{
  id: string;
  type: string;
  difficulty: string;
  title: string;
  question: string;
  answer: Record<string, string[]>;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  visual?: {
    kind: 'ascii' | 'html' | 'css' | 'svg' | 'canvas' | 'image';
    content?: string;
    previewHtml?: string;
    previewCss?: string;
    caption?: string;
    imageFile?: string;
  } | null;
}>;

export default problems;
