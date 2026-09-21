import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { learningApi } from '../services/learning';
import type {
  AcademicRow, AcademicState, AssociationResult, OutcomeConfig, OutcomeState
} from '../types/learning';

/**
 * Estado da sub-aba Validação.
 *
 * A janela de observação é estado desta tela e não do servidor: trocar entre
 * "período inteiro" e "início do período" refaz o cálculo, e é a troca que o
 * professor mais usa — a pergunta útil é o que dava para saber cedo.
 */
export function useValidation(turma: string) {
  const [academic, setAcademic] = useState<AcademicState | null>(null);
  const [outcome, setOutcome] = useState<OutcomeState | null>(null);
  const [association, setAssociation] = useState<AssociationResult | null>(null);
  const [window, setWindow] = useState<'full' | 'early'>('full');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextWindow: 'full' | 'early' = window) => {
    if (!turma) return;
    setLoading(true);
    setError(null);
    try {
      const [academicRes, outcomeRes, associationRes] = await Promise.all([
        learningApi.getAcademic(turma),
        learningApi.getOutcome(turma),
        learningApi.getAssociation(turma, nextWindow)
      ]);
      setAcademic(academicRes.data);
      setOutcome(outcomeRes.data);
      setAssociation(associationRes.data);
    } catch (err: any) {
      console.error('Failed to load validation data', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [turma, window]);

  useEffect(() => { load(window); }, [turma, window]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveOutcome = useCallback(async (config: Partial<OutcomeConfig>) => {
    setSaving(true);
    try {
      await learningApi.saveOutcome(turma, config);
      await load(window);
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [turma, window, load]);

  const importAcademic = useCallback(async (
    rows: AcademicRow[],
    columns: Record<string, string>,
    sourceLabel?: string
  ) => {
    try {
      const response = await learningApi.saveAcademic({ turma, rows, columns, sourceLabel });
      await load(window);
      return response.data;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
      return null;
    }
  }, [turma, window, load]);

  return {
    academic, outcome, association, window,
    loading, saving, error,
    setWindow, reload: load, saveOutcome, importAcademic
  };
}
