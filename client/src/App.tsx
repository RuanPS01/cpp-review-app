import { useState, useEffect, useCallback } from 'react';
import { 
  Sun, Moon, FileText, Table as TableIcon, Plus, Settings, Trash2, 
  Loader2, CheckCircle2, Sparkles, BookOpen, Info, Copy,
  Terminal, Monitor, Cpu, Folder
} from 'lucide-react';
import TerminalPanel from './components/TerminalPanel';
import Modal from './components/Modal';
import toast, { Toaster } from 'react-hot-toast';
import translations from './translations';
import type { Student, AISettings, View, PendingChanges, AIResult } from './types';
import { api } from './services/api';

// Pages
import SettingsPage from './pages/SettingsPage';
import ImportPage from './pages/ImportPage';
import TablePage from './pages/TablePage';
import ReviewPage from './pages/ReviewPage';

const App = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('review');
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState(false);
  const [codeOverride, setCodeOverride] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!showTerminal) {
      setCodeOverride(undefined);
    }
  }, [showTerminal]);

  const [lang, setLang] = useState<'pt-BR' | 'en-US'>('pt-BR');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const t = translations[lang];

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // AI State
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'ollama',
    ollamaModel: 'llama3.3',
    cloudModel: 'gemini-1.5-flash-lite',
    cloudKey: '',
    evaluationCriteria: ''
  });
  
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showAIPreviewModal, setShowAIPreviewModal] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});

  // Help Modals
  const [showJsonHelp, setShowJsonHelp] = useState(false);
  const [showOllamaHelp, setShowOllamaHelp] = useState(false);
  const [showZipHelp, setShowZipHelp] = useState(false);

  const calculateTotal = (student: Student) => {
    const classQuestions = Array.from(new Set(
      students
        .filter(s => s.turma === student.turma)
        .flatMap(s => Object.keys(s.questions))
    ));
    const totalQuestions = classQuestions.length || 1;

    const studentPending = pendingChanges[student.folder_name] || {};
    const sum = classQuestions.reduce((acc, qKey) => {
        const score = studentPending[qKey] 
          ? studentPending[qKey].score 
          : (student.questions[qKey]?.score || 0);
        return acc + score;
    }, 0);
    
    return (sum / totalQuestions).toFixed(2);
  };

  const calculateClassAverage = () => {
    const classStudents = students.filter(s => s.turma === selectedTurma);
    if (classStudents.length === 0) return '0.00';
    const sum = classStudents.reduce((acc, s) => acc + parseFloat(calculateTotal(s)), 0);
    return (sum / classStudents.length).toFixed(2);
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.getStudents();
      setStudents(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching students', err);
      setLoading(false);
    }
  }, []);

  const fetchAISettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      setAiSettings(res.data);
    } catch (err) {
      console.error('Error fetching AI settings', err);
    }
  }, []);

  const fetchStatements = useCallback(async (turma: string) => {
    try {
      const res = await api.getStatements(turma);
      setStatements(res.data);
    } catch (err) {
      console.error('Error fetching statements', err);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchAISettings();
  }, [fetchStudents, fetchAISettings]);

  useEffect(() => {
    if (students.length > 0) {
      const turmas = Array.from(new Set(students.map(s => s.turma)));
      if (!selectedTurma && turmas.length > 0) {
        setSelectedTurma(turmas[0]);
      }
    } else if (!loading) {
      setView('import');
    }
  }, [students, loading, selectedTurma]);

  useEffect(() => {
    if (selectedTurma) {
      fetchStatements(selectedTurma);
    }
  }, [selectedTurma, fetchStatements]);

  const saveStatement = async (text: string) => {
    const updatedStatements = { ...statements, [`q${currentQ}`]: text };
    try {
      await api.saveStatements(selectedTurma, updatedStatements);
      setStatements(updatedStatements);
      toast.success('Enunciado salvo com sucesso');
    } catch {
      toast.error('Falha ao salvar enunciado');
    }
  };

  const applyAIResult = () => {
    if (aiResult) {
      const student = students[currentIndex];
      const qKey = `q${currentQ}`;
      
      setPendingChanges(prev => ({
        ...prev,
        [student.folder_name]: {
          ...(prev[student.folder_name] || {}),
          [qKey]: { score: aiResult.score, comment: aiResult.comment }
        }
      }));
      
      setShowAIPreviewModal(false);
      toast.success(t.aiApplied);
    }
  };

  const handleClearTurma = async (turmaName: string) => {
    toast.custom((toastObj) => (
      <div
        className={`${
          toastObj.visible ? 'animate-crt-open' : 'animate-crt-close'
        } max-w-md w-full bg-panel shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-xl pointer-events-auto flex flex-col p-6 border border-border-main mx-auto`}
      >
        <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-text-bright">{t.confirmDeleteTitle}</h3>
        </div>
        <p className="text-sm text-text-dim mb-8 leading-relaxed">
          {t.confirmDeleteMsg} <span className="text-accent font-bold drop-shadow-[0_0_5px_var(--accent-glow)]">{turmaName}</span>. This action cannot be reversed.
        </p>
        <div className="flex gap-4 justify-end">
          <button
            onClick={() => toast.dismiss(toastObj.id)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-text-dim hover:text-text-bright transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(toastObj.id);
              try {
                await api.deleteTurma(turmaName);
                toast.success(t.dataCleared);
                if (selectedTurma === turmaName) {
                  setSelectedTurma('');
                }
                await fetchStudents();
              } catch {
                toast.error(t.failedToClear);
              }
            }}
            className="px-6 py-2 bg-panel border border-red-900/50 hover:bg-red-600 hover:border-red-500 text-red-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-lg shadow-red-900/10"
          >
            {t.confirmDeleteAction}
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  if (loading) return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center gap-6">
        <div className="relative">
            <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full animate-pulse"></div>
            <Loader2 size={64} className="text-accent animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-2 relative z-10">
            <h2 className="text-accent font-black tracking-[0.3em] uppercase text-sm animate-pulse drop-shadow-[0_0_8px_var(--accent-glow)]">
                {t.loading}
            </h2>
            <div className="w-48 h-1 bg-panel mx-auto rounded-full overflow-hidden">
                <div className="h-full bg-accent w-1/2 animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
            </div>
        </div>
        <style>{`
            @keyframes loading-bar {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
            }
        `}</style>
    </div>
  );

  const turmas = Array.from(new Set(students.map(s => s.turma)));
  const currentStudent = students[currentIndex];

  return (
    <div className="min-h-screen bg-app text-text-main font-sans monaco-reset">
      <header className="bg-header p-4 border-b border-border-main flex justify-between items-center sticky top-0 z-10 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
        <div className="flex items-center gap-4">
            <div className="flex gap-2">
                <button 
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="p-2 bg-button border border-border-main rounded text-text-dim hover:text-accent transition-all active:scale-95"
                  title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value as 'pt-BR' | 'en-US')}
                  className="bg-button text-xs font-bold text-text-dim border border-border-main rounded px-4 py-2 focus:outline-none focus:border-accent hover:border-accent/50 hover:text-accent transition-all cursor-pointer appearance-none"
                >
                  <option value="pt-BR">PT-BR</option>
                  <option value="en-US">EN-US</option>
                </select>
            </div>
            {turmas.length > 0 && (
                <div className="flex gap-2 ml-4">
                    {turmas.map(turmaName => (
                        <div 
                            key={turmaName} 
                            className={`flex items-center bg-button rounded border transition-all group overflow-hidden ${
                                selectedTurma === turmaName 
                                ? 'border-accent shadow-[0_0_15px_var(--accent-glow)]' 
                                : 'border-border-main hover:border-accent/50'
                            }`}
                        >
                            <button
                                onClick={() => {
                                    setSelectedTurma(turmaName);
                                    const firstIdx = students.findIndex(s => s.turma === turmaName);
                                    setCurrentIndex(firstIdx);
                                }}
                                className={`px-4 py-2 text-xs font-bold transition-all ${
                                    selectedTurma === turmaName 
                                    ? 'bg-accent text-black' 
                                    : 'text-text-dim hover:text-accent'
                                }`}
                            >
                                {turmaName}
                            </button>
                            <button 
                                onClick={() => handleClearTurma(turmaName)}
                                className={`px-3 py-2 text-text-dim hover:text-red-500 transition-colors border-l border-border-main h-full flex items-center ${
                                    selectedTurma === turmaName ? 'bg-accent/10' : ''
                                }`}
                                title={t.clearData}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('review')}
            disabled={!selectedTurma}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:text-text-main ${view === 'review' ? 'bg-accent !border-accent text-black font-bold shadow-[0_0_15px_var(--accent-glow)]' : 'bg-button text-text-dim border-border-main hover:border-accent/50 hover:text-accent'}`}
          >
            <FileText size={18} /> {t.review}
          </button>
          <button 
            onClick={() => setView('table')}
            disabled={!selectedTurma}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:text-text-main ${view === 'table' ? 'bg-accent !border-accent text-black font-bold shadow-[0_0_15px_var(--accent-glow)]' : 'bg-button text-text-dim border-border-main hover:border-accent/50 hover:text-accent'}`}
          >
            <TableIcon size={18} /> {t.table}
          </button>
          <button 
            onClick={() => setView('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'import' ? 'bg-accent !border-accent text-black font-bold shadow-[0_0_15px_var(--accent-glow)]' : 'bg-button text-text-dim border-border-main hover:border-accent/50 hover:text-accent'}`}
          >
            <Plus size={18} /> {t.import}
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'settings' ? 'bg-accent !border-accent text-black font-bold shadow-[0_0_15px_var(--accent-glow)]' : 'bg-button text-text-dim border-border-main hover:border-accent/50 hover:text-accent'}`}
          >
            <Settings size={18} /> {t.settings}
          </button>
        </div>
      </header>

      <main className="p-4">
        {view === 'settings' ? (
          <SettingsPage 
            aiSettings={aiSettings} 
            setAiSettings={setAiSettings} 
            setShowOllamaHelp={setShowOllamaHelp} 
            t={t} 
          />
        ) : view === 'import' ? (
          <ImportPage 
            t={t} 
            setShowZipHelp={setShowZipHelp} 
            onImportSuccess={fetchStudents} 
            setView={setView} 
          />
        ) : view === 'review' ? (
          <ReviewPage 
            students={students}
            setStudents={setStudents}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            currentQ={currentQ}
            setCurrentQ={setCurrentQ}
            selectedTurma={selectedTurma}
            pendingChanges={pendingChanges}
            setPendingChanges={setPendingChanges}
            aiSettings={aiSettings}
            statements={statements}
            setShowStatementModal={setShowStatementModal}
            setShowAIPreviewModal={setShowAIPreviewModal}
            setAiResult={setAiResult}
            setAnalyzing={setAnalyzing}
            setShowTerminal={setShowTerminal}
            setCodeOverride={setCodeOverride}
            calculateTotal={calculateTotal}
            theme={theme}
            t={t}
          />
        ) : (
          <TablePage 
            students={students}
            selectedTurma={selectedTurma}
            calculateTotal={calculateTotal}
            calculateClassAverage={calculateClassAverage}
            setCurrentIndex={setCurrentIndex}
            setView={setView}
            fetchStudents={fetchStudents}
            setShowJsonHelp={setShowJsonHelp}
            t={t}
          />
        )}
      </main>

      {/* Statement Modal */}
      <Modal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        title={t.questionStatement}
        icon={BookOpen}
      >
        <p className="text-xs text-text-dim mb-4 italic">{t.statementInstruction}</p>
        <textarea
            autoFocus
            defaultValue={statements[`q${currentQ}`] || ''}
            onBlur={(e) => saveStatement(e.target.value)}
            className="w-full bg-input border border-border-main rounded-lg p-4 text-text-main text-sm focus:outline-none focus:border-accent min-h-[300px] transition-colors"
            placeholder={t.enterStatement}
        />
        <div className="mt-6 flex justify-end">
            <button onClick={() => setShowStatementModal(false)} className="px-6 py-2 bg-accent text-black font-black uppercase tracking-widest text-xs rounded-lg active:scale-95 transition-all shadow-lg shadow-accent/20">{t.closeSave}</button>
        </div>
      </Modal>

      {/* AI Preview Modal */}
      <Modal
        isOpen={showAIPreviewModal}
        onClose={() => !analyzing && setShowAIPreviewModal(false)}
        title={t.aiReviewProposal}
        icon={Sparkles}
      >
        {analyzing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 size={48} className="text-accent animate-spin" />
                <div className="text-center">
                    <p className="text-text-bright font-bold uppercase tracking-widest animate-pulse">{t.analyzingCode}</p>
                    <p className="text-xs text-text-dim mt-2">Connecting to {aiSettings.provider.toUpperCase()} system</p>
                </div>
            </div>
        ) : aiResult && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between bg-input p-4 rounded-lg border border-border-main">
                    <span className="text-xs font-bold text-text-dim uppercase tracking-widest">{t.proposedScore}</span>
                    <span className="text-4xl font-black text-accent drop-shadow-[0_0_8px_var(--accent-glow)]">{aiResult.score}</span>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-dim uppercase tracking-widest">{t.aiFeedback}</label>
                    <div className="bg-input border border-border-main p-4 rounded-lg text-sm text-text-main leading-relaxed max-h-[200px] overflow-auto transition-colors">
                        {aiResult.comment}
                    </div>
                </div>
                <div className="flex gap-4">
                     <button 
                        onClick={() => setShowAIPreviewModal(false)}
                        className="flex-1 px-4 py-3 border border-border-main text-text-dim hover:text-text-bright hover:bg-button rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        {t.discard}
                    </button>
                    <button 
                        onClick={() => {
                            if (aiResult) {
                                navigator.clipboard.writeText(aiResult.comment);
                                toast.success(t.feedbackCopied);
                            }
                        }}
                        className="flex-1 px-4 py-3 border border-border-main text-text-dim hover:text-accent hover:bg-button rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <Copy size={14} /> {t.gotIt.split(' ')[0] === 'Entendi' ? 'Copiar' : 'Copy'}
                    </button>
                    <button 
                        onClick={applyAIResult}
                        className="flex-2 px-8 py-3 bg-accent text-black font-black uppercase tracking-widest text-xs rounded-lg active:scale-95 transition-all shadow-lg shadow-accent/40"
                    >
                        {t.applyAiFeedback}
                    </button>
                </div>
            </div>
        )}
      </Modal>

      {/* JSON Help Modal */}
      <Modal
        isOpen={showJsonHelp}
        onClose={() => setShowJsonHelp(false)}
        title={t.expectedJson}
        icon={Info}
        maxWidth="max-w-lg"
      >
        <p className="text-xs text-text-dim mb-4 italic">
            {t.jsonHelpDesc}
        </p>
        <div className="bg-app rounded-lg p-4 font-mono text-[11px] text-accent border border-border-main shadow-inner transition-colors">
            <pre className="!bg-transparent">{`[
  {
    "folder_name": "aluno_id_123",
    "questions": {
      "q1": { "score": 85, "comment": "Great work" },
      "q2": { "score": 90, "comment": "Excellent logic" }
    }
  },
  ...
]`}</pre>
        </div>
        <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <p className="text-[10px] text-accent leading-relaxed">
                <span className="font-bold">{t.note}:</span> {t.jsonHelpNote}
            </p>
        </div>
        <div className="mt-6 flex justify-end">
            <button 
                onClick={() => setShowJsonHelp(false)}
                className="px-6 py-2 bg-button hover:bg-panel border border-border-main text-text-main font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all active:scale-95"
            >
                {t.gotIt}
            </button>
        </div>
      </Modal>

      {/* Ollama Help Modal */}
      <Modal
        isOpen={showOllamaHelp}
        onClose={() => setShowOllamaHelp(false)}
        title={t.ollamaSetup}
        icon={Terminal}
        maxWidth="max-w-lg"
      >
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-text-bright text-xs font-bold uppercase tracking-wider">
                    <Monitor size={14} className="text-accent" /> {t.installRun}
                </div>
                <p className="text-xs text-text-dim leading-relaxed pl-6">
                    {t.ollamaHelpStep1}
                </p>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-text-bright text-xs font-bold uppercase tracking-wider">
                    <Cpu size={14} className="text-accent" /> {t.downloadModel}
                </div>
                <p className="text-xs text-text-dim leading-relaxed pl-6 mb-2">
                    {t.ollamaHelpStep2}
                </p>
                <div className="bg-app rounded border border-border-main p-3 ml-6 transition-colors">
                    <code className="text-[11px] text-accent">ollama pull llama3.3</code>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-text-bright text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 size={14} className="text-accent" /> {t.verifyConnection}
                </div>
                <p className="text-xs text-text-dim leading-relaxed pl-6">
                    {t.ollamaHelpStep3}
                </p>
            </div>
        </div>
        <div className="mt-8 flex justify-end">
            <button 
                onClick={() => setShowOllamaHelp(false)}
                className="px-6 py-2 bg-button hover:bg-panel border border-border-main text-text-bright font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all active:scale-95"
            >
                {t.readyToCode}
            </button>
        </div>
      </Modal>

      {/* ZIP Hierarchy Help Modal */}
      <Modal
        isOpen={showZipHelp}
        onClose={() => setShowZipHelp(false)}
        title={t.zipHierarchyTitle}
        icon={Folder}
        maxWidth="max-w-md"
      >
        <p className="text-xs text-text-dim mb-6 leading-relaxed">
            {t.zipHierarchyDesc}
        </p>
        
        <div className="bg-input border border-border-main rounded-lg p-6 font-mono text-[11px] space-y-3 transition-colors">
            <div className="flex items-center gap-2 text-accent">
                <FileText size={14} className="text-text-dim" /> submissions.zip
            </div>
            <div className="pl-6 space-y-3 border-l border-border-main ml-1.5">
                <div className="flex items-center gap-2 text-text-bright">
                    <Folder size={14} className="text-accent" /> {t.zipHierarchyQuestion} 1/
                </div>
                <div className="pl-6 space-y-3 border-l border-border-main ml-1.5">
                    <div className="flex items-center gap-2 text-text-main">
                        <Folder size={14} className="text-text-dim" /> {t.zipHierarchyStudent1}/
                    </div>
                    <div className="pl-6 flex items-center gap-2 text-accent opacity-80">
                        <FileText size={12} /> {t.zipHierarchyFile}
                    </div>
                    
                    <div className="flex items-center gap-2 text-text-main mt-3">
                        <Folder size={14} className="text-text-dim" /> {t.zipHierarchyStudent2}/
                    </div>
                    <div className="pl-6 space-y-1 border-l border-border-main ml-1.5">
                        <div className="flex items-center gap-2 text-text-dim">
                            <Folder size={12} /> {t.zipHierarchyData}/
                        </div>
                        <div className="pl-6 flex items-center gap-2 text-accent opacity-80">
                            <FileText size={12} /> {t.zipHierarchyFile}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-text-bright pt-2">
                    <Folder size={14} className="text-accent" /> {t.zipHierarchyQuestion} 2/
                </div>
                <div className="pl-6 text-text-dim italic text-[10px]">
                    {t.zipHierarchyRepeated}
                </div>
            </div>
        </div>

        <div className="mt-6 flex justify-end">
            <button 
                onClick={() => setShowZipHelp(false)}
                className="px-6 py-2 bg-button hover:bg-panel border border-border-main text-text-bright font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all active:scale-95"
            >
                {t.gotIt}
            </button>
        </div>
      </Modal>

      {currentStudent && currentStudent.questions[`q${currentQ}`]?.path && (
        <TerminalPanel 
          isOpen={showTerminal}
          filePath={currentStudent.questions[`q${currentQ}`].path!} 
          codeOverride={codeOverride}
          onClose={() => setShowTerminal(false)} 
          t={t}
          theme={theme}
        />
      )}

      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'var(--bg-panel)',
            color: 'var(--text-main)',
            border: 'var(--border-main) 1px solid',
            boxShadow: '0 0 15px var(--accent-glow)',
            fontSize: '14px',
            fontWeight: 'bold'
          },
          success: {
            iconTheme: {
              primary: 'var(--accent)',
              secondary: 'var(--bg-panel)',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: 'var(--bg-panel)',
            },
          },
        }}
      />
      
      <style>{`
        @keyframes crt-open {
          0% { transform: scaleY(0.005) scaleX(0); opacity: 0; }
          50% { transform: scaleY(0.005) scaleX(1); opacity: 1; }
          100% { transform: scaleY(1) scaleX(1); opacity: 1; }
        }
        @keyframes crt-close {
          0% { transform: scaleY(1) scaleX(1); opacity: 1; }
          50% { transform: scaleY(0.005) scaleX(1); opacity: 1; }
          100% { transform: scaleY(0.005) scaleX(0); opacity: 0; }
        }
        .animate-crt-open {
          animation: crt-open 0.15s ease-out forwards;
        }
        .animate-crt-close {
          animation: crt-close 0.1s ease-in forwards;
        }
        
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: var(--bg-app);
        }
        ::-webkit-scrollbar-thumb {
          background: var(--bg-button);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--accent);
          box-shadow: 0 0 10px var(--accent-glow);
        }

        .markdown-content h1 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: var(--text-bright); }
        .markdown-content h2 { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.75rem; color: var(--text-bright); }
        .markdown-content h3 { font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem; color: var(--text-bright); }
        .markdown-content p { margin-bottom: 1rem; color: var(--text-main); line-height: 1.6; }
        .markdown-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .markdown-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
        .markdown-content li { margin-bottom: 0.25rem; }
        .markdown-content code { background: var(--bg-button); padding: 0.1rem 0.3rem; border-radius: 0.25rem; font-family: monospace; color: var(--accent); }
        .markdown-content pre { background: var(--bg-app); padding: 1rem; border-radius: 0.5rem; overflow: auto; margin-bottom: 1rem; border: 1px solid var(--border-main); }
        .markdown-content blockquote { border-left: 4px solid var(--accent); padding-left: 1rem; font-italic: italic; color: var(--text-dim); margin-bottom: 1rem; }
        .markdown-content img { max-width: 100%; height: auto; border-radius: 0.5rem; }
        .markdown-content a { color: var(--accent); text-decoration: underline; }
        .markdown-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .markdown-content th, .markdown-content td { border: 1px solid var(--border-main); padding: 0.5rem; text-align: left; }
        .markdown-content th { background: var(--bg-button); font-weight: bold; }
      `}</style>
    </div>
  );
};

export default App;
