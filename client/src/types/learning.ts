// Tipos do submódulo de Análises de Aprendizado.
//
// Nota de nomenclatura: `concept` já designa, no módulo de Estatísticas, os
// sinais estáticos do parser de C++ (`codeMetrics.concepts`). O conceito
// curricular chama-se `topic` no código — na interface, os dois aparecem como
// "conceito" e "construção", respectivamente.

export type TopicStatus = 'mastered' | 'partial' | 'gap' | 'insufficient';

export type TopicWeight = 1 | 0.5;

export interface Topic {
  code: string;
  name: string;
  description?: string;
  /** Chaves de `codeMetrics.concepts` que evidenciam o conceito no código. */
  codeSignals: string[];
}

export interface Taxonomy {
  id: string;
  name: string;
  topics: Topic[];
  updatedAt: number;
}

export interface TaxonomyFile {
  version: number;
  taxonomies: Taxonomy[];
}

export interface MappingEntry {
  code: string;
  weight: TopicWeight;
  /** Presente apenas nas sugestões ainda não revisadas. */
  rationale?: string;
}

export type QuestionMapping = Record<string, MappingEntry[]>;

export interface MappingRecord {
  version: number;
  taxonomyId: string | null;
  mapping: QuestionMapping;
  suggestedAt: number | null;
  reviewedAt: number | null;
  updatedAt: number | null;
  /** Turmas de onde o mapeamento foi herdado por `cmid`. */
  reusedFrom?: string[];
  questions?: { key: string; name: string; section: string | null; cmid: number }[];
}

export interface SuggestionResult {
  mapping: QuestionMapping;
  newTopics: { code: string; name: string; rationale: string }[];
  unmapped: string[];
  provider: string;
  model: string;
  generatedAt: number;
}

export interface TopicEvidence {
  questionKey: string;
  questionName: string;
  weight: number;
  submitted: boolean;
  percent: number | null;
}

export interface StudentTopicResult {
  /** `null` quando o status é `insufficient`. */
  mastery: number | null;
  status: TopicStatus;
  itemCount: number;
  mappedCount: number;
  spread: number | null;
  /** `null` quando o conceito não tem sinal estático confiável. */
  codeSignalSeen: boolean | null;
  /** Nota baixa e a construção sequer aparece no código. */
  untried: boolean;
  evidence: TopicEvidence[];
}

export interface StudentMastery {
  userId: number | null;
  folderName: string | null;
  name: string;
  email: string | null;
  topics: Record<string, StudentTopicResult>;
}

export interface TopicMastery {
  code: string;
  name: string;
  description: string;
  codeSignals: string[];
  questionKeys: string[];
  questionCount: number;
  studentsWithEvidence: number;
  totalStudents: number;
  avgMastery: number | null;
  medianMastery: number | null;
  distribution: Record<TopicStatus, number>;
  untriedCount: number;
  untriedRate: number;
}

export interface MasteryResult {
  bound: boolean;
  turmas?: string[];
  combined?: boolean;
  /** Turmas vinculadas a taxonomias diferentes: o domínio não é comparável. */
  conflict?: { turma: string; taxonomyId: string }[];
  /** Turmas da seleção que ainda não vincularam taxonomia nenhuma. */
  unboundTurmas?: string[];
  taxonomyId: string | null;
  taxonomyName?: string | null;
  error?: string;
  thresholds?: { mastered: number; partial: number; minItems: number };
  topics: TopicMastery[];
  students: StudentMastery[];
  coverage: {
    mappedQuestions: number;
    totalQuestions: number;
    unmappedQuestions: { key: string; name: string }[];
  } | null;
}

// ---------------------------------------------------------------------------
// Fase 2 — indicadores e padrões
// ---------------------------------------------------------------------------

/**
 * Toda medida do submódulo carrega o `n` e, quando falta, o motivo. Ausência
 * de medida nunca é zero: `value: null` com `reason` preenchido.
 */
export interface Indicator {
  value: number | null;
  n: number;
  available: boolean;
  reason: string | null;
}

export type DimensionKey = 'engagement' | 'regularity' | 'persistence' | 'learning' | 'selfRegulation';

export interface DimensionScore {
  value: number | null;
  n: number;
  available: boolean;
}

export interface Trajectory {
  key: string;
  name: string;
  attempts: number;
  first: number;
  last: number;
  best: number;
  gain: number;
  passed: boolean;
  attemptsToPass: number | null;
  stalled: boolean;
  percents: number[];
}

export interface StudentIndicators {
  userId: number | null;
  folderName: string | null;
  name: string;
  email: string | null;
  dimensions: Record<DimensionKey, Record<string, Indicator>>;
  scores: Record<DimensionKey, DimensionScore>;
  trajectories: Trajectory[];
}

export interface IndicatorsResult {
  dimensions: DimensionKey[];
  thresholds: { pass: number };
  sources: { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean };
  period: { start: number; end: number } | null;
  students: StudentIndicators[];
}

export type PatternCode =
  | 'lowEngagementEarly'
  | 'irregularPlusConceptGap'
  | 'procrastination'
  | 'bruteForce'
  | 'recurringConceptError'
  | 'productivePersistence'
  | 'earlyAbandonment';

export interface PatternMatch {
  userId: number | null;
  name: string;
  evidence: Record<string, any>;
}

export interface PatternResult {
  code: PatternCode;
  /** Padrão que reconhece um comportamento desejável, e não um risco. */
  positive: boolean;
  students: PatternMatch[];
  count: number;
  rate: number;
}

export interface PatternsResult {
  patterns: PatternResult[];
  thresholds: {
    gainThreshold: number | null;
    minAttemptsForTrend: number;
    procrastinationHours: number;
    silenceCutDays: number | null;
    passThreshold: number;
    earlyWeeks: number;
  };
  availability: { history: boolean; taxonomy: boolean; logs: boolean; period: boolean };
  totalStudents: number;
}

export interface ActivitySummary {
  collected: boolean;
  baseUrl: string | null;
  courseId: number | null;
  collectedAt?: number;
  sources?: { logs: boolean; participation: boolean };
  logRows?: number;
  warnings?: string[];
  studentsWithActivity?: number;
}

// ---------------------------------------------------------------------------
// Fase 3 — desfecho, planilha do portal e associação
// ---------------------------------------------------------------------------

export type OutcomeKind = 'finalGrade' | 'failed' | 'dropout';
export type OutcomeSource = 'academic' | 'professorGrades' | 'manual';
/** Quanto a fonte do desfecho é independente das notas que geram os indicadores. */
export type Independence = 'high' | 'partial' | 'low';

export interface OutcomeConfig {
  version: number;
  kind: OutcomeKind;
  source: OutcomeSource;
  cut: number;
  /** Peso das atividades VPL na nota final, em %, quando o professor souber. */
  vplWeight: number | null;
  periodoLetivo: string | null;
  manual: Record<string, boolean>;
  updatedAt: number | null;
}

export interface OutcomeState {
  config: OutcomeConfig;
  defined: number;
  total: number;
  available: boolean;
  independence: Independence;
  warnings: string[];
  hasAcademic: boolean;
  students: { userId: number | null; name: string; value: number | null; marked: boolean }[];
}

export interface AcademicMatch {
  rows: number;
  matched: number;
  totalStudents: number;
  matchRate: number;
  lowMatch: boolean;
  byIdNumber: number;
  byEmail: number;
  byName: number;
  unmatched: { idNumber: string | null; name: string | null }[];
  withoutRow: { userId: number | null; name: string }[];
}

export interface AcademicState {
  imported: boolean;
  importedAt?: number;
  sourceLabel?: string | null;
  columns?: Record<string, string>;
  match?: AcademicMatch;
}

/** Linha já mapeada pelo cliente, pronta para o servidor casar. */
export interface AcademicRow {
  idNumber?: string | null;
  name?: string | null;
  email?: string | null;
  finalGrade?: string | number | null;
  gradeMax?: string | number | null;
  absences?: string | number | null;
  attendanceRate?: string | number | null;
  status?: string | null;
}

export type AssociationStatus =
  | 'ok' | 'constant' | 'insufficientVariation' | 'insufficientPairs'
  | 'insufficientGroup' | 'lowCoverage' | 'indicatorUnavailable'
  | 'unstable' | 'undefined' | 'tautology';

export type IndicatorFamily = 'independent' | 'partial' | 'shared';

export interface AssociationRow {
  key: string;
  dimension: DimensionKey;
  family: IndicatorFamily;
  status: AssociationStatus;
  measure: 'spearman' | 'cliffsDelta';
  value: number | null;
  auc: number | null;
  ci: [number, number] | null;
  width: number | null;
  n: number;
  coverage: number;
  partialCoverage: boolean;
  smallSample: boolean;
  distinct: number;
  maxTieShare: number;
  onlyValue: number | null;
  direction: 'positive' | 'negative' | null;
  droppedIndicator: number;
  droppedOutcome: number;
  /** Quantos pares cada turma contribuiu — um coeficiente sustentado por uma
   *  turma só não é um achado da disciplina. */
  byTurma: Record<string, number>;
  groups?: { positive: number; negative: number } | null;
  resamples: number;
  /** Pares observados, só quando o cálculo saiu; alimenta a dispersão. */
  points: { x: number; y: number; label: string }[];
}

export interface AssociationResult {
  available: boolean;
  window: 'full' | 'early';
  cutoff: number | null;
  measure: 'spearman' | 'cliffsDelta';
  outcome: {
    kind: OutcomeKind;
    source: OutcomeSource;
    cut: number;
    vplWeight: number | null;
    independence: Independence;
    defined: number;
    total: number;
    binary: boolean;
  };
  studentsWithOutcome: number;
  blocks: { family: IndicatorFamily; indicators: AssociationRow[] }[];
  thresholds: { minPairs: number; smallSample: number; minCoverage: number; partialCoverage: number };
  sources: { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean };
  sourcesPartial?: { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean };
  turmas: string[];
  mismatch?: { turma: string; kind: OutcomeKind; source: OutcomeSource }[] | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Fase 4 — intervenção e base consolidada
// ---------------------------------------------------------------------------

export type InterventionAction =
  | 'socraticPackage' | 'individualContact' | 'studyPlan' | 'reviewSession' | 'other';
export type InterventionStatus = 'planned' | 'done' | 'abandoned';

export interface Intervention {
  id: string;
  /** A turma em que o registro vive — o retrato de baseline é da importação dela. */
  turma?: string;
  userId: number;
  name: string | null;
  createdAt: number;
  updatedAt?: number;
  pattern: string | null;
  topic: string | null;
  action: InterventionAction;
  note: string;
  status: InterventionStatus;
  snapshotId: string;
  baseline: {
    importedAt: number;
    avgPercent: number | null;
    indicators: Record<string, number | null>;
    topics: Record<string, number>;
  };
}

export interface FollowupGroup {
  snapshotId: string;
  snapshotAt: number;
  /** Mesma importação do retrato: ainda não há um "depois" para observar. */
  stale: boolean;
  bands: string[];
  treated: { n: number; meanBefore: number | null; meanAfter: number | null; meanDelta: number | null };
  comparison: { n: number; meanBefore: number | null; meanAfter: number | null; meanDelta: number | null };
}

export interface Followup {
  available: boolean;
  reason: string | null;
  groups: FollowupGroup[];
  entries: (Intervention & {
    movement: { before: number; after: number; delta: number } | null;
    stale: boolean;
  })[];
}

export interface InterventionsState {
  turmas: string[];
  combined: boolean;
  /** O registro é por turma: o retrato de baseline aponta para a importação dela. */
  perTurma: {
    turma: string;
    importedAt: number;
    entries: Intervention[];
    followup: Followup;
  }[];
  entries: Intervention[];
  actions: InterventionAction[];
  statuses: InterventionStatus[];
}

export interface SocraticPackage {
  scope: 'student' | 'topic';
  student: { userId: number; name: string } | null;
  topic: { code: string; name: string } | null;
  question: { key: string; name: string } | null;
  /** Texto fixo: não passa pelo modelo. */
  rules: string[];
  generated: {
    diagnostico: string;
    perguntas: { pergunta: string; objetivo: string; seNaoSouber: string }[];
    andaime: string;
    sinalDeAvanco: string;
  };
  provider: string;
  model: string;
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Escopo — a seleção pode ter várias turmas
// ---------------------------------------------------------------------------

/**
 * O que depende do período letivo vem **por turma**: engajamento e regularidade
 * dividem por semanas, e somar semestres faria um aluno de um semestre só
 * parecer meses em silêncio. Domínio conceitual, que não divide por tempo, vem
 * combinado.
 */
export interface IndicatorsScope {
  turmas: string[];
  combined: boolean;
  sources: { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean };
  sourcesPartial: { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean };
  byTurma: (IndicatorsResult & { turma: string })[];
}

export interface PatternsScope {
  turmas: string[];
  combined: boolean;
  byTurma: (PatternsResult & { turma: string })[];
}

export interface MappingScope {
  turmas: string[];
  combined: boolean;
  perTurma: {
    turma: string;
    taxonomyId: string | null;
    mapping: QuestionMapping;
    questions: { key: string; name: string; section: string | null; cmid: number }[];
  }[];
}

export interface BindResult {
  turmas: string[];
  perTurma: (MappingRecord & { turma: string; reusedFrom: string[] })[];
}

export interface ActivityScope {
  turmas: string[];
  perTurma: (ActivitySummary & { turma: string })[];
}

export interface TurmaActivity extends ActivitySummary {
  turma: string;
}

export interface OutcomeScope {
  turmas: string[];
  combined: boolean;
  available: boolean;
  /** Turmas medindo desfechos diferentes: empilhar não faria sentido. */
  mismatch: { turma: string; kind: OutcomeKind; source: OutcomeSource }[] | null;
  kind: OutcomeKind | null;
  source: OutcomeSource | null;
  independence: Independence | null;
  defined: number;
  total: number;
  warnings: string[];
  perTurma: {
    turma: string;
    config: OutcomeConfig;
    defined: number;
    total: number;
    available: boolean;
    independence: Independence;
    hasAcademic: boolean;
    warnings: string[];
  }[];
}
