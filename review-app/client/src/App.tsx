import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ChevronLeft, ChevronRight, Copy, Save, Table as TableIcon, 
  FileText, CheckCircle2, Play, Upload, Plus, Trash2, 
  Settings, Bot, Sparkles, BookOpen, X, Loader2
} from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import TerminalPanel from './components/TerminalPanel';
import toast, { Toaster } from 'react-hot-toast';

// Recommended Models Constant
const RECOMMENDED_MODELS: Record<string, string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5', 'gpt-4o', 'gpt-4-turbo'],
  gemini: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
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

  const [editScore, setEditScore] = useState(0);
  const [editComment, setEditComment] = useState('');

  // AI State
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'ollama',
    ollamaModel: 'llama3',
    cloudModel: 'gemini-1.5-flash',
    cloudKey: '',
    evaluationCriteria: ''
  });
  const [isCustomModel, setIsCustomModel] = useState(false);
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

  // Update isCustomModel when settings are loaded
  useEffect(() => {
    if (aiSettings.provider !== 'ollama') {
      const recommendations = RECOMMENDED_MODELS[aiSettings.provider] || [];
      const isPredefined = recommendations.includes(aiSettings.cloudModel);
      setIsCustomModel(!isPredefined && aiSettings.cloudModel !== '');
    }
  }, [aiSettings.provider, aiSettings.cloudModel]);

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
      toast.success('AI settings saved');
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
      toast.success('Question statement saved');
      setShowStatementModal(false);
    } catch (err) {
      toast.error('Failed to save statement');
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
      toast.success('AI feedback applied locally (unsaved)');
    }
  };

  const handleClearTurma = async (turmaName: string) => {
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in zoom-in duration-200' : 'animate-out fade-out zoom-out duration-150'
        } max-w-md w-full bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-xl pointer-events-auto flex flex-col p-6 border border-neutral-800 mx-auto`}
        style={{
            animation: t.visible 
                ? 'toast-enter 0.3s ease-out forwards' 
                : 'toast-leave 0.2s ease-in forwards'
        }}
      >
        <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-950/20 p-2 rounded-lg border border-red-900/30">
                <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Clear System Data?</h3>
        </div>
        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
          You are about to permanently delete all records for <span className="text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">{turmaName}</span>. This action cannot be reversed.
        </p>
        <div className="flex gap-4 justify-end">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await axios.delete(`${API_BASE}/turma/${turmaName}`);
                toast.success('Data cleared successfully');
                if (selectedTurma === turmaName) {
                  setSelectedTurma('');
                }
                await fetchStudents();
              } catch (err) {
                toast.error('Failed to clear data');
              }
            }}
            className="px-6 py-2 bg-neutral-900 border border-red-900/50 hover:bg-red-600 hover:border-red-500 text-red-500 hover:text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-lg shadow-red-900/10"
          >
            Confirm Delete
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
      toast.success('Grade saved successfully');
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
      toast.success('Import successful!');
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Path copied to clipboard');
  };

  const calculateTotal = (student: Student) => {
    return Object.values(student.questions).reduce((acc, q) => acc + q.score, 0);
  };

  if (loading) return <div className="p-10 text-center text-cyan-500 font-bold animate-pulse">LOADING SYSTEM...</div>;

  const turmas = Array.from(new Set(students.map(s => s.turma)));
  const currentStudent = students[currentIndex];
  const questions = currentStudent ? Object.keys(currentStudent.questions).map(k => parseInt(k.replace('q', ''))) : [];
  questions.sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans">
      <header className="bg-neutral-900 p-4 border-b border-neutral-800 flex justify-between items-center sticky top-0 z-10 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] cursor-pointer" onClick={() => setView('review')}>Review App</h1>
            {turmas.length > 0 && (
                <div className="flex gap-2 ml-4">
                    {turmas.map(t => (
                        <div key={t} className="flex items-center bg-neutral-800 rounded overflow-hidden border border-neutral-700 transition-all active:scale-95">
                            <button
                                onClick={() => {
                                    setSelectedTurma(t);
                                    const firstIdx = students.findIndex(s => s.turma === t);
                                    setCurrentIndex(firstIdx);
                                }}
                                className={`px-3 py-1 text-xs font-bold transition-all ${selectedTurma === t ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-gray-400 hover:bg-neutral-700'}`}
                            >
                                {t}
                            </button>
                            <button 
                                onClick={() => handleClearTurma(t)}
                                className="px-2 py-1 text-neutral-600 hover:text-red-500 hover:bg-neutral-700 transition-colors border-l border-neutral-700"
                                title="Clear Data"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('review')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'review' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <FileText size={18} /> Review
          </button>
          <button 
            onClick={() => setView('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'table' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <TableIcon size={18} /> Table
          </button>
          <button 
            onClick={() => setView('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'import' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <Plus size={18} /> Import
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-transparent transition-all duration-200 active:scale-95 ${view === 'settings' ? 'bg-cyan-500 !border-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:border-cyan-500/50 hover:text-cyan-400'}`}
          >
            <Settings size={18} /> AI Settings
          </button>
        </div>
      </header>

      <main className="p-4">
        {view === 'settings' ? (
          <div className="max-w-3xl mx-auto mt-10 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-white">
                <Settings className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" /> AI Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">AI Provider</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['ollama', 'openai', 'gemini', 'claude'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        const newProvider = p as any;
                                        const defaultModel = newProvider === 'ollama' ? 'llama3' : RECOMMENDED_MODELS[newProvider][0];
                                        setAiSettings({ 
                                            ...aiSettings, 
                                            provider: newProvider,
                                            cloudModel: newProvider === 'ollama' ? aiSettings.cloudModel : defaultModel
                                        });
                                        setIsCustomModel(false);
                                    }}
                                    className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${aiSettings.provider === p ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-black text-neutral-500 border-neutral-800 hover:border-neutral-600'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {aiSettings.provider === 'ollama' ? (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Ollama Model</label>
                            <input 
                                type="text"
                                value={aiSettings.ollamaModel}
                                onChange={(e) => setAiSettings({ ...aiSettings, ollamaModel: e.target.value })}
                                className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500"
                                placeholder="e.g. llama3, mistral"
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Cloud Model</label>
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
                                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">API Key</label>
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
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Global Evaluation Criteria</label>
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
                <Save size={20} /> Save Configuration
            </button>
          </div>
        ) : view === 'import' ? (
          <div className="max-w-xl mx-auto mt-10 bg-neutral-900 p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                <Upload className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" /> Import New Class
            </h2>
            <form onSubmit={handleImport} className="flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-400">Class Identifier</label>
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
                    <label className="block text-sm font-medium mb-2 text-neutral-400">Folder Name Template</label>
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
                    <label className="block text-sm font-medium mb-2 text-neutral-400">Submissions ZIP</label>
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
                                        <span className="text-neutral-400 font-semibold group-hover:text-neutral-200">Click to upload or drag and drop</span>
                                        <span className="text-neutral-600 text-xs">ZIP file containing question folders</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-cyan-900/20 p-4 rounded-full mb-4 border border-cyan-500/30">
                                        <CheckCircle2 size={32} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-cyan-400 font-bold">{importFile.name}</span>
                                        <span className="text-neutral-500 text-xs">Ready for import</span>
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
                    {importing ? 'Processing...' : (
                        <><Upload size={20} /> Import Class</>
                    )}
                </button>
            </form>
          </div>
        ) : view === 'review' ? (
          <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
            {!currentStudent ? (
                <div className="flex-1 flex items-center justify-center text-neutral-600 italic">
                    Select a student from the table or import a class to begin.
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
                                    {statements[`q${currentQ}`] ? 'Statement Loaded' : 'No Statement'}
                                </span>
                                <button 
                                    onClick={() => setShowStatementModal(true)}
                                    className="ml-1 text-cyan-500 hover:text-cyan-400 underline"
                                >
                                    Edit
                                </button>
                            </div>
                            <span className="truncate max-w-md font-mono text-neutral-600">{currentStudent.questions[`q${currentQ}`]?.path || 'No file path'}</span>
                            {currentStudent.questions[`q${currentQ}`]?.path && (
                            <button 
                                onClick={() => copyToClipboard(currentStudent.questions[`q${currentQ}`].path!)}
                                className="hover:text-cyan-400 text-neutral-600 transition-colors"
                                title="Copy Path"
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
                                    <Sparkles size={10} className="fill-current" /> AI ANALYZE
                                </button>
                                <button 
                                    onClick={() => setShowTerminal(true)}
                                    className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1 rounded text-gray-400 text-[10px] font-bold transition-all active:scale-95"
                                >
                                    <Play size={10} className="fill-current" /> RUN CODE
                                </button>
                                </>
                            )}
                        </div>
                        </div>
                        <pre className="flex-1 overflow-auto p-6 m-0 text-sm leading-relaxed">
                        <code className="language-cpp">
                            {code}
                        </code>
                        </pre>
                    </div>

                    <div className="w-80 bg-neutral-900 p-5 rounded-lg flex flex-col gap-5 border border-neutral-800 shadow-2xl">
                        <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Score</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={editScore}
                            onChange={(e) => setEditScore(Number(e.target.value))}
                            className="w-full bg-black border border-neutral-800 rounded p-3 text-cyan-400 font-bold focus:outline-none focus:border-cyan-500 transition-all"
                        />
                        </div>
                        <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Feedback Comment</label>
                        <textarea 
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            className="flex-1 w-full bg-black border border-neutral-800 rounded p-3 text-gray-300 focus:outline-none focus:border-cyan-500 resize-none text-sm transition-all"
                            placeholder="Enter feedback..."
                        />
                        </div>
                        <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-neutral-800 border border-neutral-700 hover:bg-cyan-500 hover:text-black hover:border-cyan-400 py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                        >
                        <Save size={18} /> {saving ? 'SAVING...' : 'SAVE GRADE'}
                        </button>
                        
                        <div className="mt-2 pt-4 border-t border-neutral-800">
                        <div className="flex justify-between items-baseline mb-3">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Performance</span>
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
            <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
              <div className="overflow-x-auto max-h-[calc(100vh-180px)]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-800/50 border-b border-neutral-800">
                    <tr>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Student Name</th>
                      {questions.map(q => (
                        <th key={q} className="p-4 text-xs font-bold uppercase tracking-wider text-neutral-500 text-center border-l border-neutral-800/50">Q{q}</th>
                      ))}
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-cyan-500 text-center border-l border-neutral-800">Total</th>
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
                        <td className="p-4 border-r border-neutral-800/30">
                          <div className="font-bold text-neutral-300 group-hover:text-cyan-400 transition-colors">{s.name}</div>
                          <div className="text-[10px] text-neutral-600 font-mono mt-0.5">{s.id}</div>
                        </td>
                        {questions.map(q => (
                          <td key={q} className="p-4 text-center text-sm text-neutral-400 tabular-nums border-r border-neutral-800/30">{s.questions[`q${q}`]?.score || 0}</td>
                        ))}
                        <td className="p-4 text-center font-black text-white tabular-nums group-hover:text-cyan-400 transition-colors">{calculateTotal(s)}</td>
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
      {showStatementModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-neutral-900 w-full max-w-2xl rounded-xl border border-neutral-800 shadow-2xl flex flex-col">
             <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-black">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <BookOpen size={16} className="text-cyan-500" /> Question Q{currentQ} Statement
                </h3>
                <button onClick={() => setShowStatementModal(false)} className="text-neutral-500 hover:text-white"><X size={20} /></button>
             </div>
             <div className="p-6">
                <p className="text-xs text-neutral-500 mb-4 italic">Paste the specific problem description for this question. This is required for AI Analysis.</p>
                <textarea 
                    autoFocus
                    defaultValue={statements[`q${currentQ}`] || ''}
                    onBlur={(e) => saveStatement(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-lg p-4 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 min-h-[300px]"
                    placeholder="Enter question prompt here..."
                />
             </div>
             <div className="p-4 border-t border-neutral-800 flex justify-end">
                <button onClick={() => setShowStatementModal(false)} className="px-6 py-2 bg-cyan-500 text-black font-black uppercase tracking-widest text-xs rounded-lg active:scale-95 transition-all shadow-lg shadow-cyan-900/20">Close & Save</button>
             </div>
          </div>
        </div>
      )}

      {/* AI Preview Modal */}
      {showAIPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-neutral-900 w-full max-w-2xl rounded-xl border border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
             <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-black">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Sparkles size={16} className="text-cyan-500" /> AI Review Proposal
                </h3>
                {!analyzing && <button onClick={() => setShowAIPreviewModal(false)} className="text-neutral-500 hover:text-white"><X size={20} /></button>}
             </div>
             <div className="p-8 flex flex-col">
                {analyzing ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 size={48} className="text-cyan-500 animate-spin" />
                        <div className="text-center">
                            <p className="text-white font-bold uppercase tracking-widest animate-pulse">Analyzing Code...</p>
                            <p className="text-xs text-neutral-500 mt-2">Connecting to {aiSettings.provider.toUpperCase()} system</p>
                        </div>
                    </div>
                ) : aiResult && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between bg-black p-4 rounded-lg border border-neutral-800">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Proposed Score</span>
                            <span className="text-4xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{aiResult.score}</span>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">AI Feedback</label>
                            <div className="bg-black border border-neutral-800 p-4 rounded-lg text-sm text-gray-300 leading-relaxed max-h-[200px] overflow-auto">
                                {aiResult.comment}
                            </div>
                        </div>
                        <div className="flex gap-4">
                             <button 
                                onClick={() => setShowAIPreviewModal(false)}
                                className="flex-1 px-4 py-3 border border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={applyAIResult}
                                className="flex-2 px-8 py-3 bg-cyan-500 text-black font-black uppercase tracking-widest text-xs rounded-lg active:scale-95 transition-all shadow-lg shadow-cyan-900/40"
                            >
                                Apply AI Feedback
                            </button>
                        </div>
                    </div>
                )}
             </div>
          </div>
        </div>
      )}

      {showTerminal && currentStudent && currentStudent.questions[`q${currentQ}`]?.path && (
        <TerminalPanel 
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
        @keyframes toast-enter {
          from { opacity: 0; transform: scale(0.9) translateY(-20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes toast-leave {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.95) translateY(-10px); }
        }
        pre code {
          font-family: 'Fira Code', 'Consolas', monospace !important;
          background: transparent !important;
          color: #22d3ee !important;
        }
        .namespace { opacity: .7; }
        .token.string { color: #22c55e !important; }
        .token.comment { color: #525252 !important; }
        .token.keyword { color: #f43f5e !important; font-weight: bold; }
        .token.operator { color: #a3a3a3 !important; }
        .token.function { color: #38bdf8 !important; }
        .token.number { color: #fbbf24 !important; }

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
