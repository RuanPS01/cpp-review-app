import React, { useState } from 'react';
import { Upload, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface ImportPageProps {
  t: any;
  setShowZipHelp: (show: boolean) => void;
  onImportSuccess: () => Promise<void>;
  setView: (view: 'review' | 'table' | 'import' | 'settings') => void;
}

const ImportPage: React.FC<ImportPageProps> = ({ t, setShowZipHelp, onImportSuccess, setView }) => {
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
    <div className="max-w-xl mx-auto mt-10 bg-panel p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-border-main">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-text-bright">
          <Upload className="text-accent drop-shadow-[0_0_5px_var(--accent-glow)]" /> {t.importClass}
      </h2>
      <form onSubmit={handleImport} className="flex flex-col gap-6">
          <div>
              <label className="block text-sm font-medium mb-2 text-text-dim">{t.classIdentifier}</label>
              <input 
                  type="text" 
                  required
                  value={importTurma}
                  onChange={(e) => setImportTurma(e.target.value)}
                  placeholder="Ex: Class A"
                  className="w-full bg-input border border-border-main rounded-lg p-3 text-text-main focus:outline-none focus:border-accent transition-all"
              />
          </div>
          <div>
              <label className="block text-sm font-medium mb-2 text-text-dim">{t.folderTemplate}</label>
              <input 
                  type="text" 
                  required
                  value={folderTemplate}
                  onChange={(e) => setFolderTemplate(e.target.value)}
                  placeholder="Ex: [EMAIL] [NAME] [ID] [EMAIL]"
                  className="w-full bg-input border border-border-main rounded-lg p-3 text-accent font-mono text-sm focus:outline-none focus:border-accent transition-all"
              />
              <div className="flex gap-2 mt-2 text-[10px]">
                  {['[EMAIL]', '[NAME]', '[ID]', '[IGNORE]'].map(tag => (
                      <span key={tag} className="bg-button text-text-dim px-1 rounded border border-border-main">{tag}</span>
                  ))}
              </div>
          </div>
          <div>
              <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-medium text-text-dim">{t.submissionsZip}</label>
                  <button 
                      type="button"
                      onClick={() => setShowZipHelp(true)}
                      className="text-[10px] font-bold text-accent hover:text-accent/80 underline flex items-center gap-1"
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
                  <div className="w-full bg-input border-2 border-border-main border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center group-hover:border-accent/50 group-hover:bg-panel transition-all">
                      {!importFile ? (
                          <>
                              <div className="bg-panel p-4 rounded-full mb-4 border border-border-main group-hover:border-accent/30 transition-colors">
                                  <Upload size={32} className="text-text-dim group-hover:text-accent transition-colors" />
                              </div>
                              <div className="flex flex-col gap-1">
                                  <span className="text-text-dim font-semibold group-hover:text-text-main">{t.clickToUpload}</span>
                                  <span className="text-text-dim text-xs opacity-60">{t.zipNote}</span>
                              </div>
                          </>
                      ) : (
                          <>
                              <div className="bg-accent/20 p-4 rounded-full mb-4 border border-accent/30">
                                  <CheckCircle2 size={32} className="text-accent drop-shadow-[0_0_8px_var(--accent-glow)]" />
                              </div>
                              <div className="flex flex-col gap-1">
                                  <span className="text-accent font-bold">{importFile.name}</span>
                                  <span className="text-text-dim text-xs">{t.readyForImport}</span>
                              </div>
                          </>
                      )}
                  </div>
              </label>
          </div>
          <button 
              type="submit"
              disabled={importing || !importTurma || !importFile}
              className="w-full bg-accent hover:bg-accent/80 disabled:opacity-30 disabled:hover:bg-accent text-black py-4 rounded-lg font-bold flex items-center justify-center gap-3 text-lg transition-all active:scale-[0.98] shadow-[0_0_20px_var(--accent-glow)] hover:shadow-[0_0_25px_var(--accent-glow)]"
          >
              {importing ? <><Loader2 className="animate-spin" /> {t.importing}</> : <><Upload size={20} /> {t.importClass}</>}
          </button>
      </form>
    </div>
  );
};

export default ImportPage;
