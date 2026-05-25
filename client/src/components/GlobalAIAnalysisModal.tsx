import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle, Play, Save } from 'lucide-react';
import { api } from '../services/api';
import type { Student } from '../types';
import toast from 'react-hot-toast';

interface GlobalAIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  selectedTurma: string;
  onAnalysisComplete: () => Promise<void>;
  t: any;
}

interface AnalysisItem {
  studentId: string;
  studentName: string;
  questionNum: number;
  path: string;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  result?: { score: number; comment: string };
  error?: string;
}

const GlobalAIAnalysisModal: React.FC<GlobalAIAnalysisModalProps> = ({
  isOpen,
  onClose,
  students,
  selectedTurma,
  onAnalysisComplete,
  t
}) => {
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);
  const [showConfirm, setShowConfirm] = useState(true);

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, students, selectedTurma, onlyUnreviewed]);

  const startAnalysis = async () => {
    setShowConfirm(false);
    setIsAnalyzing(true);
    
    let completed = 0;
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      setItems(prev => prev.map((it, idx) => 
        idx === i ? { ...it, status: 'analyzing' } : it
      ));

      try {
        // 1. Get Code
        const codeRes = await api.getCode(item.path);
        const code = codeRes.data;

        // 2. Analyze Code
        const analysisRes = await api.analyzeCode({
          turma: selectedTurma,
          questionNum: item.questionNum,
          code
        });

        setItems(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'success', result: analysisRes.data } : it
        ));
      } catch (err: any) {
        console.error(`Error analyzing ${item.studentName} Q${item.questionNum}:`, err);
        setItems(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'error', error: err.response?.data?.error || err.message } : it
        ));
      }

      completed++;
      setProgress(Math.round((completed / total) * 100));
    }

    setIsAnalyzing(false);
    toast.success(t.analysisComplete);
  };

  const handleApplyAll = async () => {
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
      await onAnalysisComplete();
      onClose();
    } catch (err) {
      toast.error('Error applying results');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-panel-dark border border-border-main rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden shadow-accent/10">
        {/* Header */}
        <div className="p-6 border-b border-border-main flex justify-between items-center bg-button/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-lg text-accent">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase">{t.globalAiModalTitle}</h2>
              <p className="text-xs text-text-dim font-medium">{selectedTurma} • {items.length} {t.studentsCount}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-dim hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {showConfirm ? (
            <div className="max-w-2xl mx-auto space-y-8 py-10">
              <div className="bg-accent/5 border border-accent/20 rounded-2xl p-8 text-center space-y-4">
                <p className="text-lg text-text-main leading-relaxed">
                  {t.globalAiConfirmMsg}
                </p>
                <div className="flex items-center justify-center gap-4 pt-4">
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={onlyUnreviewed}
                          onChange={(e) => setOnlyUnreviewed(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-6 bg-button border border-border-main rounded-full peer-checked:bg-accent transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform"></div>
                      </div>
                      <span className="text-sm font-bold text-text-dim group-hover:text-text-main transition-colors">
                        {t.analyzeOnlyUnreviewed}
                      </span>
                   </label>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={onClose}
                  className="px-8 py-4 rounded-xl border border-border-main text-text-dim font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={startAnalysis}
                  disabled={items.length === 0}
                  className="px-10 py-4 rounded-xl bg-accent text-white font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-accent/20 flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Play size={20} className="fill-current" />
                  {t.startGlobalAnalysis}
                </button>
              </div>
              {items.length === 0 && (
                <p className="text-center text-red-400 font-bold animate-pulse">
                  {t.noUnreviewedSubmissions}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                  <span className={isAnalyzing ? "text-accent animate-pulse" : "text-text-dim"}>
                    {isAnalyzing ? t.statusAnalyzing : t.analysisComplete}
                  </span>
                  <span className="text-accent">{progress}%</span>
                </div>
                <div className="h-3 bg-button rounded-full overflow-hidden border border-border-main">
                  <div 
                    className="h-full bg-accent transition-all duration-500 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-border-main rounded-xl overflow-hidden bg-button/10">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-button/30 text-[10px] font-black uppercase tracking-widest text-text-dim border-b border-border-main">
                    <tr>
                      <th className="py-3 px-4">{t.studentName}</th>
                      <th className="py-3 px-4 text-center">Questão</th>
                      <th className="py-3 px-4">{t.testStatus}</th>
                      <th className="py-3 px-4 text-center">{t.score}</th>
                      <th className="py-3 px-4">Comentário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/50 text-sm">
                    {items.map((item, idx) => (
                      <tr key={`${item.studentId}-${item.questionNum}`} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-bold text-text-main">{item.studentName}</td>
                        <td className="py-3 px-4 text-center font-mono text-accent">Q{item.questionNum}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {item.status === 'pending' && <div className="w-2 h-2 rounded-full bg-text-dim animate-pulse"></div>}
                            {item.status === 'analyzing' && <Loader2 size={16} className="text-accent animate-spin" />}
                            {item.status === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                            {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                              item.status === 'success' ? 'text-green-500' : 
                              item.status === 'error' ? 'text-red-500' : 
                              item.status === 'analyzing' ? 'text-accent' : 'text-text-dim'
                            }`}>
                              {t[`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`]}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-white">
                          {item.result?.score ?? '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-xs truncate text-xs text-text-dim" title={item.result?.comment || item.error}>
                            {item.result?.comment || item.error || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showConfirm && (
          <div className="p-6 border-t border-border-main bg-button/30 flex justify-between items-center">
            <div className="text-xs font-medium text-text-dim">
              {items.filter(it => it.status === 'success').length} de {items.length} com sucesso
            </div>
            <div className="flex gap-4">
              <button
                onClick={onClose}
                disabled={isAnalyzing}
                className="px-6 py-2 rounded-lg border border-border-main text-text-dim font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all disabled:opacity-50"
              >
                {t.cancel}
              </button>
              {!isAnalyzing && progress === 100 && (
                <button
                  onClick={handleApplyAll}
                  className="px-8 py-2 rounded-lg bg-green-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-green-500 active:scale-95 transition-all shadow-lg flex items-center gap-2"
                >
                  <Save size={14} />
                  {t.applyAllResults}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalAIAnalysisModal;
