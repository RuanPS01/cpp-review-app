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
  /** Chave original dentro da importação (q1, q2...). */
  sourceKey: string;
  /** Importação (turma) de origem. */
  turma: string;
  /** Seção do Moodle de onde a questão veio (null em importações antigas). */
  section: string | null;
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
  sourceKey: string;
  turma: string;
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
  idNumber: string | null;
  groups: string[];
  /** Turmas em que o aluno aparece dentro da seleção atual. */
  turmas: string[];
  enrolled: boolean;
  /** Falso quando o cadastro não tem entrega, nota, tentativa nem código. */
  hasRecords: boolean;
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
  totalTurmas: number;
  activeStudents: number;
  inactiveStudents: number;
  /** Alunos descartados pelo filtro de "sem histórico". */
  excludedStudents: number;
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

export interface ProfessorComparisonRow {
  userId: number | null;
  name: string;
  turma?: string | null;
  professorAvg: number;
  automaticAvg: number;
  delta: number;
}

export interface ProfessorComparison {
  matchedStudents: number;
  avgDelta: number | null;
  biggestDivergences: ProfessorComparisonRow[];
  rows: ProfessorComparisonRow[];
}

/** Visão geral de uma turma calculada isoladamente dentro de uma seleção. */
export interface TurmaBreakdown {
  turma: string;
  importedAt: number | null;
  questionCount: number;
  overview: OverviewMetrics;
}

export interface DatasetInfo {
  turma: string;
  courseName: string | null;
  sectionName: string | null;
  importedAt: number | null;
  studentCount: number;
  questionCount: number;
}

export interface ExcludedStudent {
  name: string;
  email: string | null;
  turmas: string[];
  lastCourseAccess: number | null;
}

export interface StatisticsMetrics {
  /** Rótulo do recorte: o nome da turma, ou os nomes unidos por " + ". */
  turma: string;
  /** Uma entrada por importação selecionada. */
  turmas: string[];
  /** Verdadeiro quando mais de uma importação está sendo vista junto. */
  combined: boolean;
  datasets: DatasetInfo[];
  byTurma: TurmaBreakdown[];
  courseName: string;
  sectionName: string;
  importedAt: number;
  sources: Record<string, boolean>;
  /** Fontes disponíveis em parte das turmas selecionadas. */
  sourcesPartial: Record<string, boolean>;
  ignoreEmptyStudents: boolean;
  excludedStudents: ExcludedStudent[];
  /** Uma entrada por seção importada. */
  sections?: string[];
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
  sections?: string[];
  importedAt: number;
  studentCount: number;
  questionCount: number;
  /** Cadastros sem nenhum histórico de exercícios nesta importação. */
  emptyStudentCount?: number;
}

/** Recorte ativo: quais importações e se os cadastros vazios entram na conta. */
export interface StatisticsScope {
  turmas: string[];
  ignoreEmptyStudents: boolean;
}

export type ReportKind = 'overview' | 'question' | 'student' | 'alerts';

export interface AIReport {
  kind: ReportKind;
  targetId: string | null;
  /** Turmas que compuseram o relatório. */
  turmas?: string[];
  scope?: string;
  cacheKey?: string;
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

// ---------------------------------------------------------------------------
// Exportação em CSV
// ---------------------------------------------------------------------------

export type ExportGroup = 'cross' | 'timeseries' | 'unified';

export interface ExportTableInfo {
  id: string;
  group: ExportGroup;
  groupLabel: string;
  file: string;
  title: string;
  description: string;
  tip: string | null;
  rowCount: number;
  columnCount: number;
}

export interface ExportManifest {
  turmas: string[];
  ignoreEmptyStudents: boolean;
  studentCount: number;
  excludedStudentCount: number;
  questionCount: number;
  /** Envios no eixo temporal — quantas linhas as séries temporais terão. */
  eventCount: number;
  groups: Record<ExportGroup, string>;
  tables: ExportTableInfo[];
}
