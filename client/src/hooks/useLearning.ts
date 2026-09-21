import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { learningApi } from '../services/learning';
import type {
  MappingRecord, MasteryResult, QuestionMapping, SuggestionResult, Taxonomy
} from '../types/learning';

/**
 * Estado do submódulo de Aprendizado. Carrega sob demanda: só busca quando o
 * professor abre o grupo Aprendizado, para não pesar a aba de Dados.
 */
export function useLearning(turma: string, enabled: boolean) {
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [mapping, setMapping] = useState<MappingRecord | null>(null);
  const [mastery, setMastery] = useState<MasteryResult | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!turma) return;
    setLoading(true);
    setError(null);
    try {
      const [taxonomiesRes, mappingRes, masteryRes] = await Promise.all([
        learningApi.listTaxonomies(),
        learningApi.getMapping(turma),
        learningApi.getMastery(turma)
      ]);
      setTaxonomies(taxonomiesRes.data?.taxonomies || []);
      setMapping(mappingRes.data);
      setMastery(masteryRes.data);
    } catch (err: any) {
      console.error('Failed to load learning data', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [turma]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // Trocar de turma invalida a sugestão em revisão, que é por turma.
  useEffect(() => { setSuggestion(null); }, [turma]);

  const bindTaxonomy = useCallback(async (taxonomyId: string) => {
    try {
      const response = await learningApi.bindTaxonomy(turma, taxonomyId);
      setMapping(response.data);
      setSuggestion(null);
      const reused = response.data.reusedFrom || [];
      if (reused.length) {
        toast.success(`Mapeamento reaproveitado de: ${reused.join(', ')}`);
      }
      const masteryRes = await learningApi.getMastery(turma);
      setMastery(masteryRes.data);
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  }, [turma]);

  const saveMapping = useCallback(async (next: QuestionMapping, reviewed = false) => {
    if (!mapping?.taxonomyId) return null;
    try {
      const response = await learningApi.saveMapping({
        turma, taxonomyId: mapping.taxonomyId, mapping: next, reviewed
      });
      setMapping(previous => ({ ...(previous as MappingRecord), ...response.data }));
      const masteryRes = await learningApi.getMastery(turma);
      setMastery(masteryRes.data);
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  }, [turma, mapping?.taxonomyId]);

  const requestSuggestion = useCallback(async () => {
    if (!mapping?.taxonomyId) return null;
    setSuggesting(true);
    try {
      const response = await learningApi.suggestMapping(turma, mapping.taxonomyId);
      setSuggestion(response.data);
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    } finally {
      setSuggesting(false);
    }
  }, [turma, mapping?.taxonomyId]);

  const saveTaxonomy = useCallback(async (taxonomy: Partial<Taxonomy>) => {
    try {
      const response = await learningApi.saveTaxonomy(taxonomy);
      const list = await learningApi.listTaxonomies();
      setTaxonomies(list.data?.taxonomies || []);
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  }, []);

  return {
    taxonomies,
    mapping,
    mastery,
    suggestion,
    setSuggestion,
    loading,
    suggesting,
    error,
    reload: load,
    bindTaxonomy,
    saveMapping,
    requestSuggestion,
    saveTaxonomy
  };
}
