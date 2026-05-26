export interface Question {
  score: number;
  comment: string;
  path: string | null;
  label?: string;
  reviewed?: boolean;
}

export interface Student {
  id: string;
  folder_name: string;
  name: string;
  email?: string;
  turma: string;
  questions: {
    [key: string]: Question;
  };
  reviewed: boolean;
}

export interface AISettings {
  provider: 'ollama' | 'openai' | 'gemini' | 'claude';
  ollamaModel: string;
  cloudModel: string;
  cloudKey: string;
  evaluationCriteria: string;
}

export type View = 'review' | 'table' | 'import' | 'settings';

export interface AIResult {
  score: number;
  comment: string;
}

export interface PendingChanges {
  [folder_name: string]: {
    [qKey: string]: {
      score: number;
      comment: string;
    };
  };
}

export interface AnalysisItem {
  studentId: string;
  studentName: string;
  questionNum: number;
  path: string;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  result?: { score: number; comment: string };
  error?: string;
}
