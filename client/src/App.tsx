import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ChevronLeft, ChevronRight, Copy, Save, Table as TableIcon, 
  FileText, CheckCircle2, Play, Upload, Plus, Trash2, 
  Settings, Sparkles, BookOpen, X, Loader2, Download, Info, Terminal, Monitor, Cpu, Folder
} from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/plugins/line-numbers/prism-line-numbers.js';
import 'prismjs/plugins/line-numbers/prism-line-numbers.css';
import TerminalPanel from './components/TerminalPanel';
import toast, { Toaster } from 'react-hot-toast';
import translations from './translations';
import * as XLSX from 'xlsx';

// Recommended Models Constant
const RECOMMENDED_MODELS: Record<string, string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5', 'gpt-4o', 'gpt-4-turbo'],
  gemini: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  ollama: ['llama3.3', 'qwen3.6', 'deepseek-v4-flash', 'qwen3-coder-next', 'mistral-medium-3.5', 'gemma4', 'kimi-k2.6'],
};

interface Question {
  score: number;
  comment: string;
  path: string | null;
  label?: string;
}

interface Student {
  id: string;
  name: string;
  turma: string;
  questions: {
    [key: string]: Question;
  };
}

interface AISettings {
  provider: 'ollama' | 'openai' | 'gemini' | 'claude';
  ollamaModel: string;
  cloudModel: string;
  cloudKey: string;
  evaluationCriteria: string;
}

const API_BASE = 'http://localhost:3001/api';

const Modal = ({ isOpen, onClose, title, icon: Icon, children, maxWidth = "max-w-2xl" }: { isOpen: boolean, onClose: () => void, title: string, icon: any, children: React.ReactNode, maxWidth?: string }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-150 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        onAnimationEnd={handleAnimationEnd}
        className={`${isOpen ? 'animate-crt-open' : 'animate-crt-close'} bg-neutral-900 w-full ${maxWidth} rounded-xl border border-neutral-800 shadow-2xl flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-black">
          <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Icon size={16} className="text-cyan-500" /> {title}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState(1);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'review' | 'table' | 'import' | 'settings'>('review');
  const [saving, setSaving] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState(false);
  const [lang, setLang] = useState<'pt-BR' | 'en-US'>('pt-BR');

  const t = translations[lang];

  const [editScore, setEditScore] = useState(0);
  const [editComment, setEditComment] = useState('');

  // AI State
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'ollama',
    ollamaModel: 'llama3.3',
    cloudModel: 'gemini-1.5-flash',
    cloudKey: '',
    evaluationCriteria: ''
  });
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isCustomOllama, setIsCustomOllama] = useState(false);
  const [showJsonHelp, setShowJsonHelp] = useState(false);
  const [showOllamaHelp, setShowOllamaHelp] = useState(false);
  const [showZipHelp, setShowZipHelp] = useState(false);
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showAIPreviewModal, setShowAIPreviewModal] = useState(false);
  const [aiResult, setAiResult] = useState<{ score: number, comment: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Import State
  const [importTurma, setImportTurma] = useState('');
  const [folderTemplate, setFolderTemplate] = useState('[EMAIL] [NAME] [ID] [EMAIL]');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchAISettings();
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      const turmas = Array.from(new Set(students.map(s => s.turma)));
      if (!selectedTurma && turmas.length > 0) {
        setSelectedTurma(turmas[0]);
      }
    } else if (!loading) {
      setView('import');
    }
  }, [students, loading]);

  useEffect(() => {
    if (selectedTurma) {
      fetchStatements(selectedTurma);
    }
  }, [selectedTurma]);

  useEffect(() => {
    if (students.length > 0 && view === 'review') {
      const student = students[currentIndex];
      if (student) {
        const q = student.questions[`q${currentQ}`];
        if (q) {
            setEditScore(q.score);
            setEditComment(q.comment);
            if (q.path) {
              fetchCode(q.path);
            } else {
              setCode('// No file found for this question');
            }
        }
      }
    }
  }, [currentIndex, currentQ, students, view]);

  // Update custom model flags when settings are loaded
  useEffect(() => {
    // Cloud
    if (aiSettings.provider !== 'ollama') {
      const recommendations = RECOMMENDED_MODELS[aiSettings.provider] || [];
      const isPredefined = recommendations.includes(aiSettings.cloudModel);
      setIsCustomModel(!isPredefined && aiSettings.cloudModel !== '');
    }
    // Ollama
    if (aiSettings.provider === 'ollama') {
      const recommendations = RECOMMENDED_MODELS.ollama;
      const isPredefined = recommendations.includes(aiSettings.ollamaModel);
      setIsCustomOllama(!isPredefined && aiSettings.ollamaModel !== '');
    }
  }, [aiSettings.provider, aiSettings.cloudModel, aiSettings.ollamaModel]);

  useEffect(() => {
    Prism.highlightAll();
  }, [code, view]);

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/students`);
      setStudents(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching students', err);
      setLoading(false);
    }
  };

  const fetchAISettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings`);
      setAiSettings(res.data);
    } catch (err) {
      console.error('Error fetching AI settings', err);
    }
  };

  const saveAISettings = async (settings: AISettings) => {
    try {
      await axios.post(`${API_BASE}/settings`, settings);
      setAiSettings(settings);
      toast.success(t.settingsSaved);
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  const fetchStatements = async (turma: string) => {
    try {
      const res = await axios.get(`${API_BASE}/statements`, { params: { turma } });
      setStatements(res.data);
    } catch (err) {
      console.error('Error fetching statements', err);
    }
  };

  const saveStatement = async (text: string) => {
    const updatedStatements = { ...statements, [`q${currentQ}`]: text };
    try {
      await axios.post(`${API_BASE}/statements`, { turma: selectedTurma, statements: updatedStatements });
      setStatements(updatedStatements);
      toast.success('Enunciado salvo com sucesso');
    } catch (err) {
      toast.error('Falha ao salvar enunciado');
    }
  };

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
      const res = await axios.post(`${API_BASE}/analyze`, {
        turma: selectedTurma,
        questionNum: currentQ,
        code: code
      });
      setAiResult(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'AI analysis failed');
      setShowAIPreviewModal(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyAIResult = () => {
    if (aiResult) {
      setEditScore(aiResult.score);
      setEditComment(aiResult.comment);
      setShowAIPreviewModal(false);
      toast.success(t.aiApplied);
    }
  };

  const handleClearTurma = async (turmaName: string) => {
    toast.custom((toastObj) => (
      <div
        className={`${
          toastObj.visible ? 'animate-crt-open' : 'animate-crt-close'
        } max-w-md w-full bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-xl pointer-events-auto flex flex-col p-6 border border-neutral-800 mx-auto`}
      >
        <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">{t.confirmDeleteTitle}</h3>
        </div>
        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
          {t.confirmDeleteMsg} <span className="text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">{turmaName}</span>. This action cannot be reversed.
        </p>
        <div className="flex gap-4 justify-end">
          <button
            onClick={() => toast.dismiss(toastObj.id)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(toastObj.id);
              try {
                await axios.delete(`${API_BASE}/turma/${turmaName}`);
                toast.success(t.dataCleared);
                if (selectedTurma === turmaName) {
                  setSelectedTurma('');
                }
                await fetchStudents();
              } catch (err) {
                toast.error(t.failedToClear);
              }
            }}
            className="px-6 py-2 bg-neutral-900 border border-red-900/50 hover:bg-red-600 hover:border-red-500 text-red-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-lg shadow-red-900/10"
          >
            {t.confirmDeleteAction}
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const fetchCode = async (path: string) => {
    try {
      const res = await axios.get(`${API_BASE}/code`, { params: { path } });
      setCode(res.data);
    } catch (err) {
      setCode('// Error loading file: ' + path);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const student = students[currentIndex];
    try {
      await axios.post(`${API_BASE}/update-grade`, {
        turma: student.turma,
        studentId: student.id,
        questionNum: currentQ,
        score: editScore,
        comment: editComment
      });
      
      const updatedStudents = [...students];
      updatedStudents[currentIndex].questions[`q${currentQ}`].score = editScore;
      updatedStudents[currentIndex].questions[`q${currentQ}`].comment = editComment;
      setStudents(updatedStudents);
      toast.success(t.gradeSaved);
    } catch (err) {
      toast.error('Error saving grade');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTurma || !importFile) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('turma', importTurma);
    formData.append('folderTemplate', folderTemplate);
    formData.append('file', importFile);

    try {
      await axios.post(`${API_BASE}/import`, formData);
      toast.success(t.importSuccess);
      setImportTurma('');
      setImportFile(null);
      await fetchStudents();
      setView('table');
    } catch (err) {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleImportGrades = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTurma) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const grades = JSON.parse(event.target?.result as string);
        await axios.post(`${API_BASE}/import-grades`, {
          turma: selectedTurma,
          grades: grades
        });
        toast.success(`Grades for ${selectedTurma} imported successfully!`);
        await fetchStudents();
      } catch (err) {
        toast.error('Failed to import grades. Ensure the JSON format is correct.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportGrades = async () => {
    if (!selectedTurma) return;
    try {
      const res = await axios.get(`${API_BASE}/export-grades/${selectedTurma}`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", `grades_${selectedTurma}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success(`Exporting grades for ${selectedTurma}...`);
    } catch (err) {
      toast.error('Failed to export grades.');
    }
  };

  const handleExportExcel = () => {
    if (!selectedTurma) return;
    
    const classStudents = students.filter(s => s.turma === selectedTurma);
    
    const data = classStudents.map(s => {
        // Try to extract only the number if s.id is a complex folder name
        let cleanId = s.id;
        const numbers = s.id.match(/\d+/g);
        if (numbers && numbers.length > 0) {
            // If the ID looks like a full folder name string, pick the numeric part
            if (s.id.includes('@') || s.id.split(' ').length > 1) {
                cleanId = numbers[0];
            }
        }

        return {
            'ID (Matrícula)': cleanId,
            'Nome completo': s.name,
            'Q1': s.questions.q1?.score || 0,
            'Q2': s.questions.q2?.score || 0,
            'Q3': s.questions.q3?.score || 0,
            'Q4': s.questions.q4?.score || 0,
            'Média': calculateTotal(s),
            'Comentário': Object.values(s.questions)
                .map((q, i) => `Q${i+1}: ${q.comment || ''}`)
                .filter(c => !c.endsWith(': '))
                .join(' | ')
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Grades");
    
    XLSX.writeFile(workbook, `grades_${selectedTurma}.xlsx`);
    toast.success(t.exportExcel + '...');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t.pathCopied);
  };

  const calculateTotal = (student: Student) => {
    const scores = Object.values(student.questions).map(q => q.score);
    if (scores.length === 0) return '0.00';
    const sum = scores.reduce((acc, s) => acc + s, 0);
    return (sum / scores.length).toFixed(2);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full animate-pulse"></div>
            <Loader2 size={64} className="text-cyan-500 animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-2 relative z-10">
            <h2 className="text-cyan-500 font-black tracking-[0.3em] uppercase text-sm animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                {t.loading}
            </h2>
            <div className="w-48 h-1 bg-neutral-900 mx-auto rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 w-1/2 animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
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
  const questions = Array.from(new Set(
    students
      .filter(s => s.turma === selectedTurma)
      .flatMap(s => Object.keys(s.questions).map(k => parseInt(k.replace('q', ''))))
  )).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans">
      <header className="bg-neutral-900 p-4 border-b border-neutral-800 flex justify-between items-center sticky top-0 z-10 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
        <div className="flex items-center gap-4">
            <div className="flex gap-2">
                <select 
                  value={lang} 
                  onChange={(e) => setLang(e.target.value as any)}
                  className="bg-neutral-800 text-xs font-bold text-gray-400 border border-neutral-700 rounded px-4 py-2 focus:outline-none focus:border-cyan-500 hover:border-cyan-500/50 hover:text-cyan-400 transition-all cursor-pointer appearance-none"
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
                            className={`flex items-center bg-neutral-800 rounded border transition-all group overflow-hidden ${
                                selectedTurma === turmaName 
                                ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                                : 'border-neutral-700 hover:border-cyan-500/50'
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
                                    ? 'bg-cyan-500 text-black' 
                                    : 'text-gray-400 hover:text-cyan-400'
                                }`}
                            >
                                {turmaName}
                            </button>
                            <button 
                                onClick={() => handleClearTurma(turmaName)}
                                className={`px-3 py-2 text-neutral-600 hover:text-red-500 transition-colors border-l border-neutral-700 h-full flex items-center ${
                                    selectedTurma === turmaName ? 'bg-cyan-500/10' : ''
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
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:text-gray-400 ${view === 'review' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <FileText size={18} /> {t.review}
          </button>
          <button 
            onClick={() => setView('table')}
            disabled={!selectedTurma}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:text-gray-400 ${view === 'table' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <TableIcon size={18} /> {t.table}
          </button>
          <button 
            onClick={() => setView('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'import' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <Plus size={18} /> {t.import}
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'settings' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <Settings size={18} /> {t.settings}
          </button>
        </div>
      </header>

      <main className="p-4">
        {view === 'settings' ? (
          <div className="max-w-3xl mx-auto mt-10 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-white">
                <Settings className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" /> {t.aiConfig}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t.aiProvider}</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['ollama', 'openai', 'gemini', 'claude'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        const newProvider = p as any;
                                        const defaultModel = newProvider === 'ollama' ? 'llama3.3' : RECOMMENDED_MODELS[newProvider][0];
                                        setAiSettings({ 
                                            ...aiSettings, 
                                            provider: newProvider,
                                            cloudModel: newProvider === 'ollama' ? aiSettings.ollamaModel : defaultModel
                                        });
                                        setIsCustomModel(false);
                                        setIsCustomOllama(false);
                                    }}
                                    className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${aiSettings.provider === p ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-black text-neutral-500 border-neutral-800 hover:border-neutral-600'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {aiSettings.provider === 'ollama' ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500">{t.ollamaModel}</label>
                                    <button 
                                        onClick={() => setShowOllamaHelp(true)}
                                        className="text-[10px] font-bold text-cyan-500 hover:text-cyan-400 underline flex items-center gap-1"
                                    >
                                        <Terminal size={10} /> {t.expectedJson}
                                    </button>
                                </div>
                                <select 
                                    value={isCustomOllama ? 'custom' : aiSettings.ollamaModel}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'custom') {
                                            setIsCustomOllama(true);
                                        } else {
                                            setIsCustomOllama(false);
                                            setAiSettings({ ...aiSettings, ollamaModel: val });
                                        }
                                    }}
                                    className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500 mb-2"
                                >
                                    <option value="" disabled>Select a local model...</option>
                                    {RECOMMENDED_MODELS.ollama.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    <option value="custom">+ Custom Model Name</option>
                                </select>
                                
                                {isCustomOllama && (
                                    <input 
                                        type="text"
                                        value={aiSettings.ollamaModel}
                                        onChange={(e) => setAiSettings({ ...aiSettings, ollamaModel: e.target.value })}
                                        className="w-full bg-black border border-cyan-500/50 rounded-lg p-3 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500 animate-in slide-in-from-top-1 duration-200"
                                        placeholder="Enter model name (e.g. mistral:latest)"
                                        autoFocus
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{t.cloudModel}</label>
                                <select 
                                    value={isCustomModel ? 'custom' : aiSettings.cloudModel}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'custom') {
                                            setIsCustomModel(true);
                                        } else {
                                            setIsCustomModel(false);
                                            setAiSettings({ ...aiSettings, cloudModel: val });
                                        }
                                    }}
                                    className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500 mb-2"
                                >
                                    <option value="" disabled>Select a model...</option>
                                    {(RECOMMENDED_MODELS[aiSettings.provider] || []).map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                    <option value="custom">+ Custom Model Name</option>
                                </select>
                                
                                {isCustomModel && (
                                    <input 
                                        type="text"
                                        value={aiSettings.cloudModel}
                                        onChange={(e) => setAiSettings({ ...aiSettings, cloudModel: e.target.value })}
                                        className="w-full bg-black border border-cyan-500/50 rounded-lg p-3 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500 animate-in slide-in-from-top-1 duration-200"
                                        placeholder="Enter custom model ID..."
                                        autoFocus
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{t.apiKey}</label>
                                <input 
                                    type="password"
                                    value={aiSettings.cloudKey}
                                    onChange={(e) => setAiSettings({ ...aiSettings, cloudKey: e.target.value })}
                                    className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-cyan-500"
                                    placeholder="••••••••••••••••"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-col h-full">
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">{t.globalCriteria}</label>
                    <textarea 
                        value={aiSettings.evaluationCriteria}
                        onChange={(e) => setAiSettings({ ...aiSettings, evaluationCriteria: e.target.value })}
                        className="flex-1 w-full bg-black border border-neutral-800 rounded-lg p-4 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 resize-none min-h-[250px]"
                        placeholder="Define how the AI should grade the code..."
                    />
                </div>
            </div>
            <button 
                onClick={() => saveAISettings(aiSettings)}
                className="mt-8 w-full bg-cyan-500 hover:bg-cyan-400 text-black py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-cyan-900/10"
            >
                <CheckCircle2 size={20} /> {t.saveSettings}
            </button>
          </div>
        ) : view === 'import' ? (
          <div className="max-w-xl mx-auto mt-10 bg-neutral-900 p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                <Upload className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" /> {t.importClass}
            </h2>
            <form onSubmit={handleImport} className="flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-400">{t.classIdentifier}</label>
                    <input 
                        type="text" 
                        required
                        value={importTurma}
                        onChange={(e) => setImportTurma(e.target.value)}
                        placeholder="Ex: Class A"
                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-400">{t.folderTemplate}</label>
                    <input 
                        type="text" 
                        required
                        value={folderTemplate}
                        onChange={(e) => setFolderTemplate(e.target.value)}
                        placeholder="Ex: [EMAIL] [NAME] [ID] [EMAIL]"
                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500 transition-all"
                    />
                    <div className="flex gap-2 mt-2 text-[10px]">
                        {['[EMAIL]', '[NAME]', '[ID]', '[IGNORE]'].map(tag => (
                            <span key={tag} className="bg-neutral-800 text-neutral-500 px-1 rounded border border-neutral-700">{tag}</span>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-sm font-medium text-neutral-400">{t.submissionsZip}</label>
                        <button 
                            type="button"
                            onClick={() => setShowZipHelp(true)}
                            className="text-[10px] font-bold text-cyan-500 hover:text-cyan-400 underline flex items-center gap-1"
                        >
                            <Info size={10} /> {t.zipHierarchy}
                        </button>
                    </div>
                    <label className="relative group block cursor-pointer">
                        <input 
                            type="file" 
                            required
                            accept=".zip"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="sr-only"
                        />
                        <div className="w-full bg-black border-2 border-neutral-800 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center group-hover:border-cyan-500/50 group-hover:bg-neutral-900/50 transition-all">
                            {!importFile ? (
                                <>
                                    <div className="bg-neutral-900 p-4 rounded-full mb-4 border border-neutral-800 group-hover:border-cyan-500/30 transition-colors">
                                        <Upload size={32} className="text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-neutral-400 font-semibold group-hover:text-neutral-200">{t.clickToUpload}</span>
                                        <span className="text-neutral-600 text-xs">{t.zipNote}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-cyan-900/20 p-4 rounded-full mb-4 border border-cyan-500/30">
                                        <CheckCircle2 size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-cyan-400 font-bold">{importFile.name}</span>
                                        <span className="text-neutral-500 text-xs">{t.readyForImport}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </label>
                </div>
                <button 
                    type="submit"
                    disabled={importing || !importTurma || !importFile}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 text-black py-4 rounded-lg font-bold flex items-center justify-center gap-3 text-lg transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]"
                >
                    {importing ? <><Loader2 className="animate-spin" /> {t.importing}</> : <><Upload size={20} /> {t.importClass}</>}
                </button>
            </form>
          </div>
        ) : view === 'review' ? (
          <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
            {!currentStudent ? (
                <div className="flex-1 flex items-center justify-center text-neutral-600 italic">
                    {t.selectStudent}
                </div>
            ) : (
                <>
                <div className="flex justify-between items-center bg-neutral-900 p-4 rounded-lg border border-neutral-800 shadow-lg">
                    <div className="flex items-center gap-6">
                        <div className="flex gap-2">
                        <button 
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex(prev => prev - 1)}
                            className="p-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 disabled:opacity-20 hover:text-cyan-400 hover:border-cyan-500/50 active:scale-90 transition-all"
                        >
                            <ChevronLeft />
                        </button>
                        <button 
                            disabled={currentIndex === students.length - 1}
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                            className="p-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 disabled:opacity-20 hover:text-cyan-400 hover:border-cyan-500/50 active:scale-90 transition-all"
                        >
                            <ChevronRight />
                        </button>
                        </div>
                        <div>
                        <h2 className="text-lg font-semibold text-white">{currentStudent.name}</h2>
                        <p className="text-xs text-neutral-500 font-mono">{currentStudent.id} • {currentStudent.turma}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {questions.map(q => (
                        <button
                            key={q}
                            onClick={() => setCurrentQ(q)}
                            className={`px-4 py-2 rounded border border-transparent font-bold transition-all duration-200 active:scale-90 ${currentQ === q ? 'bg-cyan-500 !border-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-cyan-500/30 hover:text-cyan-400'}`}
                        >
                            Q{q}
                        </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 flex-1 overflow-hidden">
                    <div className="flex-1 bg-black rounded-lg overflow-hidden flex flex-col border border-neutral-800 shadow-inner">
                        <div className="bg-neutral-900/80 p-2 text-[10px] flex justify-between items-center border-b border-neutral-800">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded border border-neutral-800 mr-2">
                                <BookOpen size={10} className="text-cyan-500" />
                                <span className="truncate max-w-[200px] font-mono text-neutral-400">
                                    {statements[`q${currentQ}`] ? t.statementLoaded : t.noStatement}
                                </span>
                                <button 
                                    onClick={() => setShowStatementModal(true)}
                                    className="ml-1 text-cyan-500 hover:text-cyan-400 underline"
                                >
                                    {t.edit}
                                </button>
                            </div>
                            <span className="truncate max-w-md font-mono text-neutral-600">{currentStudent.questions[`q${currentQ}`]?.path || 'No file path'}</span>
                            {currentStudent.questions[`q${currentQ}`]?.path && (
                            <button 
                                onClick={() => copyToClipboard(currentStudent.questions[`q${currentQ}`].path!)}
                                className="hover:text-cyan-400 text-neutral-600 transition-colors"
                                title={t.copyPath}
                            >
                                <Copy size={12} />
                            </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {currentStudent.questions[`q${currentQ}`]?.path && (
                                <>
                                <button 
                                    onClick={handleAIAnalyze}
                                    className="flex items-center gap-2 bg-neutral-800 border border-cyan-500/50 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 px-3 py-1 rounded text-cyan-400 text-[10px] font-bold transition-all active:scale-95 group shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                                >
                                    <Sparkles size={10} className="fill-current" /> {t.aiAnalyze}
                                </button>
                                <button 
                                    onClick={() => setShowTerminal(true)}
                                    className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1 rounded text-gray-400 text-[10px] font-bold transition-all active:scale-95"
                                >
                                    <Play size={10} className="fill-current" /> {t.runCode}
                                </button>
                                </>
                            )}
                        </div>
                        </div>
                        <pre className="flex-1 overflow-auto m-0 text-sm leading-relaxed scrollbar-thin line-numbers">
                        <code className="language-cpp block p-4 min-h-full !py-4">
                            {code}
                        </code>
                        </pre>
                    </div>

                    <div className="w-80 bg-neutral-900 p-5 rounded-lg flex flex-col gap-5 border border-neutral-800 shadow-2xl">
                        <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">{t.score}</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={editScore}
                            onChange={(e) => setEditScore(Number(e.target.value))}
                            className="w-full bg-black border border-neutral-800 rounded p-3 text-cyan-400 font-bold focus:outline-none focus:border-cyan-500 transition-all"
                        />
                        </div>
                        <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">{t.feedbackComment}</label>
                        <textarea 
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            className="flex-1 w-full bg-black border border-neutral-800 rounded p-3 text-gray-300 focus:outline-none focus:border-cyan-500 resize-none text-sm transition-all"
                            placeholder={t.enterFeedback}
                        />
                        </div>
                        <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-neutral-800 border border-neutral-700 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                        >
                        <Save size={18} /> {saving ? t.saving : t.saveGrade}
                        </button>
                        
                        <div className="mt-2 pt-4 border-t border-neutral-800">
                        <div className="flex justify-between items-baseline mb-3">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{t.performance}</span>
                            <span className="text-xl font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{calculateTotal(currentStudent)}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {questions.map(q => (
                                <div key={q} className={`text-center text-[9px] font-bold p-1.5 rounded border ${currentQ === q ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'bg-black border-neutral-800 text-neutral-600'}`}>
                                Q{q}: {currentStudent.questions[`q${q}`]?.score || 0}
                                </div>
                            ))}
                        </div>
                        </div>
                    </div>
                </div>
                </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    {t.activeClass}: <span className="text-cyan-500">{selectedTurma}</span> • <span className="text-white">{students.filter(s => s.turma === selectedTurma).length}</span> {t.studentsCount}
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-green-500 transition-all active:scale-95 shadow-lg group"
                    >
                        <FileText size={14} className="group-hover:translate-y-0.5 transition-transform" />
                        {t.exportExcel}
                    </button>
                    <button 
                        onClick={handleExportGrades}
                        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500 transition-all active:scale-95 shadow-lg group"
                    >
                        <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                        {t.exportJson}
                    </button>
                    <div className="flex items-center bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden shadow-lg">
                        <label className="flex items-center gap-2 hover:bg-neutral-800 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500 cursor-pointer transition-all active:scale-95 group">
                            <Upload size={14} className="group-hover:animate-bounce" />
                            {t.importJson}
                            <input 
                                type="file" 
                                accept=".json" 
                                className="hidden" 
                                onChange={handleImportGrades}
                            />
                        </label>
                        <button 
                            onClick={() => setShowJsonHelp(true)}
                            className="px-3 py-2 border-l border-neutral-700 hover:bg-neutral-800 text-neutral-500 hover:text-cyan-400 transition-colors"
                            title={t.expectedJson}
                        >
                            <Info size={14} />
                        </button>
                    </div>
                </div>
            </div>
            <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
              <div className="overflow-x-auto max-h-[calc(100vh-180px)]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-800/50 border-b border-neutral-800">
                    <tr>
                      <th className="py-1 px-4 text-xs font-bold uppercase tracking-wider text-neutral-500">{t.studentName}</th>
                      {questions.map(q => (
                        <th key={q} className="py-1 px-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-center border-l border-neutral-800/50">Q{q}</th>
                      ))}
                      <th className="py-1 px-4 text-xs font-bold uppercase tracking-wider text-cyan-500 text-center border-l border-neutral-800">{t.total}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {students
                      .filter(s => s.turma === selectedTurma)
                      .map((s) => (
                      <tr 
                        key={s.id} 
                        className="hover:bg-cyan-500/5 transition-colors cursor-pointer group" 
                        onClick={() => { 
                          const globalIdx = students.findIndex(student => student.id === s.id);
                          setCurrentIndex(globalIdx); 
                          setView('review'); 
                        }}
                      >
                        <td className="py-1 px-4 border-r border-neutral-800/30">
                          <div className="font-bold text-neutral-300 group-hover:text-cyan-400 transition-colors text-sm">{s.name}</div>
                          <div className="text-[10px] text-neutral-600 font-mono">{s.id}</div>
                        </td>
                        {questions.map(q => (
                          <td key={q} className="py-1 px-4 text-center text-sm text-neutral-400 tabular-nums border-r border-neutral-800/30">{s.questions[`q${q}`]?.score || 0}</td>
                        ))}
                        <td className="py-1 px-4 text-center font-black text-white tabular-nums group-hover:text-cyan-400 transition-colors">{calculateTotal(s)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Statement Modal */}
      <Modal 
        isOpen={showStatementModal} 
        onClose={() => setShowStatementModal(false)}
        title={t.questionStatement}
        icon={BookOpen}
      >
        <p className="text-xs text-neutral-500 mb-4 italic">Paste the specific problem description for this question. This is required for AI Analysis.</p>
        <textarea 
            autoFocus
            defaultValue={statements[`q${currentQ}`] || ''}
            onBlur={(e) => saveStatement(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-lg p-4 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 min-h-[300px]"
            placeholder="Enter question prompt here..."
        />
        <div className="mt-6 flex justify-end">
            <button onClick={() => setShowStatementModal(false)} className="px-6 py-2 bg-cyan-500 text-black font-black uppercase tracking-widest text-xs rounded-lg active:scale-95 transition-all shadow-lg shadow-cyan-900/20">{t.closeSave}</button>
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
                <Loader2 size={48} className="text-cyan-500 animate-spin" />
                <div className="text-center">
                    <p className="text-white font-bold uppercase tracking-widest animate-pulse">{t.analyzingCode}</p>
                    <p className="text-xs text-neutral-500 mt-2">Connecting to {aiSettings.provider.toUpperCase()} system</p>
                </div>
            </div>
        ) : aiResult && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between bg-black p-4 rounded-lg border border-neutral-800">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t.proposedScore}</span>
                    <span className="text-4xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{aiResult.score}</span>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t.aiFeedback}</label>
                    <div className="bg-black border border-neutral-800 p-4 rounded-lg text-sm text-gray-300 leading-relaxed max-h-[200px] overflow-auto">
                        {aiResult.comment}
                    </div>
                </div>
                <div className="flex gap-4">
                     <button 
                        onClick={() => setShowAIPreviewModal(false)}
                        className="flex-1 px-4 py-3 border border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        {t.discard}
                    </button>
                    <button 
                        onClick={applyAIResult}
                        className="flex-2 px-8 py-3 bg-cyan-500 text-black font-black uppercase tracking-widest text-xs rounded-lg active:scale-95 transition-all shadow-lg shadow-cyan-900/40"
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
        <p className="text-xs text-neutral-400 mb-4 italic">
            The JSON should be an array of objects. The <span className="text-white font-bold">folder_name</span> must match the student's original folder.
        </p>
        <div className="bg-black rounded-lg p-4 font-mono text-[11px] text-cyan-400 border border-neutral-800 shadow-inner">
            <pre>{`[
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
        <div className="mt-4 p-3 bg-cyan-900/10 border border-cyan-900/30 rounded-lg">
            <p className="text-[10px] text-cyan-500/80 leading-relaxed">
                <span className="font-bold">Note:</span> Import will only update existing student records. Question paths and labels are preserved.
            </p>
        </div>
        <div className="mt-6 flex justify-end">
            <button 
                onClick={() => setShowJsonHelp(false)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all active:scale-95"
            >
                Got it
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
                <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wider">
                    <Monitor size={14} className="text-cyan-500" /> {t.installRun}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed pl-6">
                    Download Ollama from <a href="https://ollama.com" target="_blank" className="text-cyan-500 underline">ollama.com</a>. Once installed, ensure the Ollama application is running in your taskbar.
                </p>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wider">
                    <Cpu size={14} className="text-cyan-500" /> {t.downloadModel}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed pl-6 mb-2">
                    Open your terminal and pull the desired model (e.g., Llama 3.3):
                </p>
                <div className="bg-black rounded border border-neutral-800 p-3 ml-6">
                    <code className="text-[11px] text-cyan-400">ollama pull llama3.3</code>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 size={14} className="text-cyan-500" /> {t.verifyConnection}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed pl-6">
                    The Review App connects to <code className="text-cyan-500">http://localhost:11434</code>. If you see "Ollama is running" in your browser, you are ready!
                </p>
            </div>
        </div>
        <div className="mt-8 flex justify-end">
            <button 
                onClick={() => setShowOllamaHelp(false)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all active:scale-95"
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
        <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            {t.zipHierarchyDesc}
        </p>
        
        <div className="bg-black/50 border border-neutral-800 rounded-lg p-6 font-mono text-[11px] space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
                <FileText size={14} className="text-neutral-500" /> submissions.zip
            </div>
            <div className="pl-6 space-y-3 border-l border-neutral-800 ml-1.5">
                <div className="flex items-center gap-2 text-white">
                    <Folder size={14} className="text-cyan-500" /> {t.zipHierarchyQuestion} 1/
                </div>
                <div className="pl-6 space-y-3 border-l border-neutral-800 ml-1.5">
                    {/* Example 1: Simple */}
                    <div className="flex items-center gap-2 text-neutral-300">
                        <Folder size={14} className="text-neutral-500" /> {t.zipHierarchyStudent1}/
                    </div>
                    <div className="pl-6 flex items-center gap-2 text-cyan-500/80">
                        <FileText size={12} /> {t.zipHierarchyFile}
                    </div>
                    
                    {/* Example 2: With subfolder */}
                    <div className="flex items-center gap-2 text-neutral-300 mt-3">
                        <Folder size={14} className="text-neutral-500" /> {t.zipHierarchyStudent2}/
                    </div>
                    <div className="pl-6 space-y-1 border-l border-neutral-800 ml-1.5">
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Folder size={12} /> {t.zipHierarchyData}/
                        </div>
                        <div className="pl-6 flex items-center gap-2 text-cyan-500/80">
                            <FileText size={12} /> {t.zipHierarchyFile}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-white pt-2">
                    <Folder size={14} className="text-cyan-500" /> {t.zipHierarchyQuestion} 2/
                </div>
                <div className="pl-6 text-neutral-500 italic text-[10px]">
                    {t.zipHierarchyRepeated}
                </div>
            </div>
        </div>

        <div className="mt-6 flex justify-end">
            <button 
                onClick={() => setShowZipHelp(false)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all active:scale-95"
            >
                {t.cancel === 'Cancelar' ? 'Entendi' : 'Got it'}
            </button>
        </div>
      </Modal>

      {currentStudent && currentStudent.questions[`q${currentQ}`]?.path && (
        <TerminalPanel 
          isOpen={showTerminal}
          filePath={currentStudent.questions[`q${currentQ}`].path!} 
          onClose={() => setShowTerminal(false)} 
        />
      )}

      <Toaster 
        position="top-center" 
        toastOptions={{
          className: '',
          style: {
            background: '#000000',
            color: '#22d3ee',
            border: '#164e63 1px solid',
            boxShadow: '0 0 15px rgba(6,182,212,0.2)',
            fontSize: '14px',
            fontWeight: 'bold'
          },
          success: {
            iconTheme: {
              primary: '#22d3ee',
              secondary: '#000000',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#000000',
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
        @keyframes toast-enter {
          from { opacity: 0; transform: scale(0.9) translateY(-20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes toast-leave {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.95) translateY(-10px); }
        }
        pre[class*="language-"] {
          background: #000000 !important;
          margin: 0 !important;
        }
        pre code {
          font-family: 'Fira Code', 'Consolas', monospace !important;
          background: #000000 !important;
          color: #22d3ee !important;
        }
        .namespace { opacity: .7; }
        .token.string { color: #22c55e !important; }
        .token.comment { color: #525252 !important; }
        .token.keyword { color: #f43f5e !important; font-weight: bold; }
        .token.operator { color: #a3a3a3 !important; }
        .token.function { color: #38bdf8 !important; }
        .token.number { color: #fbbf24 !important; }

        /* Prism Line Numbers Custom Styles */
        .line-numbers .line-numbers-rows {
          border-right: 1px solid #262626 !important;
          padding-top: 1rem !important; /* Matches !py-4 on code tag */
          background: rgba(0,0,0,0.3);
        }
        .line-numbers-rows > span:before {
          color: #525252 !important;
          text-shadow: none !important;
        }
        pre[class*="language-"].line-numbers {
          padding-left: 3.5rem !important;
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #000000;
        }
        ::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #06b2d2;
          box-shadow: 0 0 10px rgba(6,182,212,0.5);
        }
      `}</style>
    </div>
  );
};

export default App;
