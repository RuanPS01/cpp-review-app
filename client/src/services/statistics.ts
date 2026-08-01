import axios from 'axios';
import { API_BASE } from './api';
import type {
  AIReport,
  ReportKind,
  StatisticsDatasetSummary,
  StatisticsMetrics,
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

export const statisticsApi = {
  importMoodle: (payload: StatisticsImportPayload) =>
    axios.post<{ success: boolean; turma: string; warnings: string[]; summary: Record<string, number> }>(
      `${API_BASE}/statistics/import-moodle`,
      payload
    ),
  listDatasets: () => axios.get<StatisticsDatasetSummary[]>(`${API_BASE}/statistics/datasets`),
  getMetrics: (turma: string) =>
    axios.get<StatisticsMetrics>(`${API_BASE}/statistics/dataset`, { params: { turma } }),
  getSubmissionCode: (turma: string, userId: string | number, question: string) =>
    axios.get<SubmissionCode>(`${API_BASE}/statistics/submission-code`, { params: { turma, userId, question } }),
  deleteDataset: (turma: string) => axios.delete(`${API_BASE}/statistics/dataset/${encodeURIComponent(turma)}`),
  getReports: (turma: string) =>
    axios.get<Record<string, AIReport>>(`${API_BASE}/statistics/ai-reports`, { params: { turma } }),
  generateReport: (data: { turma: string; kind: ReportKind; targetId?: string | null; lang: string }) =>
    axios.post<AIReport>(`${API_BASE}/statistics/ai-report`, data)
};
