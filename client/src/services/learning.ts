import axios from 'axios';
import { API_BASE } from './api';
import type {
  ActivitySummary, IndicatorsResult, MappingRecord, MasteryResult, PatternsResult,
  QuestionMapping, SuggestionResult, Taxonomy, TaxonomyFile
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
    axios.get<PatternsResult>(`${API_BASE}/learning/patterns`, { params: { turma } })
};
