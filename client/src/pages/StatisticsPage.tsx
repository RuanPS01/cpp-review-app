import React, { useState } from 'react';
import {
  AlertTriangle, BarChart3, Activity, FileQuestion, Loader2, Plus, RefreshCw,
  Sparkles, Trash2, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useStatistics } from '../hooks/useStatistics';
import Modal from '../components/Modal';
import StatisticsImportWizard from '../components/statistics/StatisticsImportWizard';
import OverviewPanel from '../components/statistics/OverviewPanel';
import EngagementPanel from '../components/statistics/EngagementPanel';
import QuestionsPanel from '../components/statistics/QuestionsPanel';
import StudentsPanel from '../components/statistics/StudentsPanel';
import AlertsPanel from '../components/statistics/AlertsPanel';
import AIInsightsPanel from '../components/statistics/AIInsightsPanel';
import { VIZ, formatDateTime } from '../components/statistics/charts/chartTheme';

type StatsTab = 'overview' | 'engagement' | 'questions' | 'students' | 'alerts' | 'ai';

interface StatisticsPageProps {
  t: Record<string, string>;
  lang: string;
}

const StatisticsPage: React.FC<StatisticsPageProps> = ({ t, lang }) => {
  const statistics = useStatistics(t);
  const [tab, setTab] = useState<StatsTab>('overview');
  const [showImport, setShowImport] = useState(false);
  const [focusedStudent, setFocusedStudent] = useState<string | null>(null);

  const { datasets, selectedTurma, setSelectedTurma, metrics, reports, saveReport, loading, error } = statistics;

  const tabs: { key: StatsTab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'overview', label: t.statsTabOverview, icon: BarChart3 },
    { key: 'engagement', label: t.statsTabEngagement, icon: Activity },
    { key: 'questions', label: t.statsTabQuestions, icon: FileQuestion },
    { key: 'students', label: t.statsTabStudents, icon: Users },
    { key: 'alerts', label: t.statsTabAlerts, icon: AlertTriangle },
    { key: 'ai', label: t.statsTabAI, icon: Sparkles }
  ];

  const openStudent = (studentId: string) => {
    setFocusedStudent(studentId);
    setTab('students');
  };

  const importModal = (
    <Modal
      isOpen={showImport}
      onClose={() => setShowImport(false)}
      title={t.statsImportTitle}
      icon={BarChart3}
      maxWidth="max-w-2xl"
      maxHeight="max-h-[90vh]"
    >
      <StatisticsImportWizard
        t={t}
        onClose={() => setShowImport(false)}
        onSuccess={async (turma) => {
          await statistics.fetchDatasets(turma);
          setSelectedTurma(turma);
          setTab('overview');
        }}
      />
    </Modal>
  );

  if (loading && !metrics && datasets.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 size={40} className="animate-spin text-accent" />
        <p className="animate-pulse text-[11px] font-black uppercase tracking-widest text-text-dim">{t.statsLoading}</p>
      </div>
    );
  }

  if (!datasets.length) {
    return (
      <div className="mx-auto mt-10 max-w-3xl">
        <div className="relative overflow-hidden rounded-xl border border-border-main bg-panel p-10 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 opacity-5">
            <BarChart3 size={220} className="text-accent" />
          </div>
          <div className="relative space-y-6">
            <div className="mx-auto w-fit rounded-lg border border-accent/20 bg-accent/10 p-4">
              <BarChart3 size={40} className="text-accent drop-shadow-[0_0_8px_var(--accent-glow)]" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-text-bright">{t.statsEmptyTitle}</h2>
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-text-dim">{t.statsEmptyDesc}</p>
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="mx-auto flex items-center justify-center gap-3 rounded-xl bg-accent px-8 py-4 font-black uppercase tracking-widest text-black shadow-[0_0_30px_var(--accent-glow)] transition-all active:scale-95 hover:bg-accent/80"
            >
              <Plus size={20} /> {t.statsImportButton}
            </button>
          </div>
        </div>
        {importModal}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 duration-500 animate-in fade-in">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-main bg-panel p-5">
        <div className="flex items-center gap-4">
          <div className="rounded-lg border border-accent/20 bg-accent/10 p-3">
            <BarChart3 size={24} className="text-accent drop-shadow-[0_0_8px_var(--accent-glow)]" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter text-text-bright">{t.statsTitle}</h2>
            <p className="text-[11px] text-text-dim">{t.statsSubtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedTurma}
            onChange={(e) => { setSelectedTurma(e.target.value); setFocusedStudent(null); }}
            className="cursor-pointer rounded-lg border border-border-main bg-button px-4 py-2.5 text-xs font-bold text-text-main transition-all hover:border-accent/50 focus:border-accent focus:outline-none"
          >
            {datasets.map(dataset => (
              <option key={dataset.turma} value={dataset.turma}>{dataset.turma}</option>
            ))}
          </select>

          <button
            onClick={statistics.refresh}
            title={t.statsLoading}
            className="rounded-lg border border-border-main bg-button p-2.5 text-text-dim transition-all hover:border-accent/50 hover:text-accent active:scale-95"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => {
              toast((toastObject) => (
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-text-bright">{t.statsDeleteConfirm}</span>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => toast.dismiss(toastObject.id)}
                      className="text-xs font-bold uppercase tracking-widest text-text-dim"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={() => { toast.dismiss(toastObject.id); statistics.deleteDataset(selectedTurma); }}
                      className="rounded-lg border px-4 py-1.5 text-xs font-black uppercase tracking-widest"
                      style={{ color: VIZ.critical, borderColor: VIZ.critical }}
                    >
                      {t.confirmDeleteAction}
                    </button>
                  </div>
                </div>
              ), { duration: 8000 });
            }}
            title={t.statsDelete}
            className="rounded-lg border border-border-main bg-button p-2.5 text-text-dim transition-all hover:border-red-500/50 hover:text-red-500 active:scale-95"
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black shadow-lg shadow-accent/20 transition-all active:scale-95 hover:bg-accent/80"
          >
            <Plus size={14} /> {t.statsNewImport}
          </button>
        </div>
      </header>

      {metrics && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2">
            {tabs.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); if (item.key !== 'students') setFocusedStudent(null); }}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                    isActive
                      ? 'border-accent bg-accent text-black shadow-[0_0_15px_var(--accent-glow)]'
                      : 'border-border-main bg-button text-text-dim hover:border-accent/50 hover:text-accent'
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                  {item.key === 'alerts' && metrics.alerts.length > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums"
                      style={{ background: isActive ? 'rgba(0,0,0,0.2)' : VIZ.critical, color: isActive ? '#000' : '#fff' }}
                    >
                      {metrics.alerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            {t.statsImportedAt}: {formatDateTime(metrics.importedAt, lang)}
          </span>
        </div>
      )}

      {metrics && metrics.warnings.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: VIZ.warning }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: VIZ.warning }}>
            <AlertTriangle size={12} /> {t.statsWarnings}
          </div>
          <ul className="space-y-1 text-[11px] leading-tight text-text-dim">
            {metrics.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: VIZ.critical }}>
          <p className="text-sm font-bold" style={{ color: VIZ.critical }}>{t.statsLoadError}</p>
          <p className="mt-1 text-[11px] text-text-dim">{error}</p>
        </div>
      )}

      {loading && !metrics && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 size={36} className="animate-spin text-accent" />
        </div>
      )}

      {metrics && (
        <div key={`${selectedTurma}-${tab}`} className="duration-300 animate-in fade-in">
          {tab === 'overview' && <OverviewPanel metrics={metrics} t={t} />}
          {tab === 'engagement' && <EngagementPanel metrics={metrics} t={t} lang={lang} />}
          {tab === 'questions' && (
            <QuestionsPanel metrics={metrics} reports={reports} onReportGenerated={saveReport} t={t} lang={lang} />
          )}
          {tab === 'students' && (
            <StudentsPanel
              key={focusedStudent || 'list'}
              metrics={metrics}
              reports={reports}
              onReportGenerated={saveReport}
              t={t}
              lang={lang}
              initialStudentId={focusedStudent}
            />
          )}
          {tab === 'alerts' && (
            <AlertsPanel
              metrics={metrics}
              reports={reports}
              onReportGenerated={saveReport}
              onOpenStudent={openStudent}
              t={t}
              lang={lang}
            />
          )}
          {tab === 'ai' && (
            <AIInsightsPanel metrics={metrics} reports={reports} onReportGenerated={saveReport} t={t} lang={lang} />
          )}
        </div>
      )}

      {importModal}
    </div>
  );
};

export default StatisticsPage;
