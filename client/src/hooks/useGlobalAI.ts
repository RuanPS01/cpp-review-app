import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { Student, AnalysisItem } from '../types';
import toast from 'react-hot-toast';

interface TurmaAIState {
  items: AnalysisItem[];
  progress: number;
  isActive: boolean;
  isAnalyzing: boolean;
  hasCanceled: boolean;
  showConfirm: boolean;
}

export const useGlobalAI = (selectedTurma: string, t: any, onComplete: () => Promise<void>) => {
  // Dictionary to store state per turma
  const [states, setStates] = useState<Record<string, TurmaAIState>>({});
  
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);
  const abortControllersRef = useRef<Record<string, AbortController | null>>({});

  // Helper to get current state safely
  const currentState = states[selectedTurma] || {
    items: [],
    progress: 0,
    isActive: false,
    isAnalyzing: false,
    hasCanceled: false,
    showConfirm: true
  };

  const updateTurmaState = useCallback((turma: string, update: Partial<TurmaAIState>) => {
    setStates(prev => ({
      ...prev,
      [turma]: {
        ...(prev[turma] || {
          items: [],
          progress: 0,
          isActive: false,
          isAnalyzing: false,
          hasCanceled: false,
          showConfirm: true
        }),
        ...update
      }
    }));
  }, []);

  // Update progress when items change
  useEffect(() => {
    Object.entries(states).forEach(([turma, state]) => {
      if (state.items.length > 0) {
        const done = state.items.filter(it => it.status === 'success').length;
        const newProgress = Math.round((done / state.items.length) * 100);
        if (newProgress !== state.progress) {
          updateTurmaState(turma, { progress: newProgress });
        }
      }
    });
  }, [states, updateTurmaState]);

  const initAnalysis = useCallback((students: Student[]) => {
    // Retoma a análise se já existir para a turma atual e não foi cancelada
    const existing = states[selectedTurma];
    if (existing && existing.items.length > 0 && !existing.hasCanceled) {
      updateTurmaState(selectedTurma, { isActive: true });
      return;
    }

    const classStudents = students.filter(s => s.turma === selectedTurma);
    const newItems: AnalysisItem[] = [];

    classStudents.forEach(student => {
      Object.entries(student.questions).forEach(([qKey, qData]) => {
        if (qData.path) {
          const isReviewed = qData.reviewed || (student.reviewed && qData.reviewed !== false);
          if (!onlyUnreviewed || !isReviewed) {
            newItems.push({
              studentId: student.folder_name,
              studentName: student.name,
              questionNum: parseInt(qKey.replace('q', '')),
              path: qData.path,
              status: 'pending'
            });
          }
        }
      });
    });

    updateTurmaState(selectedTurma, {
      items: newItems,
      progress: 0,
      isAnalyzing: false,
      showConfirm: true,
      isActive: true,
      hasCanceled: false
    });
  }, [selectedTurma, onlyUnreviewed, states, updateTurmaState]);

  const runSingleAnalysis = async (turma: string, item: AnalysisItem, index: number, signal?: AbortSignal) => {
    setStates(prev => {
        const turmaState = prev[turma];
        if (!turmaState) return prev;
        const newItems = [...turmaState.items];
        newItems[index] = { ...newItems[index], status: 'analyzing', error: undefined };
        return { ...prev, [turma]: { ...turmaState, items: newItems } };
    });

    try {
      const codeRes = await api.getCode(item.path);
      const code = codeRes.data;

      const analysisRes = await api.analyzeCode({
        turma: turma,
        questionNum: item.questionNum,
        code
      }, signal);

      setStates(prev => {
          const turmaState = prev[turma];
          if (!turmaState) return prev;
          const newItems = [...turmaState.items];
          newItems[index] = { ...newItems[index], status: 'success', result: analysisRes.data };
          return { ...prev, [turma]: { ...turmaState, items: newItems } };
      });
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
      console.error(`Error analyzing ${item.studentName} Q${item.questionNum}:`, err);
      setStates(prev => {
          const turmaState = prev[turma];
          if (!turmaState) return prev;
          const newItems = [...turmaState.items];
          newItems[index] = { ...newItems[index], status: 'error', error: err.response?.data?.error || err.message };
          return { ...prev, [turma]: { ...turmaState, items: newItems } };
      });
      return false;
    }
  };

  const startAnalysis = async () => {
    const turma = selectedTurma;
    const turmaState = states[turma];
    if (!turmaState) return;

    updateTurmaState(turma, { showConfirm: false, isAnalyzing: true, hasCanceled: false });
    
    const controller = new AbortController();
    abortControllersRef.current[turma] = controller;
    
    const currentItems = turmaState.items;
    for (let i = 0; i < currentItems.length; i++) {
      if (currentItems[i].status === 'success') {
        continue;
      }
      
      const success = await runSingleAnalysis(turma, currentItems[i], i, controller.signal);
      if (!success && controller.signal.aborted) {
        break;
      }
    }

    updateTurmaState(turma, { isAnalyzing: false });
    if (!controller.signal.aborted) {
      toast.success(`${t.analysisComplete} (${turma})`);
    } else {
      toast.error(`Análise cancelada (${turma})`);
    }
    abortControllersRef.current[turma] = null;
  };

  const cancelAnalysis = useCallback(() => {
    const turma = selectedTurma;
    const controller = abortControllersRef.current[turma];
    if (controller) {
      controller.abort();
    }
    updateTurmaState(turma, { isAnalyzing: false, hasCanceled: true });
  }, [selectedTurma, updateTurmaState]);

  const retryItem = async (studentId: string, questionNum: number) => {
    const turma = selectedTurma;
    const turmaState = states[turma];
    if (!turmaState) return;

    const index = turmaState.items.findIndex(it => it.studentId === studentId && it.questionNum === questionNum);
    if (index === -1) return;

    updateTurmaState(turma, { isAnalyzing: true });
    await runSingleAnalysis(turma, turmaState.items[index], index);
    updateTurmaState(turma, { isAnalyzing: false });
  };

  const retryAllErrors = async () => {
    const turma = selectedTurma;
    const turmaState = states[turma];
    if (!turmaState) return;

    const errorItems = turmaState.items.map((it, idx) => ({ it, idx })).filter(x => x.it.status === 'error');
    if (errorItems.length === 0) return;

    updateTurmaState(turma, { isAnalyzing: true, hasCanceled: false });
    const controller = new AbortController();
    abortControllersRef.current[turma] = controller;
    
    for (const { it, idx } of errorItems) {
      const success = await runSingleAnalysis(turma, it, idx, controller.signal);
      if (!success && controller.signal.aborted) {
        break;
      }
    }
    
    updateTurmaState(turma, { isAnalyzing: false });
    if (!controller.signal.aborted) {
      toast.success(`${t.analysisComplete} (${turma})`);
    } else {
      toast.error(`Retentativa cancelada (${turma})`);
    }
    abortControllersRef.current[turma] = null;
  };

  const resumePendingAnalysis = async () => {
    const turma = selectedTurma;
    const turmaState = states[turma];
    if (!turmaState) return;

    const pendingItems = turmaState.items.map((it, idx) => ({ it, idx })).filter(x => x.it.status === 'pending');
    if (pendingItems.length === 0) return;

    updateTurmaState(turma, { isAnalyzing: true, hasCanceled: false });
    const controller = new AbortController();
    abortControllersRef.current[turma] = controller;
    
    for (const { it, idx } of pendingItems) {
      const success = await runSingleAnalysis(turma, it, idx, controller.signal);
      if (!success && controller.signal.aborted) {
        break;
      }
    }
    
    updateTurmaState(turma, { isAnalyzing: false });
    if (!controller.signal.aborted) {
      toast.success(`${t.analysisComplete} (${turma})`);
    } else {
      toast.error(`Análise cancelada (${turma})`);
    }
    abortControllersRef.current[turma] = null;
  };

  const retryAllRemaining = async () => {
    const turma = selectedTurma;
    const turmaState = states[turma];
    if (!turmaState) return;

    const remainingItems = turmaState.items.map((it, idx) => ({ it, idx })).filter(x => x.it.status === 'pending' || x.it.status === 'error');
    if (remainingItems.length === 0) return;

    updateTurmaState(turma, { isAnalyzing: true, hasCanceled: false });
    const controller = new AbortController();
    abortControllersRef.current[turma] = controller;
    
    for (const { it, idx } of remainingItems) {
      const success = await runSingleAnalysis(turma, it, idx, controller.signal);
      if (!success && controller.signal.aborted) {
        break;
      }
    }
    
    updateTurmaState(turma, { isAnalyzing: false });
    if (!controller.signal.aborted) {
      toast.success(`${t.analysisComplete} (${turma})`);
    } else {
      toast.error(`Análise cancelada (${turma})`);
    }
    abortControllersRef.current[turma] = null;
  };

  const applyAll = async () => {
    const turma = selectedTurma;
    const turmaState = states[turma];
    if (!turmaState) return;

    const successItems = turmaState.items.filter(it => it.status === 'success' && it.result);
    if (successItems.length === 0) return;

    updateTurmaState(turma, { isAnalyzing: true });
    try {
      const promises = successItems.map(item => 
        api.updateGrade({
          turma: turma,
          studentId: item.studentId,
          questionNum: item.questionNum,
          score: item.result!.score,
          comment: item.result!.comment,
          reviewed: true
        })
      );

      await Promise.all(promises);
      toast.success(`${t.allGradesSaved} (${turma})`);
      await onComplete();
      
      setStates(prev => {
          const newState = { ...prev };
          delete newState[turma]; // Reset this turma state after applying
          return newState;
      });
    } catch {
      toast.error('Error applying results');
      updateTurmaState(turma, { isAnalyzing: false });
    }
  };

  return {
    items: currentState.items,
    isAnalyzing: currentState.isAnalyzing,
    progress: currentState.progress,
    onlyUnreviewed,
    setOnlyUnreviewed,
    showConfirm: currentState.showConfirm,
    setShowConfirm: (val: boolean) => updateTurmaState(selectedTurma, { showConfirm: val }),
    isActive: currentState.isActive,
    setIsActive: (val: boolean) => updateTurmaState(selectedTurma, { isActive: val }),
    initAnalysis,
    startAnalysis,
    cancelAnalysis,
    resumePendingAnalysis,
    retryItem,
    retryAllErrors,
    retryAllRemaining,
    applyAll
  };
};
