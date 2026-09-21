import axios from 'axios';
import { API_BASE } from './api';
import type {
  AIReport,
  ExportManifest,
  ReportKind,
  StatisticsDatasetSummary,
  StatisticsMetrics,
  StatisticsScope,
  SubmissionCode
} from '../types/statistics';

export interface StatisticsImportQuestion {
  cmid: number;
  instanceId?: number | null;
  name: string;
  sectionName?: string;
  statement?: string | null;
  testCases?: unknown[];
  startDate?: number | null;
  dueDate?: number | null;
  maxGrade?: number | null;
}

export interface StatisticsImportPayload {
  courseId: number;
  courseName: string;
  /** Rótulo legível das seções escolhidas (mantido por compatibilidade). */
  sectionName: string;
  /** Nome final da turma, editável pelo professor no assistente. */
  turmaName: string;
  baseUrl: string;
  cookie: string;
  userAgent: string;
  folderTemplate: string;
  sections: { name: string; questions: StatisticsImportQuestion[] }[];
  enrolledStudents: Record<string, unknown>[];
  vplResults: Record<string, Record<string, { grade?: string; evaluation?: string; compilation?: string }>>;
  gradebook: Record<string, Record<string, { grade: number | null; gradeMax: number | null }>>;
  deepHistory: boolean;
  sources: Record<string, boolean>;
}

/**
 * Nome de turma pode conter vírgula, então a seleção viaja como JSON em vez de
 * lista separada por vírgula. O servidor aceita as duas formas.
 */
const scopeParams = (scope: StatisticsScope) => ({
  turmas: JSON.stringify(scope.turmas),
  ignoreEmpty: scope.ignoreEmptyStudents ? '1' : '0'
});

/**
 * Chave do relatório de IA em cache. O escopo faz parte da chave: um
 * diagnóstico de duas turmas juntas não é o diagnóstico de cada uma. A regra é
 * a mesma no servidor (`statistics.controller.js`).
 */
export const reportScopeId = (turmas: string[]) => [...turmas].sort().join(' + ');

/** Recorte que gerou as métricas em tela — a referência para novas chamadas. */
export const scopeOf = (metrics: { turmas: string[]; ignoreEmptyStudents: boolean }): StatisticsScope => ({
  turmas: metrics.turmas,
  ignoreEmptyStudents: metrics.ignoreEmptyStudents
});

export const reportKey = (turmas: string[], kind: ReportKind, targetId?: string | null) =>
  `${reportScopeId(turmas)}##${kind}${targetId ? `:${targetId}` : ''}`;

/** Dispara o download de um blob recebido do servidor. */
export function downloadBlob(data: Blob, fileName: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // O revoke imediato cancelaria o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Nome de arquivo sugerido pelo servidor, com um palpite razoável de reserva. */
export function fileNameFromResponse(headers: unknown, fallback: string) {
  const disposition = (headers as Record<string, string> | undefined)?.['content-disposition'];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export const statisticsApi = {
  importMoodle: (payload: StatisticsImportPayload) =>
    axios.post<{ success: boolean; turma: string; warnings: string[]; summary: Record<string, number> }>(
      `${API_BASE}/statistics/import-moodle`,
      payload
    ),
  listDatasets: () => axios.get<StatisticsDatasetSummary[]>(`${API_BASE}/statistics/datasets`),
  getMetrics: (scope: StatisticsScope) =>
    axios.get<StatisticsMetrics>(`${API_BASE}/statistics/dataset`, { params: scopeParams(scope) }),
  getSubmissionCode: (scope: StatisticsScope, userId: string | number, question: string) =>
    axios.get<SubmissionCode>(`${API_BASE}/statistics/submission-code`, {
      params: { ...scopeParams(scope), userId, question }
    }),
  deleteDataset: (turma: string) => axios.delete(`${API_BASE}/statistics/dataset/${encodeURIComponent(turma)}`),
  getReports: (turmas: string[]) =>
    axios.get<Record<string, AIReport>>(`${API_BASE}/statistics/ai-reports`, {
      params: { turmas: JSON.stringify(turmas) }
    }),
  generateReport: (data: {
    scope: StatisticsScope;
    kind: ReportKind;
    targetId?: string | null;
    lang: string;
  }) =>
    axios.post<AIReport>(`${API_BASE}/statistics/ai-report`, {
      turmas: data.scope.turmas,
      ignoreEmpty: data.scope.ignoreEmptyStudents,
      kind: data.kind,
      targetId: data.targetId ?? null,
      lang: data.lang
    }),

  /** Catálogo das tabelas exportáveis, já com a contagem de linhas do recorte. */
  getExportManifest: (scope: StatisticsScope) =>
    axios.get<ExportManifest>(`${API_BASE}/statistics/export/manifest`, { params: scopeParams(scope) }),

  /** Um CSV único de uma tabela. */
  exportCsv: (scope: StatisticsScope, table: string) =>
    axios.get(`${API_BASE}/statistics/export`, {
      params: { ...scopeParams(scope), tables: table, bundle: 'csv' },
      responseType: 'blob'
    }),

  /** ZIP com as tabelas escolhidas e, opcionalmente, os markdowns de apoio. */
  exportZip: (scope: StatisticsScope, tables: string[], includeDocs = true) =>
    axios.get(`${API_BASE}/statistics/export`, {
      params: {
        ...scopeParams(scope),
        tables: tables.join(','),
        bundle: 'zip',
        docs: includeDocs ? '1' : '0'
      },
      responseType: 'blob'
    })
};
