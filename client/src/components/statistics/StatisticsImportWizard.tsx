import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, BarChart3, Check, CheckCircle2, ChevronLeft, ChevronRight, Cookie,
  Database, Download, Key, Loader2, Search, Server, Users
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import * as moodle from '../../services/moodle';
import { statisticsApi } from '../../services/statistics';
import { API_BASE } from '../../services/api';
import type { ImportProgress } from '../../types/statistics';

type Step = 'CONFIG' | 'COURSE' | 'SECTION' | 'PROGRESS' | 'DONE';
type LogStatus = 'running' | 'ok' | 'skipped' | 'error';

interface LogEntry {
  id: string;
  label: string;
  status: LogStatus;
  detail?: string;
}

interface StatisticsImportWizardProps {
  t: Record<string, string>;
  onSuccess: (turma: string) => void | Promise<void>;
  onClose: () => void;
}

const SOCKET_URL = API_BASE.replace(/\/api$/, '');

const StatisticsImportWizard: React.FC<StatisticsImportWizardProps> = ({ t, onSuccess, onClose }) => {
  const [step, setStep] = useState<Step>('CONFIG');
  const [loading, setLoading] = useState(false);

  const [config, setConfig] = useState({
    url: localStorage.getItem('moodle_url') || 'https://moodle-teste.inatel.br',
    token: ''
  });
  const [credentials, setCredentials] = useState({
    username: localStorage.getItem('moodle_username') || '',
    password: ''
  });

  const [courses, setCourses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
  const [turmaName, setTurmaName] = useState('');
  const [turmaNameEdited, setTurmaNameEdited] = useState(false);
  const [folderTemplate, setFolderTemplate] = useState('[IGNORE] [NAME] [ID] [IGNORE]');
  const [fetchVplResults, setFetchVplResults] = useState(true);
  const [deepHistory, setDeepHistory] = useState(false);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [serverStatus, setServerStatus] = useState('');
  const [result, setResult] = useState<{ turma: string; summary: Record<string, number>; warnings: string[] } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // O servidor transmite o andamento do espelhamento das páginas do VPL, que é
  // a parte mais demorada e acontece fora do alcance do renderer.
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('statistics-import-progress', (payload: ImportProgress) => {
      setServerStatus(payload.message);
    });
    return () => { socket.disconnect(); };
  }, []);

  const pushLog = (id: string, label: string, status: LogStatus, detail?: string) => {
    setLog(previous => {
      const existing = previous.findIndex(entry => entry.id === id);
      const next = { id, label, status, detail };
      if (existing === -1) return [...previous, next];
      const copy = [...previous];
      copy[existing] = next;
      return copy;
    });
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const token = await moodle.getToken(config.url, credentials.username, credentials.password);
      setConfig(previous => ({ ...previous, token }));
      localStorage.setItem('moodle_url', config.url);
      localStorage.setItem('moodle_username', credentials.username);
      toast.success(t.testSuccess);
      setStep('COURSE');
      await handleSearch('', token);
    } catch (err: any) {
      toast.error(`${t.loginError}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string, overrideToken?: string) => {
    setLoading(true);
    try {
      const response = await moodle.searchCourses(config.url, overrideToken || config.token, query);
      setCourses(response.courses || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectCourse = async (course: any) => {
    setSelectedCourse(course);
    setLoading(true);
    try {
      const contents = await moodle.getCourseContents(config.url, config.token, course.id);
      setSections(contents.filter((section: any) => section.modules?.some((m: any) => m.modname === 'vpl')));
      setSelectedSectionIds([]);
      setTurmaName('');
      setTurmaNameEdited(false);
      setStep('SECTION');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chosenSections = sections.filter(section => selectedSectionIds.includes(section.id));
  const totalVplCount = chosenSections.reduce(
    (acc, section) => acc + section.modules.filter((m: any) => m.modname === 'vpl').length,
    0
  );
  // O nome sugerido acompanha a seleção até o professor digitar o dele.
  const suggestedTurmaName = chosenSections.length && selectedCourse
    ? `${selectedCourse.fullname} - ${chosenSections.map(section => section.name).join(' + ')}`
    : '';
  const effectiveTurmaName = turmaNameEdited ? turmaName : suggestedTurmaName;

  const toggleSection = (section: any) => {
    setSelectedSectionIds(previous => previous.includes(section.id)
      ? previous.filter(id => id !== section.id)
      : [...previous, section.id]);
  };

  /** Datas vêm do `core_course_get_contents` quando disponíveis (mais confiável que raspar a página). */
  const readModuleDates = (module: any) => {
    const dates = module.dates || [];
    const find = (pattern: RegExp) => dates.find((d: any) => pattern.test(String(d.label || '')))?.timestamp;
    const opened = find(/open|abert|inici|disponí/i);
    const due = find(/due|entrega|prazo|encerra/i);
    return {
      startDate: opened ? opened * 1000 : null,
      dueDate: due ? due * 1000 : null
    };
  };

  const startImport = async (sectionsToImport: any[]) => {
    setStep('PROGRESS');
    setLog([]);
    setServerStatus('');

    // Achata as atividades de todas as seções escolhidas, guardando de qual
    // seção cada uma veio para reagrupar no envio ao servidor.
    const modules = sectionsToImport.flatMap((section: any) =>
      section.modules
        .filter((m: any) => m.modname === 'vpl')
        .map((m: any) => ({ ...m, sectionName: section.name }))
    );

    if (!modules.length) {
      toast.error(t.noVplsFound);
      setStep('SECTION');
      return;
    }

    try {
      // 1. Sessão do navegador — necessária para baixar os ZIPs de submissão.
      pushLog('cookie', t.capturingSession, 'running');
      // @ts-expect-error exposto pelo preload do Electron
      const captured = await window.moodleAuth?.captureCookie(config.url, credentials);
      if (!captured?.cookie) {
        pushLog('cookie', t.capturingSession, 'error');
        throw new Error(t.cookieInstructions);
      }
      pushLog('cookie', t.capturingSession, 'ok');

      // 2. Alunos matriculados — inclui quem nunca entregou nada.
      pushLog('students', t.statsSourceEnrolledUsers, 'running');
      let enrolledStudents: any[] = [];
      try {
        enrolledStudents = await moodle.getEnrolledStudents(config.url, config.token, selectedCourse.id);
        pushLog('students', t.statsSourceEnrolledUsers, 'ok', t.statsStudentsFound.replace('{count}', String(enrolledStudents.length)));
      } catch (err: any) {
        pushLog('students', t.statsSourceEnrolledUsers, 'skipped', err.message);
      }

      // 3. Metadados das atividades (enunciado, casos de teste, prazo, nota máxima).
      const questions: any[] = [];
      let vplInfoAvailable = true;
      for (let i = 0; i < modules.length; i++) {
        const module = modules[i];
        const dates = readModuleDates(module);
        const question: any = {
          cmid: module.id,
          instanceId: module.instance ?? null,
          name: module.name,
          sectionName: module.sectionName,
          startDate: dates.startDate,
          dueDate: dates.dueDate,
          statement: null,
          testCases: [],
          maxGrade: null
        };

        if (vplInfoAvailable) {
          pushLog('vplinfo', 'mod_vpl_info', 'running', module.name);
          try {
            const info = await moodle.getVplInfo(config.url, config.token, module.id);
            question.statement = info.intro || null;
            question.maxGrade = info.grade ?? null;
            question.startDate = question.startDate ?? (info.startdate ? info.startdate * 1000 : null);
            question.dueDate = question.dueDate ?? (info.duedate ? info.duedate * 1000 : null);
            const cases = info.executionfiles?.find((f: any) => f.name === 'vpl_evaluate.cases');
            if (cases?.data) question.testCases = moodle.parseCases(cases.data);
          } catch (err: any) {
            // Serviço bloqueado: o servidor busca esses dados raspando a página.
            vplInfoAvailable = false;
            pushLog('vplinfo', 'mod_vpl_info', 'skipped', err.message);
          }
        }
        questions.push(question);
      }
      if (vplInfoAvailable) pushLog('vplinfo', 'mod_vpl_info', 'ok', `${questions.length} ${t.vplActivities}`);

      // 4. Livro de notas — fallback barato de nota por atividade.
      pushLog('gradebook', t.statsSourceGradebook, 'running');
      const gradebook: Record<string, Record<string, { grade: number | null; gradeMax: number | null }>> = {};
      try {
        const report = await moodle.getCourseGradeItems(config.url, config.token, selectedCourse.id);
        (report.usergrades || []).forEach((userGrade: any) => {
          const entry: Record<string, { grade: number | null; gradeMax: number | null }> = {};
          (userGrade.gradeitems || []).forEach((item: any) => {
            if (item.cmid) entry[String(item.cmid)] = { grade: item.graderaw ?? null, gradeMax: item.grademax ?? null };
          });
          gradebook[String(userGrade.userid)] = entry;
        });
        pushLog('gradebook', t.statsSourceGradebook, 'ok');
      } catch (err: any) {
        pushLog('gradebook', t.statsSourceGradebook, 'skipped', err.message);
      }

      // 5. Avaliação automática por aluno — a fonte mais rica (casos reprovados,
      //    erros de compilação), porém uma chamada por aluno e questão.
      const vplResults: Record<string, Record<string, any>> = {};
      if (fetchVplResults && enrolledStudents.length) {
        let available = true;
        const total = modules.length * enrolledStudents.length;
        let done = 0;
        for (const module of modules) {
          if (!available) break;
          vplResults[String(module.id)] = {};
          for (const student of enrolledStudents) {
            done += 1;
            pushLog('vplresults', t.statsSourceVplResults, 'running', `${done}/${total}`);
            try {
              const result = await moodle.getStudentResult(config.url, config.token, module.id, student.id);
              if (result && (result.grade || result.evaluation || result.compilation)) {
                vplResults[String(module.id)][String(student.id)] = {
                  grade: result.grade,
                  evaluation: result.evaluation,
                  compilation: result.compilation
                };
              }
            } catch (err: any) {
              // Uma falha logo na primeira chamada indica serviço bloqueado —
              // não vale percorrer a turma inteira colecionando erros.
              if (done === 1) {
                available = false;
                pushLog('vplresults', t.statsSourceVplResults, 'skipped', err.message);
              }
            }
          }
        }
        if (available) pushLog('vplresults', t.statsSourceVplResults, 'ok');
      } else if (fetchVplResults) {
        pushLog('vplresults', t.statsSourceVplResults, 'skipped', t.statsSourceUnavailable);
      }

      // 6. Envia tudo para o servidor, que espelha as páginas do VPL, baixa os
      //    ZIPs de código e consolida o dataset.
      pushLog('server', t.statsImportCollecting, 'running');
      const response = await statisticsApi.importMoodle({
        courseId: selectedCourse.id,
        courseName: selectedCourse.fullname,
        sectionName: sectionsToImport.map((s: any) => s.name).join(' + '),
        turmaName: effectiveTurmaName,
        baseUrl: config.url,
        cookie: captured.cookie,
        userAgent: captured.userAgent || '',
        folderTemplate,
        sections: sectionsToImport.map((section: any) => ({
          name: section.name,
          questions: questions.filter(question => question.sectionName === section.name)
        })),
        enrolledStudents,
        vplResults,
        gradebook,
        deepHistory,
        sources: { vplInfo: vplInfoAvailable }
      });
      pushLog('server', t.statsImportCollecting, 'ok');

      setCredentials(previous => ({ ...previous, password: '' }));
      setResult({
        turma: response.data.turma,
        summary: response.data.summary || {},
        warnings: response.data.warnings || []
      });
      setStep('DONE');
    } catch (err: any) {
      console.error('Statistics import failed:', err);
      toast.error(`${t.statsImportFailed}: ${err.response?.data?.error || err.message}`);
      setStep('SECTION');
    }
  };

  const statusIcon = (status: LogStatus) => {
    if (status === 'running') return <Loader2 size={14} className="animate-spin text-accent" />;
    if (status === 'ok') return <CheckCircle2 size={14} style={{ color: 'var(--viz-good)' }} />;
    if (status === 'error') return <AlertCircle size={14} style={{ color: 'var(--viz-critical)' }} />;
    return <AlertCircle size={14} style={{ color: 'var(--viz-warning)' }} />;
  };

  const steps: Step[] = ['CONFIG', 'COURSE', 'SECTION', 'PROGRESS', 'DONE'];

  return (
    <div className="relative flex flex-col space-y-6">
      {(step === 'COURSE' || step === 'SECTION') && (
        <button
          onClick={() => setStep(step === 'SECTION' ? 'COURSE' : 'CONFIG')}
          className="absolute -left-2 top-0 z-20 flex items-center gap-1 rounded-lg border border-border-main/50 bg-header/80 p-2 text-text-dim backdrop-blur-sm transition-all hover:bg-panel hover:text-accent"
        >
          <ChevronLeft size={14} />
          <span className="text-[9px] font-black uppercase tracking-widest">{t.back}</span>
        </button>
      )}

      <div className="mb-2 h-6" />

      <div className="mb-4 flex items-center justify-between px-8">
        {steps.map((current, index) => (
          <div key={current} className="relative z-10 flex flex-1 flex-col items-center gap-2">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black transition-all duration-500 ${
              step === current
                ? 'border-accent bg-accent text-black shadow-[0_0_20px_var(--accent-glow)]'
                : steps.indexOf(step) > index
                  ? 'border-accent/40 bg-accent/20 text-accent'
                  : 'border-border-main bg-input text-text-dim'
            }`}>
              {index + 1}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-tighter ${step === current ? 'text-accent' : 'text-text-dim'}`}>
              {current}
            </span>
            {index < steps.length - 1 && (
              <div className="absolute left-[calc(50%+20px)] top-5 -z-10 h-[2px] w-[calc(100%-40px)] overflow-hidden bg-border-main">
                <div className={`h-full bg-accent transition-all duration-700 ${steps.indexOf(step) > index ? 'w-full' : 'w-0'}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border-main/20 bg-input/30">
        <div className="max-h-[60vh] overflow-y-auto">
          {step === 'CONFIG' && (
            <form onSubmit={handleLogin} className="space-y-6 p-4 pt-6 duration-300 animate-in fade-in slide-in-from-bottom-4">
              <div className="mx-auto max-w-md rounded-lg border border-accent/20 bg-accent/5 p-4">
                <p className="text-[11px] leading-relaxed text-text-dim">{t.statsImportIntro}</p>
              </div>

              <div className="mx-auto max-w-sm space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    <Server size={14} className="text-accent" /> {t.moodleUrl}
                  </label>
                  <input
                    type="text"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    className="w-full rounded-lg border border-border-main bg-input p-3 text-sm text-text-main shadow-inner transition-all focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    <Users size={14} className="text-accent" /> {t.username}
                  </label>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="w-full rounded-lg border border-border-main bg-input p-3 text-sm text-text-main shadow-inner transition-all focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    <Key size={14} className="text-accent" /> {t.password}
                  </label>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="w-full rounded-lg border border-border-main bg-input p-3 text-sm text-text-main shadow-inner transition-all focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !config.url || !credentials.username || !credentials.password}
                className="mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-lg bg-accent py-4 font-black uppercase tracking-widest text-black shadow-lg shadow-accent/20 transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-40"
              >
                {loading ? <Loader2 className="animate-spin" /> : <ChevronRight />} {t.loginToMoodle}
              </button>
            </form>
          )}

          {step === 'COURSE' && (
            <div className="flex h-full flex-col duration-300 animate-in fade-in slide-in-from-right-4">
              <div className="sticky top-0 z-20 border-b border-border-main/30 bg-panel px-4 pb-3 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 text-text-dim" size={18} />
                  <input
                    type="text"
                    autoFocus
                    placeholder={t.searchCourse}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
                    className="w-full rounded-lg border border-border-main bg-input py-3 pl-10 pr-4 text-sm text-text-main shadow-inner transition-all focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="divide-y divide-border-main overflow-hidden rounded-lg border border-border-main bg-input">
                  {loading && !courses.length ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-accent" /></div>
                  ) : courses.length ? (
                    courses.map(course => (
                      <button
                        key={course.id}
                        onClick={() => selectCourse(course)}
                        className="group flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-panel"
                      >
                        <div>
                          <div className="text-sm font-bold text-text-bright transition-colors group-hover:text-accent">{course.fullname}</div>
                          <div className="font-mono text-[10px] text-text-dim">{course.shortname}</div>
                        </div>
                        <ChevronRight size={18} className="text-text-dim transition-all group-hover:text-accent" />
                      </button>
                    ))
                  ) : (
                    <div className="p-10 text-center text-sm italic text-text-dim">{t.noCoursesFound}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'SECTION' && (
            <div className="space-y-4 p-4 pt-6 duration-300 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                {t.selectSections} — <span className="text-accent">{selectedCourse?.fullname}</span>
              </h3>

              <div className="space-y-4 rounded-lg border border-border-main bg-panel p-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsImportOptions}</div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.folderTemplate}</label>
                  <input
                    type="text"
                    value={folderTemplate}
                    onChange={(e) => setFolderTemplate(e.target.value)}
                    className="w-full rounded border border-border-main bg-input p-2 font-mono text-xs text-accent focus:border-accent focus:outline-none"
                  />
                </div>

                {[
                  { checked: fetchVplResults, set: setFetchVplResults, label: t.statsImportVplResults, hint: t.statsImportVplResultsHint },
                  { checked: deepHistory, set: setDeepHistory, label: t.statsImportDeepHistory, hint: t.statsImportDeepHistoryHint }
                ].map(option => (
                  <label key={option.label} className="group flex cursor-pointer items-start gap-3">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={(e) => option.set(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-10 rounded-full border border-border-main bg-button transition-all peer-checked:border-accent peer-checked:bg-accent peer-checked:shadow-[0_0_10px_var(--accent-glow)]" />
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span>
                      <span className="block text-xs font-bold text-text-main">{option.label}</span>
                      <span className="block text-[10px] leading-tight text-text-dim">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="divide-y divide-border-main rounded-lg border border-border-main bg-input">
                {sections.length ? sections.map(section => {
                  const isSelected = selectedSectionIds.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      onClick={() => toggleSection(section)}
                      className={`group flex w-full items-center gap-4 p-4 text-left transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-panel'}`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                        isSelected ? 'border-accent bg-accent' : 'border-border-main group-hover:border-accent/50'
                      }`}>
                        {isSelected && <Check size={12} className="text-black" strokeWidth={4} />}
                      </span>
                      <div className="flex-1">
                        <div className={`text-sm font-bold transition-colors ${isSelected ? 'text-accent' : 'text-text-bright group-hover:text-accent'}`}>
                          {section.name}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-tighter text-text-dim">
                          {t.vplCount.replace('{count}', String(section.modules.filter((m: any) => m.modname === 'vpl').length))}
                        </div>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="p-10 text-center text-sm italic text-text-dim">{t.noSectionsFound}</div>
                )}
              </div>

              {chosenSections.length > 0 && (
                <div className="space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.className}</label>
                    <input
                      type="text"
                      value={effectiveTurmaName}
                      onChange={(e) => { setTurmaNameEdited(true); setTurmaName(e.target.value); }}
                      className="w-full rounded border border-border-main bg-input p-2 text-xs text-text-main focus:border-accent focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => startImport(chosenSections)}
                    disabled={!totalVplCount || !effectiveTurmaName.trim()}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-accent py-4 font-black uppercase tracking-widest text-black shadow-lg shadow-accent/20 transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-40"
                  >
                    <Download size={18} />
                    {t.importSelectedSections
                      .replace('{sections}', String(chosenSections.length))
                      .replace('{questions}', String(totalVplCount))}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'PROGRESS' && (
            <div className="space-y-6 p-6 duration-500 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4">
                <Loader2 size={28} className="animate-spin text-accent" />
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-text-bright">{t.statsImportCollecting}</h4>
                  <p className="text-[11px] text-text-dim">{serverStatus || t.fetchingSubmissions}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border-main bg-panel p-4">
                <div className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-dim">
                  <Database size={12} className="text-accent" /> {t.statsImportLogTitle}
                </div>
                <ul className="space-y-2">
                  {log.map(entry => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 text-text-main">
                        {statusIcon(entry.status)}
                        {entry.label}
                      </span>
                      <span className="truncate text-right text-[10px] text-text-dim">{entry.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="flex items-center gap-2 text-[10px] italic text-text-dim">
                <Cookie size={12} className="text-accent" /> {t.cookieInstructions}
              </p>
            </div>
          )}

          {step === 'DONE' && result && (
            <div className="flex flex-col items-center gap-6 p-6 py-10 duration-500 animate-in zoom-in-95">
              <div className="rounded-full border-2 border-accent/20 bg-accent/10 p-6 shadow-[0_0_50px_var(--accent-glow)]">
                <BarChart3 size={64} className="text-accent" />
              </div>
              <div className="space-y-3 text-center">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-text-bright">{t.statsImportDone}</h3>
                <p className="text-sm font-bold text-text-dim">
                  {t.statsImportSummary
                    .replace('{students}', String(result.summary.students ?? 0))
                    .replace('{questions}', String(result.summary.questions ?? 0))
                    .replace('{submissions}', String(result.summary.submissions ?? 0))}
                </p>
                <p className="text-xs text-accent">{result.turma}</p>
              </div>

              {result.warnings.length > 0 && (
                <div className="w-full max-w-lg rounded-lg border p-4" style={{ borderColor: 'var(--viz-warning)' }}>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--viz-warning)' }}>
                    <AlertCircle size={12} /> {t.statsWarnings}
                  </div>
                  <ul className="space-y-1 text-[11px] leading-tight text-text-dim">
                    {result.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}
                  </ul>
                </div>
              )}

              <button
                onClick={async () => { await onSuccess(result.turma); onClose(); }}
                className="w-full max-w-md rounded-xl bg-accent py-4 text-lg font-black uppercase tracking-widest text-black shadow-[0_0_30px_var(--accent-glow)] transition-all active:scale-95 hover:bg-accent/80"
              >
                {t.statsImportOpen}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticsImportWizard;
