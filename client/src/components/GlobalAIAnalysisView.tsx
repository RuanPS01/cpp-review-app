import React from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Play, Save, ArrowLeft, RotateCw } from 'lucide-react';
import type { AnalysisItem } from '../types';

interface GlobalAIAnalysisViewProps {
  items: AnalysisItem[];
  isAnalyzing: boolean;
  progress: number;
  onlyUnreviewed: boolean;
  setOnlyUnreviewed: (val: boolean) => void;
  showConfirm: boolean;
  selectedTurma: string;
  onStart: () => void;
  onBack: () => void;
  onRetry: (studentId: string, questionNum: number) => void;
  onRetryAllErrors: () => void;
  onApplyAll: () => void;
  t: any;
}

const GlobalAIAnalysisView: React.FC<GlobalAIAnalysisViewProps> = ({
  items,
  isAnalyzing,
  progress,
  onlyUnreviewed,
  setOnlyUnreviewed,
  showConfirm,
  selectedTurma,
  onStart,
  onBack,
  onRetry,
  onRetryAllErrors,
  onApplyAll,
  t
}) => {
  const successCount = items.filter(it => it.status === 'success').length;
  const errorCount = items.filter(it => it.status === 'error').length;
  const showApply = !isAnalyzing && successCount > 0;

  const actionButtons = (
    <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={isAnalyzing}
          className="px-6 py-2 rounded-lg border border-border-main text-text-dim font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all disabled:opacity-50"
        >
          {t.cancel}
        </button>
        {showApply && (
          <button
            onClick={onApplyAll}
            className="px-8 py-2 rounded-lg bg-green-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-green-500 active:scale-95 transition-all shadow-lg flex items-center gap-2 animate-in zoom-in duration-300"
          >
            <Save size={14} />
            {t.applyAllResults}
          </button>
        )}
      </div>
  );

  return (
    <div className="bg-panel-dark border border-border-main rounded-2xl w-full min-h-[calc(100vh-140px)] flex flex-col shadow-2xl overflow-hidden shadow-accent/10 animate-in fade-in slide-in-from-left-4 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border-main flex justify-between items-center bg-button/30">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-accent flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
              title={t.back}
            >
              <ArrowLeft size={20} />
              {t.back}
            </button>
            <div className="w-px h-8 bg-border-main mx-2"></div>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-lg text-accent">
                <Sparkles size={24} />
                </div>
                <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase">{t.globalAiModalTitle}</h2>
                <p className="text-xs text-text-dim font-medium">{selectedTurma} • {items.length} {t.studentsCount}</p>
                </div>
            </div>
          </div>
          {!showConfirm && actionButtons}
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
                  onClick={onBack}
                  className="px-8 py-4 rounded-xl border border-border-main text-text-dim font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={onStart}
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
              {/* Progress Bar & Retry All */}
              <div className="space-y-4 bg-button/10 p-4 rounded-xl border border-border-main">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest w-64">
                            <span className={isAnalyzing ? "text-accent animate-pulse" : "text-text-dim"}>
                                {isAnalyzing ? t.statusAnalyzing : t.analysisComplete}
                            </span>
                            <span className="text-accent">{progress}%</span>
                        </div>
                        <div className="h-2 w-64 bg-button rounded-full overflow-hidden border border-border-main">
                            <div 
                                className="h-full bg-accent transition-all duration-500 relative"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    {!isAnalyzing && errorCount > 0 && (
                        <button
                            onClick={onRetryAllErrors}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 rounded-lg text-yellow-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                            <RotateCw size={14} />
                            Retentar todos com erro ({errorCount})
                        </button>
                    )}
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
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/50 text-sm">
                    {items.map((item) => (
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
                        <td className="py-3 px-4 text-center">
                            {item.status === 'error' && (
                                <button 
                                    onClick={() => onRetry(item.studentId, item.questionNum)}
                                    disabled={isAnalyzing}
                                    className="p-2 hover:bg-accent/20 rounded-lg text-accent transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                    title="Retentar"
                                >
                                    <RotateCw size={16} />
                                </button>
                            )}
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
              <span className="text-green-500 font-bold">{successCount}</span> de {items.length} com sucesso
              {errorCount > 0 && <span className="text-red-500 ml-2">({errorCount} com erro)</span>}
            </div>
            {actionButtons}
          </div>
        )}
    </div>
  );
};

export default GlobalAIAnalysisView;
