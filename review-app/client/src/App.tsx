import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Copy, Save, Table as TableIcon, FileText, CheckCircle2, Play, Upload, Plus, Trash2 } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import TerminalPanel from './components/TerminalPanel';
import toast, { Toaster } from 'react-hot-toast';

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

const API_BASE = 'http://localhost:3001/api';

const App = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState(1);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'review' | 'table' | 'import'>('review');
  const [saving, setSaving] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [showTerminal, setShowTerminal] = useState(false);

  const [editScore, setEditScore] = useState(0);
  const [editComment, setEditComment] = useState('');

  // Import State
  const [importTurma, setImportTurma] = useState('');
  const [folderTemplate, setFolderTemplate] = useState('[EMAIL] [NAME] [ID] [EMAIL]');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchStudents();
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

  useEffect(() => {
    Prism.highlightAll();
  }, [code]);

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
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Review App</h1>
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
        </div>
      </header>

      <main className="p-4">
        {view === 'import' ? (
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
                            <span className="truncate max-w-md font-mono text-neutral-500">{currentStudent.questions[`q${currentQ}`]?.path || 'No file path'}</span>
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
                        {currentStudent.questions[`q${currentQ}`]?.path && (
                            <button 
                            onClick={() => setShowTerminal(true)}
                            className="flex items-center gap-2 bg-neutral-800 hover:bg-cyan-500 hover:text-black border border-neutral-700 hover:border-cyan-400 px-3 py-1 rounded text-cyan-400 text-[10px] font-bold transition-all active:scale-95"
                            >
                            <Play size={10} className="fill-current" /> RUN CODE
                            </button>
                        )}
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
            border: '1px solid #164e63',
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
