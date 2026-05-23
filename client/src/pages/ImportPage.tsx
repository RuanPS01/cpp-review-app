import React, { useState } from 'react';
import { Upload, Info, CheckCircle2, Loader2, Globe } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface ImportPageProps {
  t: any;
  setShowZipHelp: (show: boolean) => void;
  onImportSuccess: () => Promise<void>;
  setView: (view: 'review' | 'table' | 'import' | 'settings') => void;
  setShowMoodleModal: (show: boolean) => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ t, setShowZipHelp, onImportSuccess, setView, setShowMoodleModal }) => {
  const [importTurma, setImportTurma] = useState('');
  const [folderTemplate, setFolderTemplate] = useState('[EMAIL] [NAME] [ID] [EMAIL]');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTurma || !importFile) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('turma', importTurma);
    formData.append('folderTemplate', folderTemplate);
    formData.append('file', importFile);

    try {
      await api.importTurma(formData);
      toast.success(t.importSuccess);
      setImportTurma('');
      setImportFile(null);
      await onImportSuccess();
      setView('table');
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-6 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Moodle Section */}
        <div className="bg-panel p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-border-main relative overflow-hidden group flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Globe size={240} className="text-accent" />
            </div>
            
            <div>
                <h2 className="text-3xl font-black mb-4 flex items-center gap-4 text-text-bright uppercase tracking-tighter">
                    <div className="bg-accent/10 p-3 rounded-lg border border-accent/20">
                        <Globe size={32} className="text-accent drop-shadow-[0_0_8px_var(--accent-glow)]" />
                    </div>
                    {t.importFromMoodle}
                </h2>
                <p className="text-sm text-text-dim mb-10 leading-relaxed max-w-md">
                    Sincronize automaticamente as atividades VPL, enunciados e submissões dos alunos diretamente do Moodle. 
                    Ideal para turmas grandes e avaliações oficiais.
                </p>
            </div>

            <button 
                onClick={() => setShowMoodleModal(true)}
                className="w-full bg-accent hover:bg-accent/80 text-black py-5 rounded-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-[0_0_30px_var(--accent-glow)] text-lg"
            >
                <Globe size={24} /> {t.startImport}
            </button>
        </div>

        {/* ZIP Section */}
        <div className="bg-panel p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-border-main flex flex-col">
            <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-text-bright uppercase tracking-tighter">
                <div className="bg-button p-2 rounded border border-border-main">
                    <Upload size={20} className="text-text-dim" />
                </div>
                {t.importClass}
            </h2>
            <form onSubmit={handleImport} className="flex flex-col gap-5 flex-1">
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-text-dim">{t.classIdentifier}</label>
                        <input 
                            type="text" 
                            required
                            value={importTurma}
                            onChange={(e) => setImportTurma(e.target.value)}
                            placeholder="Ex: Prova 1"
                            className="w-full bg-input border border-border-main rounded-lg p-3 text-sm text-text-main focus:outline-none focus:border-accent transition-all shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-text-dim">{t.folderTemplate}</label>
                        <input 
                            type="text" 
                            required
                            value={folderTemplate}
                            onChange={(e) => setFolderTemplate(e.target.value)}
                            className="w-full bg-input border border-border-main rounded-lg p-3 text-accent font-mono text-xs focus:outline-none focus:border-accent transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-end mb-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-dim">{t.submissionsZip}</label>
                        <button 
                            type="button"
                            onClick={() => setShowZipHelp(true)}
                            className="text-[9px] font-black text-accent hover:text-accent/80 underline flex items-center gap-1 uppercase tracking-widest"
                        >
                            <Info size={10} /> {t.zipHierarchy}
                        </button>
                    </div>
                    <label className="relative group block cursor-pointer flex-1 min-h-[140px]">
                        <input 
                            type="file" 
                            required
                            accept=".zip"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="sr-only"
                        />
                        <div className="w-full h-full bg-input border-2 border-border-main border-dashed rounded-xl flex flex-col items-center justify-center text-center group-hover:border-accent/50 group-hover:bg-panel transition-all p-4 shadow-inner">
                            {!importFile ? (
                                <>
                                    <div className="bg-panel p-3 rounded-full mb-3 border border-border-main group-hover:border-accent/30 transition-colors">
                                        <Upload size={24} className="text-text-dim group-hover:text-accent transition-colors" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-text-dim font-black uppercase tracking-widest text-[10px] group-hover:text-text-main">{t.clickToUpload}</span>
                                        <span className="text-text-dim text-[9px] opacity-60 uppercase tracking-tighter">{t.zipNote}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-accent/10 p-3 rounded-full mb-3 border border-accent/30">
                                        <CheckCircle2 size={24} className="text-accent drop-shadow-[0_0_8px_var(--accent-glow)]" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-accent font-black uppercase tracking-tight text-sm truncate max-w-[200px]">{importFile.name}</span>
                                        <span className="text-text-dim text-[9px] font-black uppercase tracking-widest">{t.readyForImport}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </label>
                </div>
                
                <button 
                    type="submit"
                    disabled={importing || !importTurma || !importFile}
                    className="w-full bg-button hover:bg-panel disabled:opacity-30 text-text-bright border border-border-main hover:border-accent/50 py-4 rounded-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 text-xs transition-all active:scale-[0.98] mt-2"
                >
                    {importing ? <><Loader2 className="animate-spin" /> {t.importing}</> : <><Upload size={18} /> {t.importClass}</>}
                </button>
            </form>
        </div>
      </div>
      
      <div className="flex justify-center">
          <div className="bg-panel/50 border border-border-main px-4 py-2 rounded-full flex items-center gap-4 text-[10px] font-bold text-text-dim">
              <Info size={14} className="text-accent" />
              <span>DICA: Use o Moodle para sincronização automática de enunciados e testes.</span>
          </div>
      </div>
    </div>
  );
};

export default ImportPage;
