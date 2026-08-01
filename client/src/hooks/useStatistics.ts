import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { statisticsApi } from '../services/statistics';
import type { AIReport, StatisticsDatasetSummary, StatisticsMetrics } from '../types/statistics';

/**
 * Estado da aba de Estatísticas: lista de importações, métricas da importação
 * selecionada e o cache de relatórios de IA já gerados.
 */
export function useStatistics(t: Record<string, string>) {
  const [datasets, setDatasets] = useState<StatisticsDatasetSummary[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [metrics, setMetrics] = useState<StatisticsMetrics | null>(null);
  const [reports, setReports] = useState<Record<string, AIReport>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = useCallback(async (preferredTurma?: string) => {
    try {
      const response = await statisticsApi.listDatasets();
      const list = response.data || [];
      setDatasets(list);
      setSelectedTurma(previous => {
        if (preferredTurma && list.some(d => d.turma === preferredTurma)) return preferredTurma;
        if (previous && list.some(d => d.turma === previous)) return previous;
        return list[0]?.turma || '';
      });
      return list;
    } catch (err) {
      console.error('Failed to list statistics datasets', err);
      setDatasets([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async (turma: string) => {
    if (!turma) {
      setMetrics(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [metricsResponse, reportsResponse] = await Promise.all([
        statisticsApi.getMetrics(turma),
        statisticsApi.getReports(turma)
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
  useEffect(() => { fetchMetrics(selectedTurma); }, [selectedTurma, fetchMetrics]);

  const saveReport = useCallback((report: AIReport) => {
    setReports(previous => ({
      ...previous,
      [report.targetId ? `${report.kind}:${report.targetId}` : report.kind]: report
    }));
  }, []);

  const deleteDataset = useCallback(async (turma: string) => {
    try {
      await statisticsApi.deleteDataset(turma);
      toast.success(t.statsDeleted);
      setMetrics(null);
      setReports({});
      setSelectedTurma('');
      await fetchDatasets();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  }, [fetchDatasets, t]);

  return {
    datasets,
    selectedTurma,
    setSelectedTurma,
    metrics,
    reports,
    saveReport,
    loading,
    error,
    fetchDatasets,
    refresh: () => fetchMetrics(selectedTurma),
    deleteDataset
  };
}
