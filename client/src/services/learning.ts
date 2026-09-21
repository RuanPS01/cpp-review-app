import axios from 'axios';
import { API_BASE } from './api';
import type {
  AcademicMatch, AcademicRow, AcademicState, ActivitySummary, AssociationResult,
  IndicatorsResult, MappingRecord, MasteryResult, OutcomeConfig, OutcomeState,
  Intervention, InterventionsState, PatternsResult, QuestionMapping, SocraticPackage,
  SuggestionResult, Taxonomy, TaxonomyFile
} from '../types/learning';

export const learningApi = {
  listTaxonomies: () => axios.get<TaxonomyFile>(`${API_BASE}/learning/taxonomies`),
  saveTaxonomy: (taxonomy: Partial<Taxonomy>) =>
    axios.post<Taxonomy>(`${API_BASE}/learning/taxonomies`, taxonomy),
  deleteTaxonomy: (id: string) =>
    axios.delete(`${API_BASE}/learning/taxonomies/${encodeURIComponent(id)}`),

  getMapping: (turma: string) =>
    axios.get<MappingRecord>(`${API_BASE}/learning/taxonomy`, { params: { turma } }),
  saveMapping: (data: { turma: string; taxonomyId: string | null; mapping: QuestionMapping; reviewed?: boolean }) =>
    axios.post<MappingRecord>(`${API_BASE}/learning/taxonomy`, data),
  bindTaxonomy: (turma: string, taxonomyId: string) =>
    axios.post<MappingRecord>(`${API_BASE}/learning/taxonomy/bind`, { turma, taxonomyId }),
  suggestMapping: (turma: string, taxonomyId: string) =>
    axios.post<SuggestionResult>(`${API_BASE}/learning/taxonomy/suggest`, { turma, taxonomyId }),

  getMastery: (turma: string) =>
    axios.get<MasteryResult>(`${API_BASE}/learning/mastery`, { params: { turma } }),

  getActivity: (turma: string) =>
    axios.get<ActivitySummary>(`${API_BASE}/learning/activity`, { params: { turma } }),
  collectActivity: (data: { turma: string; cookie: string; userAgent?: string; baseUrl?: string; courseId?: number }) =>
    axios.post(`${API_BASE}/learning/activity/collect`, data),

  getIndicators: (turma: string) =>
    axios.get<IndicatorsResult>(`${API_BASE}/learning/indicators`, { params: { turma } }),
  getPatterns: (turma: string) =>
    axios.get<PatternsResult>(`${API_BASE}/learning/patterns`, { params: { turma } }),

  getAcademic: (turma: string) =>
    axios.get<AcademicState>(`${API_BASE}/learning/academic`, { params: { turma } }),
  previewAcademic: (turma: string, rows: AcademicRow[]) =>
    axios.post<AcademicMatch>(`${API_BASE}/learning/academic/preview`, { turma, rows }),
  saveAcademic: (data: { turma: string; rows: AcademicRow[]; columns: Record<string, string>; sourceLabel?: string }) =>
    axios.post(`${API_BASE}/learning/academic`, data),

  getOutcome: (turma: string) =>
    axios.get<OutcomeState>(`${API_BASE}/learning/outcome`, { params: { turma } }),
  saveOutcome: (turma: string, config: Partial<OutcomeConfig>) =>
    axios.post<OutcomeConfig>(`${API_BASE}/learning/outcome`, { turma, ...config }),

  getAssociation: (turma: string, window: 'full' | 'early') =>
    axios.get<AssociationResult>(`${API_BASE}/learning/association`, { params: { turma, window } }),

  getInterventions: (turma: string) =>
    axios.get<InterventionsState>(`${API_BASE}/learning/interventions`, { params: { turma } }),
  addIntervention: (turma: string, entry: Partial<Intervention>) =>
    axios.post<{ entries: Intervention[] }>(`${API_BASE}/learning/interventions`, { turma, ...entry }),
  updateIntervention: (turma: string, id: string, patch: { status?: string; note?: string }) =>
    axios.patch<{ entries: Intervention[] }>(`${API_BASE}/learning/interventions/${id}`, { turma, ...patch }),
  deleteIntervention: (turma: string, id: string) =>
    axios.delete(`${API_BASE}/learning/interventions/${id}`, { params: { turma } }),

  buildSocratic: (data: { turma: string; userId?: number; questionKey?: string; topicCode?: string; lang?: string }) =>
    axios.post<SocraticPackage>(`${API_BASE}/learning/socratic`, data),

  listExportTurmas: () =>
    axios.get<{ turmas: string[]; schemaVersion: number }>(`${API_BASE}/learning/export/turmas`),
  // Binário: o pacote é um .zip, então sai como blob e vira download no cliente.
  exportPackage: (turmas: string[], pseudonymize: boolean) =>
    axios.post(`${API_BASE}/learning/export`, { turmas, pseudonymize }, { responseType: 'blob' })
};
