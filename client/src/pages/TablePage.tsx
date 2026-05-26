import React from 'react';
import { FileText, Download, Upload, Info, Pencil, CheckCircle2, Sparkles } from 'lucide-react';
import type { Student } from '../types';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import GlobalAIAnalysisView from '../components/GlobalAIAnalysisView';

interface TablePageProps {
  students: Student[];
  selectedTurma: string;
  calculateTotal: (student: Student) => string;
  calculateClassAverage: () => string;
  setCurrentIndex: (index: number) => void;
  setView: (view: 'review' | 'table' | 'import' | 'settings') => void;
  fetchStudents: () => Promise<void>;
  setShowJsonHelp: (show: boolean) => void;
  setEditingStudent: (student: Student) => void;
  setShowEditStudentModal: (show: boolean) => void;
  t: any;
  globalAI: any;
}

const TablePage: React.FC<TablePageProps> = ({ 
  students, 
  selectedTurma, 
  calculateTotal, 
  calculateClassAverage, 
  setCurrentIndex, 
  setView,
  fetchStudents,
  setShowJsonHelp,
  setEditingStudent,
  setShowEditStudentModal,
  t,
  globalAI
}) => {
  const safeStudents = Array.isArray(students) ? students : [];
  const classStudents = safeStudents.filter(s => s.turma === selectedTurma);
  const questions = Array.from(new Set(
    classStudents.flatMap(s => Object.keys(s.questions).map(k => parseInt(k.replace('q', ''))))
  )).sort((a, b) => a - b);

  if (globalAI.isActive) {
    return (
        <GlobalAIAnalysisView 
            items={globalAI.items}
            isAnalyzing={globalAI.isAnalyzing}
            progress={globalAI.progress}
            onlyUnreviewed={globalAI.onlyUnreviewed}
            setOnlyUnreviewed={globalAI.setOnlyUnreviewed}
            showConfirm={globalAI.showConfirm}
            selectedTurma={selectedTurma}
            onStart={globalAI.startAnalysis}
            onCancel={globalAI.cancelAnalysis}
            onResume={globalAI.resumePendingAnalysis}
            onBack={() => globalAI.setIsActive(false)}
            onRetry={globalAI.retryItem}
            onRetryAllErrors={globalAI.retryAllErrors}
            onRetryRemaining={globalAI.retryAllRemaining}
            onApplyAll={globalAI.applyAll}
            t={t}
        />
    );
  }

  const handleExportExcel = () => {
    const questionKeys = Array.from(new Set(
      classStudents.flatMap(s => Object.keys(s.questions))
    )).sort((a, b) => {
        const numA = parseInt(a.replace('q', ''));
        const numB = parseInt(b.replace('q', ''));
        return numA - numB;
    });

    const headers = [
        'ID (Matrícula)',
        'Nome completo',
        ...questionKeys.map(k => k.toUpperCase()),
        'Média',
        'Comentários'
    ];

    const rows = classStudents.map((s, rowIndex) => {
        let cleanId = s.id;
        const numbers = s.id.match(/\d+/g);
        if (numbers && numbers.length > 0) {
            if (s.id.includes('@') || s.id.split(' ').length > 1) {
                cleanId = numbers[0];
            }
        }

        const studentRow: any = {
            'ID (Matrícula)': cleanId,
            'Nome completo': s.name
        };

        questionKeys.forEach(k => {
            studentRow[k.toUpperCase()] = s.questions[k]?.score || 0;
        });

        const startCol = 2; // Col C
        const endCol = startCol + questionKeys.length - 1;
        const startRef = XLSX.utils.encode_col(startCol) + (rowIndex + 2);
        const endRef = XLSX.utils.encode_col(endCol) + (rowIndex + 2);
        
        studentRow['Média'] = { f: `AVERAGE(${startRef}:${endRef})` };

        studentRow['Comentários'] = Object.entries(s.questions)
            .map(([qKey, qData]) => `${qKey.toUpperCase()}: ${qData.comment || ''}`)
            .filter(c => !c.endsWith(': '))
            .join(' | ');

        return studentRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

    const wscols = [
        { wch: 15 }, // ID
        { wch: 40 }, // Name
        ...questionKeys.map(() => ({ wch: 8 })), // Questions
        { wch: 10 }, // Average
        { wch: 60 }  // Comments
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Grades");
    XLSX.writeFile(workbook, `grades_${selectedTurma}.xlsx`);
    toast.success(t.exportExcel + '...');
  };

  const handleExportGrades = async () => {
    try {
      const res = await api.exportGrades(selectedTurma);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", `grades_${selectedTurma}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success(`Exporting grades for ${selectedTurma}...`);
    } catch {
      toast.error('Failed to export grades.');
    }
  };

  const handleImportGrades = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTurma) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const grades = JSON.parse(event.target?.result as string);
        await api.importGrades(selectedTurma, grades);
        toast.success(`Grades for ${selectedTurma} imported successfully!`);
        await fetchStudents();
      } catch {
        toast.error('Failed to import grades. Ensure the JSON format is correct.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center px-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              {t.activeClass}: <span className="text-accent">{selectedTurma}</span> • <span className="text-text-bright">{classStudents.length}</span> {t.studentsCount} • {t.classAverage}: <span className="text-accent drop-shadow-[0_0_5px_var(--accent-glow)]">{calculateClassAverage()}</span>
          </div>
          <div className="flex gap-2">
              <button 
                  onClick={() => globalAI.initAnalysis(students)}
                  className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-accent transition-all active:scale-95 shadow-lg group"
              >
                  <Sparkles size={14} className="group-hover:rotate-12 transition-transform fill-current" />
                  {t.globalAiAnalyze}
              </button>
              <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-panel hover:bg-button border border-border-main px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-green-500 transition-all active:scale-95 shadow-lg group"
              >
                  <FileText size={14} className="group-hover:translate-y-0.5 transition-transform" />
                  {t.exportExcel}
              </button>
              <button 
                  onClick={handleExportGrades}
                  className="flex items-center gap-2 bg-panel hover:bg-button border border-border-main px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-accent transition-all active:scale-95 shadow-lg group"
              >
                  <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                  {t.exportJson}
              </button>
              <div className="flex items-center bg-panel rounded-lg border border-border-main overflow-hidden shadow-lg">
                  <label className="flex items-center gap-2 hover:bg-button px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent cursor-pointer transition-all active:scale-95 group">
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
                      className="px-3 py-2 border-l border-border-main hover:bg-button text-text-dim hover:text-accent transition-colors"
                      title={t.expectedJson}
                  >
                      <Info size={14} />
                  </button>
              </div>
          </div>
      </div>
      <div className="bg-panel rounded-xl overflow-hidden border border-border-main shadow-2xl">
        <div className="overflow-x-auto max-h-[calc(100vh-180px)]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-button/50 border-b border-border-main">
              <tr>
                <th className="py-1 px-2 text-xs font-bold uppercase tracking-wider text-text-dim text-center w-10"></th>
                <th className="py-1 px-4 text-xs font-bold uppercase tracking-wider text-text-dim">{t.studentName}</th>
                {questions.map(q => (
                  <th key={q} className="py-1 px-2 text-xs font-bold uppercase tracking-wider text-text-dim text-center border-l border-border-main/50">Q{q}</th>
                ))}
                <th className="py-1 px-2 text-xs font-bold uppercase tracking-wider text-accent text-center border-l border-border-main">{t.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/50">
              {classStudents.map((s) => {
                const total = Number(calculateTotal(s));
                const isFullyReviewed = s.reviewed || Object.values(s.questions).every(q => q.reviewed || !q.path);
                
                return (
                  <tr 
                    key={s.id} 
                    className="hover:bg-accent/5 transition-colors cursor-pointer group" 
                    onClick={() => { 
                      const globalIdx = students.findIndex(student => student.id === s.id);
                      setCurrentIndex(globalIdx); 
                      setView('review'); 
                    }}
                  >
                    <td className="py-1 px-2 text-center border-r border-border-main/30">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingStudent(s);
                          setShowEditStudentModal(true);
                        }}
                        className="p-1.5 text-text-dim hover:text-accent hover:bg-button rounded-md transition-all"
                        title="Editar Aluno"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                    <td className="py-1 px-4 border-r border-border-main/30">
                      <div className="flex items-center gap-2">
                          <div className="font-bold text-text-main group-hover:text-accent transition-colors text-sm">{s.name}</div>
                          {isFullyReviewed && (
                              <CheckCircle2 size={14} className="text-accent flex-shrink-0" />
                          )}
                      </div>
                      <div className="text-[10px] text-text-dim font-mono">{s.id}</div>
                    </td>
                    {questions.map(q => (
                      <td key={q} className="py-1 px-2 text-center text-sm text-text-dim tabular-nums border-r border-border-main/30">{s.questions[`q${q}`]?.score || 0}</td>
                    ))}
                    <td className={`py-1 px-2 text-center font-black tabular-nums transition-colors ${
                      total === 100
                        ? 'text-text-bright'
                        : total < 50 
                          ? 'text-red-500' 
                          : total < 60 
                            ? 'text-yellow-500' 
                            : 'text-green-500'
                    }`}>
                      {calculateTotal(s)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TablePage;
