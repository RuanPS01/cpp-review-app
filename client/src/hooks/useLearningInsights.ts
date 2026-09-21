import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { learningApi } from '../services/learning';
import { API_BASE } from '../services/api';
import type { ActivitySummary, IndicatorsResult, PatternsResult } from '../types/learning';

const SOCKET_URL = API_BASE.replace(/\/api$/, '');

/**
 * Estado das sub-abas Indicadores e Padrões.
 *
 * As três chamadas andam juntas porque a tela mostra as três coisas ao mesmo
 * tempo: o que foi coletado, o que se mediu e o que isso configura. A coleta de
 * logs é uma ação avulsa — funciona em turmas já importadas — e depois dela os
 * indicadores mudam, então recarregamos tudo.
 */
export function useLearningInsights(turma: string) {
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [indicators, setIndicators] = useState<IndicatorsResult | null>(null);
  const [patterns, setPatterns] = useState<PatternsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    if (!turma) return;
    setLoading(true);
    setError(null);
    try {
      const [activityRes, indicatorsRes, patternsRes] = await Promise.all([
        learningApi.getActivity(turma),
        learningApi.getIndicators(turma),
        learningApi.getPatterns(turma)
      ]);
      setActivity(activityRes.data);
      setIndicators(indicatorsRes.data);
      setPatterns(patternsRes.data);
    } catch (err: any) {
      console.error('Failed to load learning insights', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [turma]);

  useEffect(() => { load(); }, [load]);

  // O servidor transmite o andamento da coleta, que baixa relatórios grandes
  // fora do alcance do renderer.
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('learning-activity-progress', (payload: { turma: string; message: string }) => {
      if (payload.turma === turma) setProgress(payload.message);
    });
    return () => { socket.disconnect(); };
  }, [turma]);

  const collectLogs = useCallback(async (messages: { noOrigin: string; noSession: string }) => {
    const baseUrl = activity?.baseUrl || localStorage.getItem('moodle_url');
    if (!baseUrl) {
      toast.error(messages.noOrigin);
      return null;
    }

    setCollecting(true);
    setProgress('');
    try {
      // Sem credenciais: a janela do Moodle abre e o professor entra ali (ou a
      // sessão dele ainda está viva). Nada de pedir a senha de novo.
      // @ts-expect-error exposto pelo preload do Electron
      const captured = await window.moodleAuth?.captureCookie(baseUrl);
      if (!captured?.cookie) throw new Error(messages.noSession);

      const response = await learningApi.collectActivity({
        turma,
        cookie: captured.cookie,
        userAgent: captured.userAgent || '',
        baseUrl,
        courseId: activity?.courseId ?? undefined
      });
      (response.data.warnings || []).forEach((warning: string) => toast(warning, { icon: '⚠️' }));
      await load();
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    } finally {
      setCollecting(false);
      setProgress('');
    }
  }, [turma, activity?.baseUrl, activity?.courseId, load]);

  return { activity, indicators, patterns, loading, collecting, progress, error, reload: load, collectLogs };
}
