import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { statisticsApi } from '../services/statistics';
import type {
  AIReport, StatisticsDatasetSummary, StatisticsMetrics, StatisticsScope
} from '../types/statistics';

const IGNORE_EMPTY_KEY = 'stats.ignoreEmptyStudents';
const SELECTION_KEY = 'stats.selectedTurmas';

const readStoredList = (key: string): string[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Estado da aba de Estatísticas: importações disponíveis, a seleção ativa (uma
 * ou várias turmas ao mesmo tempo), as métricas do recorte e o cache de
 * relatórios de IA já gerados.
 *
 * A seleção e o filtro de alunos sem histórico ficam no `localStorage` porque
 * são preferências de leitura do professor, não dados da importação.
 */
export function useStatistics(t: Record<string, string>) {
  const [datasets, setDatasets] = useState<StatisticsDatasetSummary[]>([]);
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>(() => readStoredList(SELECTION_KEY));
  const [ignoreEmptyStudents, setIgnoreEmptyStudents] = useState<boolean>(
    () => localStorage.getItem(IGNORE_EMPTY_KEY) === '1'
  );
  const [metrics, setMetrics] = useState<StatisticsMetrics | null>(null);
  const [reports, setReports] = useState<Record<string, AIReport>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A seleção vem do localStorage e pode citar uma importação já removida:
  // esperar a lista evita pedir métricas de uma turma inexistente.
  const [datasetsLoaded, setDatasetsLoaded] = useState(false);

  const scope = useMemo<StatisticsScope>(
    () => ({ turmas: selectedTurmas, ignoreEmptyStudents }),
    [selectedTurmas, ignoreEmptyStudents]
  );

  const fetchDatasets = useCallback(async (preferredTurma?: string) => {
    try {
      const response = await statisticsApi.listDatasets();
      const list = response.data || [];
      const available = new Set(list.map(dataset => dataset.turma));
      setDatasets(list);

      setSelectedTurmas(previous => {
        // Uma importação removida sai da seleção; uma importação nova só entra
        // se foi ela que acabou de ser criada.
        const kept = previous.filter(turma => available.has(turma));
        if (preferredTurma && available.has(preferredTurma)) {
          return kept.includes(preferredTurma) ? kept : [...kept, preferredTurma];
        }
        if (kept.length) return kept;
        return list[0] ? [list[0].turma] : [];
      });
      return list;
    } catch (err) {
      console.error('Failed to list statistics datasets', err);
      setDatasets([]);
      return [];
    } finally {
      setDatasetsLoaded(true);
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async (current: StatisticsScope) => {
    if (!current.turmas.length) {
      setMetrics(null);
      setReports({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [metricsResponse, reportsResponse] = await Promise.all([
        statisticsApi.getMetrics(current),
        statisticsApi.getReports(current.turmas)
      ]);
      setMetrics(metricsResponse.data);
      setReports(reportsResponse.data || {});
    } catch (err: any) {
      console.error('Failed to load statistics', err);
      setMetrics(null);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);
  useEffect(() => { if (datasetsLoaded) fetchMetrics(scope); }, [datasetsLoaded, scope, fetchMetrics]);

  useEffect(() => {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedTurmas));
  }, [selectedTurmas]);

  useEffect(() => {
    localStorage.setItem(IGNORE_EMPTY_KEY, ignoreEmptyStudents ? '1' : '0');
  }, [ignoreEmptyStudents]);

  const toggleTurma = useCallback((turma: string) => {
    setSelectedTurmas(previous => (previous.includes(turma)
      ? previous.filter(item => item !== turma)
      : [...previous, turma]));
  }, []);

  const selectOnly = useCallback((turma: string) => setSelectedTurmas([turma]), []);
  const selectAll = useCallback(
    () => setSelectedTurmas(datasets.map(dataset => dataset.turma)),
    [datasets]
  );

  const saveReport = useCallback((report: AIReport) => {
    setReports(previous => ({ ...previous, [report.cacheKey || report.kind]: report }));
  }, []);

  const deleteDataset = useCallback(async (turma: string) => {
    try {
      await statisticsApi.deleteDataset(turma);
      toast.success(t.statsDeleted);
      setSelectedTurmas(previous => previous.filter(item => item !== turma));
      await fetchDatasets();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  }, [fetchDatasets, t]);

  return {
    datasets,
    selectedTurmas,
    setSelectedTurmas,
    toggleTurma,
    selectOnly,
    selectAll,
    ignoreEmptyStudents,
    setIgnoreEmptyStudents,
    scope,
    metrics,
    reports,
    saveReport,
    loading,
    error,
    fetchDatasets,
    refresh: () => fetchMetrics(scope),
    deleteDataset
  };
}
