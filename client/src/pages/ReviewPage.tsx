import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, ChevronRight, Copy, Save, 
  Sparkles, BookOpen, X, Play, Eye, Info, Trash2
} from 'lucide-react';
import { marked } from 'marked';
import Editor from '@monaco-editor/react';
import type { Student, PendingChanges, AISettings, AIResult } from '../types';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { useReviewLogic } from '../hooks/useReviewLogic';

interface ReviewPageProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQ: number;
  setCurrentQ: React.Dispatch<React.SetStateAction<number>>;
  selectedTurma: string;
  pendingChanges: PendingChanges;
  setPendingChanges: React.Dispatch<React.SetStateAction<PendingChanges>>;
  aiSettings: AISettings;
  statements: Record<string, string>;
  setShowStatementModal: (show: boolean) => void;
  setShowAIPreviewModal: (show: boolean) => void;
  setAiResult: (result: AIResult | null) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setShowTerminal: (show: boolean) => void;
  setCodeOverride: (code: string | undefined) => void;
  calculateTotal: (student: Student) => string;
  theme: 'light' | 'dark';
  t: any;
}

const ReviewPage: React.FC<ReviewPageProps> = ({
  students,
  setStudents,
  currentIndex,
  setCurrentIndex,
  currentQ,
  setCurrentQ,
  selectedTurma,
  pendingChanges,
  setPendingChanges,
  statements,
  setShowStatementModal,
  setShowAIPreviewModal,
  setAiResult,
  setAnalyzing,
  setShowTerminal,
  setCodeOverride,
  calculateTotal,
  theme,
  t
}) => {
  const currentStudent = students[currentIndex];
  const {
    code,
    tempCode,
    setTempCode,
    editScore,
    editComment,
    saving,
    handleEditChange,
    handleSave,
    handleSaveAll,
    handleDiscardChanges
  } = useReviewLogic(students, currentIndex, currentQ, pendingChanges, setPendingChanges, setStudents, t);

  const [showSideBySide, setShowSideBySide] = useState(() => {
    return localStorage.getItem('showSideBySide') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('showSideBySide', showSideBySide.toString());
  }, [showSideBySide]);

  const [statementWidth, setStatementWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX - 16;
      if (newWidth > 200 && newWidth < 800) {
        setStatementWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize]);

  const handleAIAnalyze = async () => {
    const statement = statements[`q${currentQ}`];
    if (!statement) {
      setShowStatementModal(true);
      return;
    }

    setAnalyzing(true);
    setAiResult(null);
    setShowAIPreviewModal(true);

    try {
      const res = await api.analyzeCode({
        turma: selectedTurma,
        questionNum: currentQ,
        code: code
      });
      setAiResult(res.data);
    } catch (err: unknown) {
      toast.error('AI analysis failed');
      setShowAIPreviewModal(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t.pathCopied);
  };

  const questions = Array.from(new Set(
    students
      .filter(s => s.turma === selectedTurma)
      .flatMap(s => Object.keys(s.questions).map(k => parseInt(k.replace('q', ''))))
  )).sort((a, b) => a - b);

  if (!currentStudent) {
    return (
        <div className="flex-1 flex items-center justify-center text-text-dim italic">
            {t.selectStudent}
        </div>
    );
  }

  const isCodeEdited = code !== tempCode;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
      <div className="flex justify-between items-center bg-panel p-4 rounded-lg border border-border-main shadow-lg">
          <div className="flex items-center gap-6">
              <div className="flex gap-2">
              <button 
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="p-2 bg-button border border-border-main rounded text-text-dim disabled:opacity-20 hover:text-accent hover:border-accent/50 active:scale-90 transition-all"
              >
                  <ChevronLeft />
              </button>
              <button 
                  disabled={currentIndex === students.length - 1}
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="p-2 bg-button border border-border-main rounded text-text-dim disabled:opacity-20 hover:text-accent hover:border-accent/50 active:scale-90 transition-all"
              >
                  <ChevronRight />
              </button>
              </div>
              <div>
              <h2 className="text-lg font-semibold text-text-bright">{currentStudent.name}</h2>
              <p className="text-xs text-text-dim font-mono">{currentStudent.id} • {currentStudent.turma}</p>
              </div>
          </div>

          <div className="flex gap-4 items-center">
              <div className="flex gap-2">
                  {questions.map(q => {
                      const isDirty = !!pendingChanges[currentStudent.folder_name]?.[`q${q}`];
                      return (
                      <button
                          key={q}
                          onClick={() => setCurrentQ(q)}
                          className={`px-4 py-2 rounded border font-bold transition-all duration-200 active:scale-90 ${
                              currentQ === q 
                              ? 'bg-accent border-accent text-black shadow-[0_0_15px_var(--accent-glow)]' 
                              : `bg-button text-text-dim ${isDirty ? 'border-red-500/50 hover:border-red-500' : 'border-border-main hover:border-accent/30'} hover:text-accent`
                          }`}
                      >
                          Q{q}
                      </button>
                      );
                  })}
              </div>
              {pendingChanges[currentStudent.folder_name] && (
                  <button 
                      onClick={handleSaveAll}
                      className="px-4 py-2 bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-black rounded font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                  >
                      <Save size={14} /> {t.saveAll}
                  </button>
              )}
          </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
          {showSideBySide && (
              <>
              <div 
                  style={{ width: statementWidth }}
                  className="bg-panel rounded-lg overflow-hidden flex flex-col border border-border-main shadow-inner"
              >
                  <div className="bg-panel p-2 text-[10px] flex justify-between items-center border-b border-border-main font-bold uppercase tracking-widest text-text-dim">
                      <span className="flex items-center gap-2"><BookOpen size={12} className="text-accent" /> {t.questionStatement}</span>
                      <button onClick={() => setShowSideBySide(false)} className="hover:text-accent transition-colors">
                          <X size={14} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 text-sm text-text-main leading-relaxed markdown-content">
                      {statements[`q${currentQ}`] ? (
                          <div dangerouslySetInnerHTML={{ __html: marked.parse(statements[`q${currentQ}`]) }} />
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                              <div className="bg-panel p-4 rounded-full border border-border-main text-text-dim">
                                  <BookOpen size={32} />
                              </div>
                              <div>
                                  <p className="text-text-bright font-bold mb-1">{t.noStatementProvided}</p>
                                  <p className="text-xs text-text-dim max-w-[250px] mx-auto">{t.statementHelp}</p>
                              </div>
                              <button 
                                  onClick={() => setShowStatementModal(true)}
                                  className="px-6 py-2 bg-button border border-accent/30 text-accent hover:border-accent hover:bg-accent/10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                              >
                                  {t.editStatement}
                              </button>
                          </div>
                      )}
                  </div>
              </div>
              <div 
                  className="w-1.5 cursor-col-resize hover:bg-accent/50 active:bg-accent transition-colors rounded-full self-stretch my-2"
                  onMouseDown={startResizing}
              />
              </>
          )}
          <div className="flex-1 bg-app rounded-lg overflow-hidden flex flex-col border border-border-main shadow-inner">
              <div className="bg-panel p-2 text-[10px] flex justify-between items-center border-b border-border-main overflow-hidden">
              <div className="flex items-center gap-4 flex-1 min-w-0 mr-4">
                  <button 
                      onClick={() => setShowSideBySide(!showSideBySide)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all active:scale-95 font-bold uppercase tracking-widest flex-shrink-0 ${
                          showSideBySide 
                          ? 'bg-accent text-black border-accent shadow-[0_0_10px_var(--accent-glow)]' 
                          : 'bg-button text-accent border-accent/30 hover:border-accent hover:bg-accent/10'
                      }`}
                      title="Ver enunciado ao lado"
                  >
                      <Eye size={14} />
                      <span>{t.questionStatement.split(' ')[0]}</span>
                  </button>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-app rounded border border-border-main flex-shrink-0">
                      <BookOpen size={10} className="text-accent" />
                      <span className="truncate max-w-[120px] font-mono text-text-dim">
                          {statements[`q${currentQ}`] ? t.statementLoaded : t.noStatement}
                      </span>
                      <button 
                          onClick={() => setShowStatementModal(true)}
                          className="ml-1 text-accent hover:text-accent/80 underline"
                      >
                          {t.edit}
                      </button>
                  </div>
                  <span className="truncate font-mono text-text-dim opacity-60 min-w-0 flex-1">{currentStudent.questions[`q${currentQ}`]?.path || 'No file path'}</span>
                  {currentStudent.questions[`q${currentQ}`]?.path && (
                  <button 
                      onClick={() => copyToClipboard(currentStudent.questions[`q${currentQ}`].path!)}
                      className="hover:text-accent text-text-dim transition-colors flex-shrink-0"
                      title={t.copyPath}
                  >
                      <Copy size={12} />
                  </button>
                  )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                  {currentStudent.questions[`q${currentQ}`]?.path && (
                      <>
                      <button 
                          onClick={handleAIAnalyze}
                          className="flex items-center gap-2 bg-button border border-accent/50 hover:bg-accent hover:text-black hover:border-accent px-3 py-1 rounded text-accent text-[10px] font-bold transition-all active:scale-95 group shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                      >
                          <Sparkles size={10} className="fill-current" /> {t.aiAnalyze}
                      </button>
                      <button 
                          onClick={() => {
                              setCodeOverride(isCodeEdited ? tempCode : undefined);
                              setShowTerminal(true);
                          }}
                          className="flex items-center gap-2 bg-button hover:bg-panel border border-border-main px-3 py-1 rounded text-text-dim text-[10px] font-bold transition-all active:scale-95"
                      >
                          <Play size={10} className="fill-current" /> {t.runCode}
                      </button>
                      </>
                  )}
              </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden relative monaco-wrapper">
                  <div className="flex-1 bg-app overflow-hidden">
                      <Editor
                          height="100%"
                          defaultLanguage="cpp"
                          theme={theme === 'dark' ? 'vs-dark' : 'light'}
                          value={tempCode}
                          onChange={(value) => setTempCode(value || '')}
                          options={{
                              fontSize: 14,
                              fontFamily: "monospace",
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              lineNumbers: 'on',
                              renderLineHighlight: 'all',
                              tabSize: 4,
                              padding: { top: 16, bottom: 16 },
                              automaticLayout: true,
                              letterSpacing: 0,
                              fontLigatures: false,
                          }}
                      />
                  </div>

                  {isCodeEdited && (
                      <div className="bg-red-950/40 border-t border-red-900/50 p-2 flex justify-between items-center animate-in slide-in-from-bottom-2 duration-300">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                              <Info size={14} />
                              {t.tempCodeNotice}
                          </div>
                          <button 
                              onClick={() => setTempCode(code)}
                              className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-500 border border-red-900/50 rounded text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                          >
                              {t.discardTempCode}
                          </button>
                      </div>
                  )}
              </div>
          </div>

          <div className="w-80 bg-panel p-5 rounded-lg flex flex-col gap-5 border border-border-main shadow-2xl">
              <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-dim mb-2">{t.score}</label>
              <input 
                  type="number" 
                  step="0.1"
                  value={editScore}
                  disabled={!currentStudent.questions[`q${currentQ}`]?.path}
                  onChange={(e) => handleEditChange(Number(e.target.value), editComment)}
                  className="w-full bg-input border border-border-main rounded p-3 text-accent font-bold focus:outline-none focus:border-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              </div>
              <div className="flex-1 flex flex-col">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-dim mb-2">{t.feedbackComment}</label>
              <textarea 
                  value={editComment}
                  disabled={!currentStudent.questions[`q${currentQ}`]?.path}
                  onChange={(e) => handleEditChange(editScore, e.target.value)}
                  className="flex-1 w-full bg-input border border-border-main rounded p-3 text-text-main focus:outline-none focus:border-accent resize-none text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={t.enterFeedback}
              />
              </div>
              
              <div className="flex flex-col gap-2">
                  {pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`] && (
                      <button 
                          onClick={handleDiscardChanges}
                          className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                      >
                          <Trash2 size={12} /> {t.discardChanges}
                      </button>
                  )}
                  <button 
                      onClick={() => handleSave()}
                      disabled={saving || !currentStudent.questions[`q${currentQ}`]?.path}
                      className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                          pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`]
                          ? 'bg-button text-accent border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:bg-accent hover:text-black'
                          : 'bg-button border border-border-main hover:bg-accent hover:text-black hover:border-accent'
                      }`}
                  >
                      <Save size={18} /> {saving ? t.saving : t.saveGrade}
                  </button>
              </div>
              
              <div className="mt-2 pt-4 border-t border-border-main">
              <div className="flex justify-between items-baseline mb-3">
                  <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">{t.performance}</span>
                  <span className="text-xl font-black text-text-bright drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{calculateTotal(currentStudent)}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                  {questions.map(q => {
                      const isDirty = !!pendingChanges[currentStudent.folder_name]?.[`q${q}`];
                      const currentQScore = isDirty 
                          ? pendingChanges[currentStudent.folder_name][`q${q}`].score 
                          : currentStudent.questions[`q${q}`]?.score || 0;
                      return (
                      <button 
                          key={q} 
                          onClick={() => setCurrentQ(q)}
                          className={`text-center text-[9px] font-bold p-1.5 rounded border transition-all active:scale-95 ${
                              currentQ === q 
                              ? 'bg-accent text-black border-accent' 
                              : isDirty
                                ? 'bg-red-500/10 border-red-500 text-red-500'
                                : 'bg-input border-border-main text-text-dim hover:border-accent/50'
                          }`}
                      >
                          Q{q}: {currentQScore}
                      </button>
                      );
                  })}
              </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ReviewPage;
