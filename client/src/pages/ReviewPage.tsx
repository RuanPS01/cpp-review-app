import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Copy, Save, 
  Sparkles, BookOpen, X, Play, Eye, Info, Trash2, Loader2,
  CheckCircle2, List, ClipboardList, AlertCircle, RotateCcw, Settings
} from 'lucide-react';
import { marked } from 'marked';
import Editor from '@monaco-editor/react';
import type { Student, PendingChanges, AISettings, AIResult } from '../types';
import { api } from '../services/api';
import axios from 'axios';
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
  setAiError: (error: any) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setShowTerminal: (show: boolean) => void;
  setCodeOverride: (code: string | undefined) => void;
  calculateTotal: (student: Student) => string;
  theme: 'light' | 'dark';
  t: any;
  showAIPreviewModal: boolean;
  onEditWeights: () => void;
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
  setAiError,
  setAnalyzing,
  setShowTerminal,
  setCodeOverride,
  calculateTotal,
  theme,
  t,
  showAIPreviewModal,
  onEditWeights
}) => {
  const safeStudents = React.useMemo(() => Array.isArray(students) ? students : [], [students]);
  const classStudents = safeStudents.filter(s => s.turma === selectedTurma);
  
  const currentStudent = React.useMemo(() => {
    return safeStudents[currentIndex] || { name: '', id: '', turma: '', folder_name: '', questions: {}, reviewed: false };
  }, [safeStudents, currentIndex]);

  const currentQuestion = currentStudent.questions[`q${currentQ}`];
  
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
    handleToggleQuestionReviewed,
    handleDiscardChanges,
    handleRunTests,
    runningTests,
    testResults,
    setTestResults
  } = useReviewLogic(students, currentIndex, currentQ, pendingChanges, setPendingChanges, setStudents, t);

  const [showTestResults, setShowTestResults] = useState(false);
  const [allTestCases, setAllTestCases] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (selectedTurma) {
      api.getTestCases(selectedTurma).then(res => setAllTestCases(res.data)).catch(console.error);
    } else {
      setAllTestCases({});
    }
  }, [selectedTurma, students.length]);

  useEffect(() => {
    setShowTestResults(false);
  }, [currentQ, currentIndex]);

  const hasTestCases = !!allTestCases[`q${currentQ}`]?.length;

  const [showStudentList, setShowStudentList] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
            setShowStudentList(false);
        }
    };

    if (showStudentList) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStudentList]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Cancel analysis if modal is closed while analyzing
  useEffect(() => {
    if (!showAIPreviewModal && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [showAIPreviewModal]);

  useEffect(() => {
    if (!currentStudent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`]) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, pendingChanges, currentStudent, currentQ]);

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

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-dim">
        <div className="p-6 bg-panel border border-border-main rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
          <Info size={48} className="text-accent opacity-50" />
          <p className="font-bold uppercase tracking-[0.2em] text-sm">{t.noData}</p>
        </div>
      </div>
    );
  }

  const handleAIAnalyze = async () => {
    const statement = statements[`q${currentQ}`];
    if (!statement) {
      setShowStatementModal(true);
      return;
    }

    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setAnalyzing(true);
    setAiResult(null);
    setAiError(null);
    setShowAIPreviewModal(true);

    try {
      const res = await api.analyzeCode({
        turma: selectedTurma,
        questionNum: currentQ,
        code: code
      }, abortControllerRef.current.signal);
      setAiResult(res.data);
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log('AI analysis cancelled');
      } else {
        const errorData = err.response?.data || {};
        const errorObj = {
          fullPrompt: errorData.fullPrompt || 'N/A',
          errorLog: errorData.errorLog || err.message
        };
        setAiError(errorObj);
        setShowAIPreviewModal(false);
        
        toast((t_toast) => (
          <div className="flex flex-col gap-3 min-w-[300px]">
            <div className="flex items-center gap-2 text-red-500 font-bold">
              <AlertCircle size={18} />
              <span>{t.aiAnalysisFailed}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(errorObj.errorLog);
                  toast.success(t.errorLogCopied, { id: 'copy-log' });
                }}
                className="px-2 py-1 bg-panel border border-border-main rounded text-[10px] font-bold hover:bg-button transition-colors flex items-center gap-1"
              >
                <Copy size={12} /> {t.copyLog}
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(errorObj.fullPrompt);
                  toast.success(t.promptCopied, { id: 'copy-prompt' });
                }}
                className="px-2 py-1 bg-panel border border-border-main rounded text-[10px] font-bold hover:bg-button transition-colors flex items-center gap-1"
              >
                <Copy size={12} /> {t.copyPrompt}
              </button>
              <button 
                onClick={() => toast.dismiss(t_toast.id)}
                className="px-2 py-1 bg-accent/20 border border-accent/30 text-accent rounded text-[10px] font-bold hover:bg-accent hover:text-black transition-colors"
              >
                {t.okIgnore}
              </button>
            </div>
          </div>
        ), { duration: 10000, position: 'top-center' });
      }
    } finally {
      setAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t.pathCopied);
  };

  const questions = Array.from(new Set(
    classStudents.flatMap(s => Object.keys(s.questions).map(k => parseInt(k.replace('q', ''))))
  )).sort((a, b) => a - b);

  const isCodeEdited = code !== tempCode;
  const reviewedCount = classStudents.filter(s => {
    const qs = Object.values(s.questions);
    return qs.every(q => q.reviewed || !q.path);
  }).length;

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)] relative">
      {/* Student List Sidebar */}
      {showStudentList && (
        <div 
          ref={sidebarRef}
          className="absolute left-0 top-0 bottom-0 w-80 bg-panel border border-border-main z-20 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 rounded-2xl overflow-hidden m-2"
        >
          <div className="p-3 border-b border-border-main flex items-center bg-button/20">
            <button onClick={() => setShowStudentList(false)} className="mr-3 p-1 hover:bg-button rounded-md hover:text-red-500 transition-all active:scale-90">
              <X size={20} />
            </button>
            <h3 className="font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
              <ClipboardList size={14} className="text-accent" />
              {t.studentsList || 'Students List'} ({classStudents.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {classStudents.map((s, _idx) => {
              const isCurrent = s.folder_name === currentStudent.folder_name;
              const isFullyReviewed = Object.values(s.questions).every(q => q.reviewed || !q.path);
              return (
                <button
                  key={s.folder_name}
                  onClick={() => {
                    const globalIdx = safeStudents.findIndex(std => std.folder_name === s.folder_name);
                    setCurrentIndex(globalIdx);
                    setShowStudentList(false); // Close on selection too
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg border transition-all flex justify-between items-center group ${
                    isCurrent 
                    ? 'bg-accent border-accent text-black shadow-lg' 
                    : 'bg-app border-border-main hover:border-accent/50 text-text-dim hover:text-text-bright'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[11px] truncate">{s.name}</div>
                    <div className={`text-[9px] font-mono ${isCurrent ? 'text-black/60' : 'text-text-dim opacity-60'}`}>{s.id}</div>
                  </div>
                  {(s.reviewed || isFullyReviewed) && (
                    <CheckCircle2 size={14} className={isCurrent ? 'text-black' : 'text-accent'} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex justify-between items-center bg-panel p-4 rounded-lg border border-border-main shadow-lg">
            <div className="flex items-center gap-6">
                <div className="flex gap-2">
                <button 
                    onClick={() => setShowStudentList(!showStudentList)}
                    className={`p-2 border rounded transition-all active:scale-90 ${showStudentList ? 'bg-accent border-accent text-black shadow-lg' : 'bg-button border-border-main text-text-dim hover:text-accent hover:border-accent/50'}`}
                    title="Toggle Student List"
                >
                    <List size={24} />
                </button>
                <button 
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(prev => prev - 1)}
                    className="p-2 bg-button border border-border-main rounded text-text-dim disabled:opacity-20 hover:text-accent hover:border-accent/50 active:scale-90 transition-all"
                >
                    <ChevronLeft />
                </button>
                <button 
                    disabled={currentIndex === safeStudents.length - 1}
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="p-2 bg-button border border-border-main rounded text-text-dim disabled:opacity-20 hover:text-accent hover:border-accent/50 active:scale-90 transition-all"
                >
                    <ChevronRight />
                </button>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-bright">{currentStudent.name}</h2>
                    <p className="text-xs text-text-dim font-mono">{currentStudent.id} • {currentStudent.turma}</p>
                  </div>
                  {(currentStudent.reviewed || Object.values(currentStudent.questions).every(q => q.reviewed || !q.path)) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent text-accent text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 size={14} />
                        {t.reviewed || 'Reviewed'}
                    </div>
                  )}
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <div className="px-3 py-1.5 bg-panel border border-border-main rounded-lg flex items-center gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Reviewed:</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-accent font-black">{reviewedCount}</span>
                    <span className="text-text-dim opacity-30">/</span>
                    <span className="text-text-bright opacity-60 font-bold">{classStudents.length}</span>
                  </div>
                  <div className="w-20 h-1.5 bg-app rounded-full overflow-hidden border border-border-main">
                    <div 
                      className="h-full bg-accent transition-all duration-500 shadow-[0_0_10px_var(--accent-glow)]" 
                      style={{ width: `${(reviewedCount / classStudents.length) * 100}%` }}
                    />
                  </div>
                </div>

                {pendingChanges[currentStudent.folder_name] && (
                    <button 
                        onClick={() => handleSaveAll()}
                        className="px-4 py-2 bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-black rounded font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Save size={14} /> {t.saveAll}
                    </button>
                )}
                <div className="flex gap-2">
                    {questions.map(q => {
                        const isDirty = !!pendingChanges[currentStudent.folder_name]?.[`q${q}`];
                        const qData = currentStudent.questions[`q${q}`];
                        const isReviewed = qData?.reviewed || !qData?.path;
                        return (
                        <button
                            key={q}
                            onClick={() => setCurrentQ(q)}
                            className={`px-4 py-2 rounded border font-bold transition-all duration-200 active:scale-90 relative ${
                                currentQ === q 
                                ? `bg-accent border-accent text-black shadow-[0_0_15px_var(--accent-glow)] ${isDirty ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-panel' : ''}` 
                                : `bg-button text-text-dim ${isDirty ? 'border-red-500/50 hover:border-red-500' : 'border-border-main hover:border-accent/30'} hover:text-accent`
                            }`}
                        >
                            Q{q}
                            {isReviewed && (
                                <div className="absolute -top-1 -right-1 bg-accent rounded-full border border-black p-0.5 z-10">
                                    <CheckCircle2 size={8} className="text-black" />
                                </div>
                            )}
                        </button>
                        );
                    })}
                    <button 
                        onClick={onEditWeights}
                        className="px-3 py-2 bg-button border border-border-main text-text-dim hover:text-accent hover:border-accent/50 rounded transition-all active:scale-90 flex items-center gap-2"
                        title={t.editWeights}
                    >
                        <Settings size={18} />
                    </button>
                </div>
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
                    className="w-1.5 cursor-col-resize bg-border-main hover:bg-accent/50 active:bg-accent transition-colors rounded-full self-stretch my-2"
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
                        {hasTestCases && (
                        <button 
                            onClick={handleRunTests}
                            disabled={runningTests}
                            className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold transition-all active:scale-95 shadow-lg ${
                                runningTests 
                                ? 'bg-panel text-text-dim cursor-wait' 
                                : 'bg-button border border-accent/30 text-accent hover:bg-accent hover:text-black hover:border-accent'
                            }`}
                        >
                            {runningTests ? <Loader2 size={10} className="animate-spin" /> : <ClipboardList size={10} />}
                            {runningTests ? t.runningTests : t.runTests}
                        </button>
                        )}
                        {testResults && (
                            <button 
                                onClick={() => setShowTestResults(true)}
                                className="flex items-center gap-2 bg-accent/20 border border-accent text-accent px-3 py-1 rounded text-[10px] font-bold animate-pulse"
                            >
                                <Eye size={10} /> {testResults.filter(r => r.passed).length}/{testResults.length} {t.testResults}
                            </button>
                        )}
                        </>
                        )}
                        </div>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden relative monaco-wrapper">
                        {showTestResults && testResults && (
                        <div className="absolute inset-0 z-20 bg-app/95 backdrop-blur-md p-6 flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-accent flex items-center gap-2">
                                        <ClipboardList size={24} /> {t.testResults}
                                    </h3>
                                    <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest">{t.vplTestCasesNote}</p>
                                </div>
                                <button onClick={() => setShowTestResults(false)} className="p-2 hover:bg-button rounded-full text-text-dim hover:text-red-500 transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto rounded-xl border border-border-main bg-panel shadow-2xl">
                                <table className="w-full border-collapse">
                                    <thead className="sticky top-0 bg-button/50 backdrop-blur-md z-10">
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-text-dim border-b border-border-main">
                                            <th className="px-4 py-3 text-left w-12">{t.testStatus}</th>
                                            <th className="px-4 py-3 text-left">{t.testName}</th>
                                            <th className="px-4 py-3 text-left">{t.testInput}</th>
                                            <th className="px-4 py-3 text-left">{t.testExpected}</th>
                                            <th className="px-4 py-3 text-left">{t.testActual}</th>
                                            <th className="px-4 py-3 text-right">{t.testDuration}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-main/30">
                                        {testResults.map((res, i) => (
                                            <tr key={i} className={`text-xs hover:bg-button/20 transition-colors ${res.passed ? '' : 'bg-red-500/5'}`}>
                                                <td className="px-4 py-4">
                                                    {res.passed ? (
                                                        <span className="flex items-center gap-1.5 text-accent font-black">
                                                            <CheckCircle2 size={14} /> {t.testPass}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-red-500 font-black">
                                                            <AlertCircle size={14} /> {res.actual?.includes('Timeout') ? t.testTimeout : t.testFail}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 font-mono font-bold text-text-bright">{res.name || `Case ${i}`}</td>
                                                <td className="px-4 py-4"><code className="bg-app px-1.5 py-0.5 rounded border border-border-main text-text-dim text-[10px]">{res.input}</code></td>
                                                <td className="px-4 py-4"><code className="bg-app px-1.5 py-0.5 rounded border border-border-main text-accent text-[10px]">{res.expected}</code></td>
                                                <td className="px-4 py-4">
                                                    <code className={`px-1.5 py-0.5 rounded border text-[10px] ${res.passed ? 'bg-app border-border-main text-text-dim' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                                        {res.actual || '(empty)'}
                                                    </code>
                                                </td>
                                                <td className="px-4 py-4 text-right font-mono text-[10px] text-text-dim">{res.duration}ms</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )}
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
                                onClick={() => {
                                  setTempCode(code);
                                  setTestResults(null);
                                }}
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
                    {currentQuestion?.reviewed && (
                        <button 
                            onClick={() => handleToggleQuestionReviewed(currentIndex, currentQ, false)}
                            className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={14} /> {t.resetStatus}
                            </button>
                            )}
                            {pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`] && (
                            <button 
                            onClick={handleDiscardChanges}
                            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-text-dim hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                            >
                            <Trash2 size={12} /> {t.discardChanges}
                            </button>
                            )}
                            <button 
                            onClick={() => handleSave(currentIndex, currentQ, true)}
                            disabled={saving || !currentStudent.questions[`q${currentQ}`]?.path}
                            className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                            pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`]
                            ? 'bg-button text-accent border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:bg-accent hover:text-black'
                            : (currentQuestion?.reviewed || !currentQuestion?.path)
                              ? 'bg-accent/10 border border-accent text-accent' 
                              : 'bg-button border border-border-main hover:bg-accent hover:text-black hover:border-accent'
                            }`}
                            >
                            {(currentQuestion?.reviewed || !currentQuestion?.path) && !pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`] ? <CheckCircle2 size={18} /> : <Save size={18} />}
                            {saving 
                            ? t.saving 
                            : ((currentQuestion?.reviewed || !currentQuestion?.path) && !pendingChanges[currentStudent.folder_name]?.[`q${currentQ}`] 
                                ? t.questionReviewed
                                : t.saveGrade)}
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
                        const qData = currentStudent.questions[`q${q}`];
                        const currentQScore = isDirty 
                            ? pendingChanges[currentStudent.folder_name][`q${q}`].score 
                            : qData?.score || 0;
                        const isReviewed = qData?.reviewed || !qData?.path;

                        return (
                        <button 
                            key={q} 
                            onClick={() => setCurrentQ(q)}
                            className={`text-center text-[9px] font-bold p-1.5 rounded border transition-all active:scale-95 relative ${
                                currentQ === q 
                                ? `bg-accent text-black border-accent ${isDirty ? 'ring-2 ring-red-500' : ''}` 
                                : isDirty
                                  ? 'bg-red-500/10 border-red-500 text-red-500'
                                  : isReviewed
                                    ? 'bg-accent/10 border-accent text-accent'
                                    : 'bg-input border-border-main text-text-dim hover:border-accent/50'
                            }`}
                        >
                            Q{q}: {currentQScore}
                            {isReviewed && (
                                <div className="absolute -top-1 -right-1 bg-accent rounded-full border border-black p-0.5 z-10">
                                    <CheckCircle2 size={6} className="text-black" />
                                </div>
                            )}
                        </button>
                        );
                    })}
                </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;
