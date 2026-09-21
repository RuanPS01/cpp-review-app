import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { learningApi } from '../services/learning';
import type {
  MappingScope, MasteryResult, QuestionMapping, SuggestionResult, Taxonomy
} from '../types/learning';

/**
 * Estado do submódulo de Aprendizado. Carrega sob demanda: só busca quando o
 * professor abre o grupo Aprendizado, para não pesar a aba de Dados.
 */
export function useLearning(turmas: string[], enabled: boolean) {
  // A seleção em si é a dependência: uma lista nova a cada render refaria a
  // busca em laço, então o efeito depende da assinatura estável dela.
  const scopeId = turmas.join('|');
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [mapping, setMapping] = useState<MappingScope | null>(null);
  const [mastery, setMastery] = useState<MasteryResult | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!turmas.length) return;
    setLoading(true);
    setError(null);
    try {
      const [taxonomiesRes, mappingRes, masteryRes] = await Promise.all([
        learningApi.listTaxonomies(),
        learningApi.getMapping(turmas),
        learningApi.getMastery(turmas)
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
  }, [scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // Trocar a seleção invalida a sugestão em revisão, que é por turma.
  useEffect(() => { setSuggestion(null); }, [scopeId]);

  const bindTaxonomy = useCallback(async (taxonomyId: string) => {
    try {
      const response = await learningApi.bindTaxonomy(turmas, taxonomyId);
      setSuggestion(null);
      const reused = [...new Set(response.data.perTurma.flatMap(item => item.reusedFrom || []))];
      if (reused.length) {
        toast.success(`Mapeamento reaproveitado de: ${reused.join(', ')}`);
      }
      await load();
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  }, [scopeId, load]); // eslint-disable-line react-hooks/exhaustive-deps

  /** O mapeamento é de uma turma por vez: questões homônimas de semestres
   *  diferentes podem ter enunciados diferentes. */
  const saveMapping = useCallback(async (turma: string, next: QuestionMapping, reviewed = false) => {
    const entry = mapping?.perTurma.find(item => item.turma === turma);
    if (!entry?.taxonomyId) return null;
    try {
      const response = await learningApi.saveMapping({
        turma, taxonomyId: entry.taxonomyId, mapping: next, reviewed
      });
      await load();
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  }, [mapping, load]);

  const requestSuggestion = useCallback(async (turma: string) => {
    const entry = mapping?.perTurma.find(item => item.turma === turma);
    if (!entry?.taxonomyId) return null;
    setSuggesting(true);
    try {
      const response = await learningApi.suggestMapping(turma, entry.taxonomyId);
      setSuggestion(response.data);
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    } finally {
      setSuggesting(false);
    }
  }, [mapping]);

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
