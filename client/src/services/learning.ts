import axios from 'axios';
import { API_BASE } from './api';

/**
 * A seleção viaja como JSON, e não como lista separada por vírgula, porque nome
 * de turma pode conter vírgula — a mesma regra do cliente de estatísticas.
 */
const scope = (turmas: string[]) => ({ turmas: JSON.stringify(turmas) });
import type {
  AcademicMatch, AcademicRow, AcademicState, AssociationResult,
  MappingRecord, MasteryResult, OutcomeConfig,
  ActivityScope, BindResult, IndicatorsScope, Intervention, InterventionsState,
  MappingScope, OutcomeScope, PatternsScope, QuestionMapping, SocraticPackage,
  SuggestionResult, Taxonomy, TaxonomyFile
} from '../types/learning';

export const learningApi = {
  listTaxonomies: () => axios.get<TaxonomyFile>(`${API_BASE}/learning/taxonomies`),
  saveTaxonomy: (taxonomy: Partial<Taxonomy>) =>
    axios.post<Taxonomy>(`${API_BASE}/learning/taxonomies`, taxonomy),
  deleteTaxonomy: (id: string) =>
    axios.delete(`${API_BASE}/learning/taxonomies/${encodeURIComponent(id)}`),

  getMapping: (turmas: string[]) =>
    axios.get<MappingScope>(`${API_BASE}/learning/taxonomy`, { params: scope(turmas) }),
  saveMapping: (data: { turma: string; taxonomyId: string | null; mapping: QuestionMapping; reviewed?: boolean }) =>
    axios.post<MappingRecord>(`${API_BASE}/learning/taxonomy`, data),
  bindTaxonomy: (turmas: string[], taxonomyId: string) =>
    axios.post<BindResult>(`${API_BASE}/learning/taxonomy/bind`, { turmas, taxonomyId }),
  suggestMapping: (turma: string, taxonomyId: string) =>
    axios.post<SuggestionResult>(`${API_BASE}/learning/taxonomy/suggest`, { turma, taxonomyId }),

  getMastery: (turmas: string[]) =>
    axios.get<MasteryResult>(`${API_BASE}/learning/mastery`, { params: scope(turmas) }),

  getActivity: (turmas: string[]) =>
    axios.get<ActivityScope>(`${API_BASE}/learning/activity`, { params: scope(turmas) }),
  collectActivity: (data: { turma: string; cookie: string; userAgent?: string; baseUrl?: string; courseId?: number }) =>
    axios.post(`${API_BASE}/learning/activity/collect`, data),

  getIndicators: (turmas: string[]) =>
    axios.get<IndicatorsScope>(`${API_BASE}/learning/indicators`, { params: scope(turmas) }),
  getPatterns: (turmas: string[]) =>
    axios.get<PatternsScope>(`${API_BASE}/learning/patterns`, { params: scope(turmas) }),

  getAcademic: (turma: string) =>
    axios.get<AcademicState>(`${API_BASE}/learning/academic`, { params: { turma } }),
  previewAcademic: (turma: string, rows: AcademicRow[]) =>
    axios.post<AcademicMatch>(`${API_BASE}/learning/academic/preview`, { turma, rows }),
  saveAcademic: (data: { turma: string; rows: AcademicRow[]; columns: Record<string, string>; sourceLabel?: string }) =>
    axios.post(`${API_BASE}/learning/academic`, data),

  getOutcome: (turmas: string[]) =>
    axios.get<OutcomeScope>(`${API_BASE}/learning/outcome`, { params: scope(turmas) }),
  saveOutcome: (turma: string, config: Partial<OutcomeConfig>) =>
    axios.post<OutcomeConfig>(`${API_BASE}/learning/outcome`, { turma, ...config }),

  getAssociation: (turmas: string[], window: 'full' | 'early') =>
    axios.get<AssociationResult>(`${API_BASE}/learning/association`, { params: { ...scope(turmas), window } }),

  getInterventions: (turmas: string[]) =>
    axios.get<InterventionsState>(`${API_BASE}/learning/interventions`, { params: scope(turmas) }),
  addIntervention: (turma: string, entry: Partial<Intervention>) =>
    axios.post<{ entries: Intervention[] }>(`${API_BASE}/learning/interventions`, { turma, ...entry }),
  updateIntervention: (turma: string, id: string, patch: { status?: string; note?: string }) =>
    axios.patch<{ entries: Intervention[] }>(`${API_BASE}/learning/interventions/${id}`, { turma, ...patch }),
  deleteIntervention: (turma: string, id: string) =>
    axios.delete(`${API_BASE}/learning/interventions/${id}`, { params: { turma } }),

  buildSocratic: (data: { turma: string; userId?: number; questionKey?: string; topicCode?: string; lang?: string }) =>
    axios.post<SocraticPackage>(`${API_BASE}/learning/socratic`, data)
};
