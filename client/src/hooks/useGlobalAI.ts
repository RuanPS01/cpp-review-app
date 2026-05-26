import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import type { Student, AnalysisItem } from '../types';
import toast from 'react-hot-toast';

export const useGlobalAI = (selectedTurma: string, t: any, onComplete: () => Promise<void>) => {
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);
  const [showConfirm, setShowConfirm] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      const done = items.filter(it => it.status === 'success' || it.status === 'error').length;
      setProgress(Math.round((done / items.length) * 100));
    }
  }, [items]);

  const initAnalysis = useCallback((students: Student[]) => {
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

    setItems(newItems);
    setProgress(0);
    setIsAnalyzing(false);
    setShowConfirm(true);
    setIsActive(true);
  }, [selectedTurma, onlyUnreviewed]);

  const runSingleAnalysis = async (item: AnalysisItem, index: number) => {
    setItems(prev => prev.map((it, idx) => 
      idx === index ? { ...it, status: 'analyzing', error: undefined } : it
    ));

    try {
      const codeRes = await api.getCode(item.path);
      const code = codeRes.data;

      const analysisRes = await api.analyzeCode({
        turma: selectedTurma,
        questionNum: item.questionNum,
        code
      });

      setItems(prev => prev.map((it, idx) => 
        idx === index ? { ...it, status: 'success', result: analysisRes.data } : it
      ));
      return true;
    } catch (err: any) {
      console.error(`Error analyzing ${item.studentName} Q${item.questionNum}:`, err);
      setItems(prev => prev.map((it, idx) => 
        idx === index ? { ...it, status: 'error', error: err.response?.data?.error || err.message } : it
      ));
      return false;
    }
  };

  const startAnalysis = async () => {
    setShowConfirm(false);
    setIsAnalyzing(true);
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'success') {
        continue;
      }
      
      await runSingleAnalysis(items[i], i);
    }

    setIsAnalyzing(false);
    toast.success(t.analysisComplete);
  };

  const retryItem = async (studentId: string, questionNum: number) => {
    const index = items.findIndex(it => it.studentId === studentId && it.questionNum === questionNum);
    if (index === -1) return;

    setIsAnalyzing(true);
    await runSingleAnalysis(items[index], index);
    setIsAnalyzing(false);
  };

  const retryAllErrors = async () => {
    const errorItems = items.map((it, idx) => ({ it, idx })).filter(x => x.it.status === 'error');
    if (errorItems.length === 0) return;

    setIsAnalyzing(true);
    for (const { it, idx } of errorItems) {
      await runSingleAnalysis(it, idx);
    }
    setIsAnalyzing(false);
    toast.success(t.analysisComplete);
  };

  const applyAll = async () => {
    const successItems = items.filter(it => it.status === 'success' && it.result);
    if (successItems.length === 0) return;

    setIsAnalyzing(true);
    try {
      const promises = successItems.map(item => 
        api.updateGrade({
          turma: selectedTurma,
          studentId: item.studentId,
          questionNum: item.questionNum,
          score: item.result!.score,
          comment: item.result!.comment,
          reviewed: true
        })
      );

      await Promise.all(promises);
      toast.success(t.allGradesSaved);
      await onComplete();
      setIsActive(false);
    } catch {
      toast.error('Error applying results');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    items,
    isAnalyzing,
    progress,
    onlyUnreviewed,
    setOnlyUnreviewed,
    showConfirm,
    setShowConfirm,
    isActive,
    setIsActive,
    initAnalysis,
    startAnalysis,
    retryItem,
    retryAllErrors,
    applyAll
  };
};
