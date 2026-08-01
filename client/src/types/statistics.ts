// Tipos do módulo de Estatísticas. Espelham a saída de
// server/src/features/statistics/statistics.service.js.

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type RiskReasonCode =
  | 'noSubmission'
  | 'missingSubmissions'
  | 'lowGrades'
  | 'lateSubmissions'
  | 'strugglingEffort';

export interface RiskReason {
  code: RiskReasonCode;
  weight: number;
  value?: number;
}

export interface Risk {
  score: number;
  level: RiskLevel;
  reasons: RiskReason[];
}

export interface HistogramBin {
  label: string;
  from: number;
  to: number;
  count: number;
}

export interface CountedLabel {
  label: string;
  count: number;
}

export interface ConceptUsage {
  key: string;
  label: string;
  count: number;
  total: number;
  rate: number;
}

export interface QuestionMetrics {
  key: string;
  cmid: number;
  name: string;
  maxGrade: number;
  startDate: number | null;
  dueDate: number | null;
  testCaseCount: number;
  hasStatement: boolean;
  expected: number;
  submittedCount: number;
  submissionRate: number;
  gradedCount: number;
  avgPercent: number | null;
  medianPercent: number | null;
  stdDevPercent: number | null;
  minPercent: number | null;
  maxPercent: number | null;
  passRate: number;
  zeroCount: number;
  perfectCount: number;
  difficultyIndex: number | null;
  avgAttempts: number | null;
  maxAttempts: number | null;
  avgCodeLines: number | null;
  compileErrorCount: number;
  compileErrorRate: number;
  lateCount: number;
  lateRate: number;
  histogram: HistogramBin[];
  topFailedCases: CountedLabel[];
  topCompileErrors: CountedLabel[];
  conceptUsage: Record<string, { label: string; count: number; total: number }>;
}

export interface StudentQuestionMetrics {
  key: string;
  name: string;
  submitted: boolean;
  submittedAt: number | null;
  attempts: number | null;
  grade: number | null;
  percent: number | null;
  late: boolean;
  hasCompileError: boolean;
  failedCases: string[];
  codeLines: number | null;
  hasCode: boolean;
}

export interface StudentMetrics {
  userId: number | null;
  folderName: string | null;
  name: string;
  email: string | null;
  username: string | null;
  groups: string[];
  lastAccess: number | null;
  lastCourseAccess: number | null;
  submittedCount: number;
  missingCount: number;
  submissionRate: number;
  avgPercent: number | null;
  bestPercent: number | null;
  worstPercent: number | null;
  totalAttempts: number;
  lateCount: number;
  compileErrorCount: number;
  firstSubmissionAt: number | null;
  lastSubmissionAt: number | null;
  totalCodeLines: number;
  risk: Risk;
  questions: StudentQuestionMetrics[];
  concepts: Record<string, boolean>;
  questionCount: number;
}

export interface EngagementMetrics {
  totalSubmissions: number;
  datedSubmissions: number;
  activeStudents: number;
  inactiveStudents: number;
  avgAttemptsPerSubmission: number | null;
  byHour: { hour: number; count: number }[];
  byWeekday: { day: number; count: number }[];
  heatmap: number[][];
  timeline: { date: string; count: number }[];
  leadTimes: { key: string; label: string; count: number }[];
  attemptsBuckets: { key: string; label: string; count: number }[];
  peakHour: number | null;
  lastActivityAt: number | null;
}

export interface OverviewMetrics {
  totalStudents: number;
  totalQuestions: number;
  activeStudents: number;
  inactiveStudents: number;
  expectedSubmissions: number;
  actualSubmissions: number;
  submissionRate: number;
  avgPercent: number | null;
  medianPercent: number | null;
  stdDevPercent: number | null;
  avgStudentPercent: number | null;
  passRate: number;
  zeroCount: number;
  perfectCount: number;
  compileErrorRate: number;
  lateCount: number;
  lateRate: number;
  hardestQuestion: { key: string; name: string; difficultyIndex: number } | null;
  easiestQuestion: { key: string; name: string; difficultyIndex: number } | null;
  riskBuckets: Record<RiskLevel, number>;
  atRiskCount: number;
  histogram: HistogramBin[];
  passThreshold: number;
}

export interface ProfessorComparison {
  matchedStudents: number;
  avgDelta: number | null;
  biggestDivergences: { userId: number | null; name: string; professorAvg: number; automaticAvg: number; delta: number }[];
  rows: { userId: number | null; name: string; professorAvg: number; automaticAvg: number; delta: number }[];
}

export interface StatisticsMetrics {
  turma: string;
  courseName: string;
  sectionName: string;
  importedAt: number;
  sources: Record<string, boolean>;
  warnings: string[];
  overview: OverviewMetrics;
  questions: QuestionMetrics[];
  students: StudentMetrics[];
  engagement: EngagementMetrics;
  alerts: StudentMetrics[];
  conceptCoverage: ConceptUsage[];
  smellCounts: ConceptUsage[];
  professorComparison: ProfessorComparison | null;
}

export interface StatisticsDatasetSummary {
  turma: string;
  courseName: string;
  sectionName: string;
  importedAt: number;
  studentCount: number;
  questionCount: number;
}

export type ReportKind = 'overview' | 'question' | 'student' | 'alerts';

export interface AIReport {
  kind: ReportKind;
  targetId: string | null;
  markdown: string;
  generatedAt: number;
  provider: string;
  model: string;
}

export interface SubmissionCode {
  code: string;
  files: { name: string; size: number }[];
  grade: number | null;
  evaluation: string | null;
  compilation: string | null;
  failedCases: string[];
  codeMetrics: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    commentRatio: number;
    functionCount: number;
    maxNestingDepth: number;
    includes: string[];
    concepts: Record<string, boolean>;
    smells: Record<string, boolean>;
  } | null;
}

export interface ImportProgress {
  turma: string;
  message: string;
  current?: number;
  total?: number;
  error?: boolean;
}
