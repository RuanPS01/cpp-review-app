import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Copy, Save, Table as TableIcon, FileText, CheckCircle2 } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';

interface Question {
  score: number;
  comment: string;
  path: string | null;
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
  const [view, setView] = useState<'review' | 'table'>('review');
  const [saving, setSaving] = useState(false);

  const [editScore, setEditScore] = useState(0);
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (students.length > 0 && view === 'review') {
      const student = students[currentIndex];
      const q = student.questions[`q${currentQ}`];
      setEditScore(q.score);
      setEditComment(q.comment);
      if (q.path) {
        fetchCode(q.path);
      } else {
        setCode('// No file found for this question');
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
    }
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
      
    } catch (err) {
      alert('Error saving grade');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Path copied to clipboard');
  };

  const calculateTotal = (student: Student) => {
    return Object.values(student.questions).reduce((acc, q) => acc + q.score, 0);
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  const currentStudent = students[currentIndex];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold">C02 Grade Reviewer</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('review')}
            className={`flex items-center gap-2 px-4 py-2 rounded ${view === 'review' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            <FileText size={18} /> Review
          </button>
          <button 
            onClick={() => setView('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded ${view === 'table' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            <TableIcon size={18} /> Grades Table
          </button>
        </div>
      </header>

      <main className="p-4">
        {view === 'review' ? (
          <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-4">
                <button 
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="p-2 bg-gray-700 rounded disabled:opacity-30 hover:bg-gray-600"
                >
                  <ChevronLeft />
                </button>
                <div>
                  <h2 className="text-lg font-semibold">{currentStudent.name} ({currentStudent.turma})</h2>
                  <p className="text-xs text-gray-400">{currentStudent.id}</p>
                </div>
                <button 
                  disabled={currentIndex === students.length - 1}
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="p-2 bg-gray-700 rounded disabled:opacity-30 hover:bg-gray-600"
                >
                  <ChevronRight />
                </button>
              </div>

              <div className="flex gap-2">
                {[1, 2, 3, 4].map(q => (
                  <button
                    key={q}
                    onClick={() => setCurrentQ(q)}
                    className={`px-4 py-2 rounded font-bold ${currentQ === q ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    Q{q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 flex-1 overflow-hidden">
              <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden flex flex-col border border-gray-700">
                <div className="bg-gray-700 p-2 text-xs flex justify-between items-center">
                  <span className="truncate">{currentStudent.questions[`q${currentQ}`].path || 'No file path'}</span>
                  {currentStudent.questions[`q${currentQ}`].path && (
                    <button 
                      onClick={() => copyToClipboard(currentStudent.questions[`q${currentQ}`].path!)}
                      className="flex items-center gap-1 hover:text-blue-400"
                    >
                      <Copy size={14} /> Copy Path
                    </button>
                  )}
                </div>
                <pre className="flex-1 overflow-auto p-4 m-0 text-sm">
                  <code className="language-cpp">
                    {code}
                  </code>
                </pre>
              </div>

              <div className="w-80 bg-gray-800 p-4 rounded-lg flex flex-col gap-4 border border-gray-700 shadow-xl">
                <div>
                  <label className="block text-sm font-medium mb-1">Score</label>
                  <input 
                    type="number" 
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium mb-1">Comment</label>
                  <textarea 
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="flex-1 w-full bg-gray-700 border border-gray-600 rounded p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    placeholder="Enter feedback..."
                  />
                </div>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 py-3 rounded font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Save size={18} /> {saving ? 'Saving...' : 'Save Grade'}
                </button>
                
                <div className="mt-4 pt-4 border-t border-gray-700">
                   <h3 className="text-sm font-bold mb-2">Total: {calculateTotal(currentStudent)} | Média: {(calculateTotal(currentStudent) / 4).toFixed(1)}</h3>
                   <div className="grid grid-cols-4 gap-1">
                      {[1,2,3,4].map(q => (
                        <div key={q} className={`text-center text-[10px] p-1 rounded ${currentQ === q ? 'bg-blue-900 ring-1 ring-blue-500' : 'bg-gray-900'}`}>
                          Q{q}: {currentStudent.questions[`q${q}`].score}
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
            <div className="overflow-x-auto max-h-[calc(100vh-120px)]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-700 sticky top-0">
                  <tr>
                    <th className="p-3 border-b border-gray-600">Turma</th>
                    <th className="p-3 border-b border-gray-600">Student Name</th>
                    <th className="p-3 border-b border-gray-600 text-center">Q1</th>
                    <th className="p-3 border-b border-gray-600 text-center">Q2</th>
                    <th className="p-3 border-b border-gray-600 text-center">Q3</th>
                    <th className="p-3 border-b border-gray-600 text-center">Q4</th>
                    <th className="p-3 border-b border-gray-600 text-center font-bold">Total</th>
                    <th className="p-3 border-b border-gray-600 text-center font-bold text-green-400">Média</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {students.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-700 transition-colors cursor-pointer" onClick={() => { setCurrentIndex(idx); setView('review'); }}>
                      <td className="p-3 text-center">{s.turma}</td>
                      <td className="p-3">{s.name}</td>
                      <td className="p-3 text-center">{s.questions.q1.score}</td>
                      <td className="p-3 text-center">{s.questions.q2.score}</td>
                      <td className="p-3 text-center">{s.questions.q3.score}</td>
                      <td className="p-3 text-center">{s.questions.q4.score}</td>
                      <td className="p-3 text-center font-bold text-blue-400">{calculateTotal(s)}</td>
                      <td className="p-3 text-center font-bold text-green-400">{(calculateTotal(s) / 4).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      
      <style>{`
        pre code {
          font-family: 'Fira Code', 'Consolas', monospace !important;
          background: transparent !important;
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1a202c;
        }
        ::-webkit-scrollbar-thumb {
          background: #4a5568;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #718096;
        }
      `}</style>
    </div>
  );
};

export default App;
