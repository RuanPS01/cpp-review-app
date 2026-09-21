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
