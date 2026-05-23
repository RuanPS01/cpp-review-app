
import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, Server, Key, ChevronRight, ChevronLeft, 
    Download, Loader2, CheckCircle2, AlertCircle, Users, Cookie
} from 'lucide-react';
import * as moodle from '../services/moodle';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface MoodleImportWizardProps {
    t: any;
    onSuccess: () => Promise<void>;
    onClose: () => void;
}

type Step = 'CONFIG' | 'COURSE' | 'SECTION' | 'PROGRESS' | 'DONE';

const MoodleImportWizard: React.FC<MoodleImportWizardProps> = ({ t, onSuccess, onClose }) => {
    const [step, setStep] = useState<Step>('CONFIG');
    const isConfirmedRef = useRef(false);
    const [importResult, setImportResult] = useState<any>(null);
    
    // Cleanup if not confirmed
    useEffect(() => {
        return () => {
            if (importResult?.turma && !isConfirmedRef.current) {
                console.log('[DEBUG] Discarding unconfirmed import:', importResult.turma);
                api.deleteTurma(importResult.turma).catch(console.error);
            }
        };
    }, [importResult]);

    const handleConfirm = async () => {
        isConfirmedRef.current = true;
        await onSuccess();
        onClose();
    };

    const [credentials, setCredentials] = useState({
        username: localStorage.getItem('moodle_username') || '',
        password: ''
    });
    const [config, setConfig] = useState({
        url: localStorage.getItem('moodle_url') || 'https://moodle-teste.inatel.br',
        token: ''
    });
    
    const [courses, setCourses] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const [sections, setSections] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
    const [moodleSession, setMoodleSession] = useState('');
    const [userAgent, setUserAgent] = useState('');
    const [folderTemplate, setFolderTemplate] = useState('[IGNORE] [NAME] [ID] [IGNORE]');
    const [showCookieFallback, setShowCookieFallback] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    const handleConfigAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            setProgress({ current: 0, total: 0, status: t.fetchingToken });
            const currentToken = await moodle.getToken(config.url, credentials.username, credentials.password);
            setConfig(prev => ({ ...prev, token: currentToken }));

            await moodle.searchCourses(config.url, currentToken, '');
            
            localStorage.setItem('moodle_url', config.url);
            localStorage.setItem('moodle_username', credentials.username);
            toast.success(t.testSuccess);
            
            setStep('COURSE');
            handleSearch('', currentToken); 
        } catch (err: any) {
            console.error('Config error:', err);
            toast.error(t.loginError + ': ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string, overrideToken?: string) => {
        setLoading(true);
        const tokenToUse = overrideToken || config.token;
        try {
            const res = await moodle.searchCourses(config.url, tokenToUse, query);
            setCourses(res.courses || []);
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
            const res = await moodle.getCourseContents(config.url, config.token, course.id);
            const vplSections = res.filter((s: any) => s.modules.some((m: any) => m.modname === 'vpl'));
            setSections(vplSections);
            setStep('SECTION');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const autoCaptureCookie = async () => {
        setIsCapturing(true);
        const prevStatus = progress.status;
        setProgress(p => ({ ...p, status: t.capturingSession }));
        try {
            // @ts-expect-error - Exposed via preload
            const res = await window.moodleAuth.captureCookie(config.url, credentials);
            if (res && res.cookie) {
                setMoodleSession(res.cookie);
                setUserAgent(res.userAgent || '');
                return res;
            }
        } catch (e) {
            console.error('Auto capture failed', e);
        } finally {
            setIsCapturing(false);
            setProgress(p => ({ ...p, status: prevStatus }));
        }
        return null;
    };

    const runCookieImport = async (cookie: string, section: any, uaOverride?: string, retryCount = 0) => {
        const vplModules = section.modules.filter((m: any) => m.modname === 'vpl');
        const questionsForCookie = vplModules.map((m: any) => ({
            id: m.id,
            name: m.name
        }));
        const payload = {
            courseName: selectedCourse.fullname,
            sectionName: section.name,
            questions: questionsForCookie,
            cookie: cookie,
            baseUrl: config.url,
            userAgent: uaOverride || userAgent,
            folderTemplate: folderTemplate
        };
        try {
            const res = await api.importMoodleCookies(payload);
            setImportResult(res.data);
            setStep('DONE');
            setCredentials(prev => ({ ...prev, password: '' })); // Clear password for security
            toast.success(t.importSuccess);
        } catch (err: any) {
            if (retryCount < 1) {
                console.log('[DEBUG] Import failed, retrying in 2s...');
                setProgress(p => ({ ...p, status: 'Falha inicial. Tentando novamente em 2s...' }));
                await new Promise(r => setTimeout(r, 2000));
                return runCookieImport(cookie, section, uaOverride, retryCount + 1);
            }
            throw err;
        }
    };

    const startImport = async (section: any) => {
        setSelectedSection(section);
        setStep('PROGRESS');
        setLoading(true);

        const vplModules = section.modules.filter((m: any) => m.modname === 'vpl');
        if (vplModules.length === 0) {
            toast.error(t.noVplsFound);
            setStep('SECTION');
            setLoading(false);
            return;
        }

        try {
            setProgress({ current: 0, total: 0, status: t.capturingSession });
            let session = moodleSession;
            let ua = userAgent;

            if (!session) {
                const captured = await autoCaptureCookie();
                if (captured && captured.cookie) {
                    session = captured.cookie;
                    ua = captured.userAgent;
                } else {
                    setShowCookieFallback(true);
                    setStep('SECTION');
                    setLoading(false);
                    return;
                }
            }

            setProgress({ current: 0, total: 0, status: t.importingMoodle });
            await runCookieImport(session, section, ua);
        } catch (err: any) {
            console.error('Import error:', err);
            toast.error(t.testError + ': ' + err.message);
            setStep('SECTION');
        } finally {
            setLoading(false);
        }
    };

    const renderBackButton = () => {
        if (step === 'CONFIG' || step === 'PROGRESS' || step === 'DONE') return null;
        
        const prevSteps: Record<Step, Step> = {
            'COURSE': 'CONFIG',
            'SECTION': 'COURSE',
            'CONFIG': 'CONFIG',
            'PROGRESS': 'SECTION',
            'DONE': 'DONE'
        };

        return (
            <button 
                onClick={() => setStep(prevSteps[step])} 
                className="absolute top-0 -left-2 p-2 text-text-dim hover:text-accent flex items-center gap-1 transition-all hover:bg-panel rounded-lg z-20 group bg-header/80 backdrop-blur-sm border border-border-main/50"
            >
                <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest">{t.back}</span>
            </button>
        );
    };

    return (
        <div className="space-y-6 flex flex-col relative">
            <div className="relative h-6 mb-2">
                {renderBackButton()}
            </div>

            <div className="flex justify-between items-center mb-6 px-8">
                {['CONFIG', 'COURSE', 'SECTION', 'PROGRESS', 'DONE'].map((s, idx) => (
                    <div key={s} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 ${
                            step === s ? 'bg-accent border-accent text-black shadow-[0_0_20px_var(--accent-glow)]' : 
                            (['CONFIG', 'COURSE', 'SECTION', 'PROGRESS', 'DONE'].indexOf(step) > idx ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-input border-border-main text-text-dim')
                        }`}>
                            {idx + 1}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${step === s ? 'text-accent' : 'text-text-dim'}`}>
                            {s}
                        </span>
                        
                        {idx < 4 && (
                            <div className="absolute left-[calc(50%+20px)] top-5 w-[calc(100%-40px)] h-[2px] bg-border-main -z-10 overflow-hidden">
                                <div className={`h-full bg-accent transition-all duration-700 ${['CONFIG', 'COURSE', 'SECTION', 'PROGRESS', 'DONE'].indexOf(step) > idx ? 'w-full' : 'w-0'}`} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-input/30 rounded-xl border border-border-main/20 overflow-hidden flex flex-col">
                <div className="overflow-y-auto max-h-[60vh]">
                    {step === 'CONFIG' && (
                        <form 
                            onSubmit={handleConfigAction}
                            className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6 p-4 pt-6"
                        >
                            <div className="space-y-4 max-w-sm mx-auto">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-2">
                                        <Server size={14} className="text-accent" /> {t.moodleUrl}
                                    </label>
                                    <input 
                                        type="text"
                                        value={config.url}
                                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                                        className="w-full bg-input border border-border-main rounded-lg p-3 text-sm text-text-main focus:outline-none focus:border-accent transition-all shadow-inner"
                                        placeholder="https://moodle.exemplo.com"
                                    />
                                </div>

                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-2">
                                            <Users size={14} className="text-accent" /> {t.username}
                                        </label>
                                        <input 
                                            type="text"
                                            value={credentials.username}
                                            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                            className="w-full bg-input border border-border-main rounded-lg p-3 text-sm text-text-main focus:outline-none focus:border-accent transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-2">
                                            <Key size={14} className="text-accent" /> {t.password}
                                        </label>
                                        <input 
                                            type="password"
                                            value={credentials.password}
                                            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                            className="w-full bg-input border border-border-main rounded-lg p-3 text-sm text-text-main focus:outline-none focus:border-accent transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={loading || !config.url || !credentials.username || !credentials.password}
                                className="w-full max-w-sm mx-auto bg-accent hover:bg-accent/80 text-black py-4 rounded-lg font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-accent/20"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <ChevronRight />} {t.loginToMoodle}
                            </button>
                        </form>
                    )}

                    {step === 'COURSE' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                            <div className="relative sticky top-0 z-20 bg-panel pt-4 pb-3 px-4 border-b border-border-main/30">
                                <Search className="absolute left-7 top-7.5 text-text-dim" size={18} />
                                <input 
                                    type="text"
                                    autoFocus
                                    placeholder={t.searchCourse}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        handleSearch(e.target.value);
                                    }}
                                    className="w-full bg-input border border-border-main rounded-lg pl-10 pr-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent transition-all shadow-inner"
                                />
                            </div>
                            <div className="p-4 flex-1">
                                <div className="border border-border-main rounded-lg divide-y divide-border-main bg-input overflow-hidden">
                                    {loading && courses.length === 0 ? (
                                        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-accent" /></div>
                                    ) : courses.length > 0 ? (
                                        courses.map(course => (
                                            <button 
                                                key={course.id}
                                                onClick={() => selectCourse(course)}
                                                className="w-full text-left p-4 hover:bg-panel transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-text-bright group-hover:text-accent transition-colors">{course.fullname}</div>
                                                    <div className="text-[10px] text-text-dim font-mono">{course.shortname}</div>
                                                </div>
                                                <ChevronRight size={18} className="text-text-dim group-hover:text-accent transition-all" />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-10 text-center text-text-dim italic text-sm">{t.noCoursesFound}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'SECTION' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 p-4 pt-6">
                            <h3 className="text-[10px] font-black text-text-dim uppercase tracking-widest">{t.selectSection} em <span className="text-accent">{selectedCourse?.fullname}</span></h3>
                            
                            <div className="bg-panel border border-border-main p-4 rounded-lg space-y-2 mb-4">
                                <label className="text-[9px] font-black text-text-dim uppercase tracking-widest flex justify-between">
                                    <span>{t.folderTemplate}</span>
                                    <span className="text-accent opacity-60">Padrão Moodle VPL: [NAME]_[ID]_[IGNORE]</span>
                                </label>
                                <input 
                                    type="text"
                                    value={folderTemplate}
                                    onChange={(e) => setFolderTemplate(e.target.value)}
                                    className="w-full bg-input border border-border-main rounded p-2 text-xs text-accent font-mono focus:outline-none focus:border-accent"
                                />
                            </div>

                            {showCookieFallback && (
                                <div className="bg-accent/5 border border-accent/20 p-4 rounded-lg space-y-3 mb-4 animate-in zoom-in-95">
                                    <div className="flex items-center gap-2 text-accent font-black text-[10px] uppercase tracking-widest">
                                        <Cookie size={14} /> {t.useCookieFallback}
                                    </div>
                                    <p className="text-[10px] text-text-dim leading-tight">
                                        {t.cookieInstructions}
                                    </p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="password"
                                            placeholder="Valor do MoodleSession..."
                                            value={moodleSession}
                                            onChange={(e) => setMoodleSession(e.target.value)}
                                            className="flex-1 bg-input border border-border-main rounded p-2 text-xs text-accent font-mono focus:outline-none focus:border-accent"
                                        />
                                        <button 
                                            onClick={async () => {
                                                const res = await autoCaptureCookie();
                                                if (res && res.cookie) toast.success('Cookie capturado!');
                                            }}
                                            disabled={isCapturing}
                                            className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 px-3 py-1 rounded text-[10px] font-black uppercase transition-all flex items-center gap-2"
                                        >
                                            {isCapturing ? <Loader2 className="animate-spin" size={12} /> : <Cookie size={12} />}
                                            {isCapturing ? '...' : 'Capturar'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-border-main rounded-lg divide-y divide-border-main bg-input">
                                {sections.length > 0 ? (
                                    sections.map(section => (
                                        <button 
                                            key={section.id}
                                            onClick={() => startImport(section)}
                                            className="w-full text-left p-4 hover:bg-panel transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <div className="text-sm font-bold text-text-bright group-hover:text-accent transition-colors">{section.name}</div>
                                                <div className="text-[10px] text-text-dim font-black uppercase tracking-tighter">
                                                    {t.vplCount.replace('{count}', section.modules.filter((m: any) => m.modname === 'vpl').length.toString())}
                                                </div>
                                            </div>
                                            <Download size={18} className="text-text-dim group-hover:text-accent transition-all" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-10 text-center text-text-dim italic text-sm">{t.noSectionsFound}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'PROGRESS' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-12 flex flex-col items-center gap-8 h-full justify-center p-4">
                            <div className="relative">
                                <div className="w-40 h-40 rounded-full border-4 border-panel border-t-accent animate-spin shadow-[0_0_30px_var(--accent-glow)]"></div>
                                <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-accent drop-shadow-[0_0_10px_var(--accent-glow)]">
                                    {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : (loading ? '...' : '0%')}
                                </div>
                            </div>
                            <div className="text-center space-y-3">
                                <h4 className="text-xl font-black text-text-bright uppercase tracking-widest animate-pulse">{t.importingMoodle}</h4>
                                <p className="text-[10px] text-accent font-black tracking-widest uppercase max-w-[400px] truncate bg-accent/5 px-4 py-2 rounded-full border border-accent/20">
                                    {progress.status}
                                </p>
                            </div>
                            <div className="w-full bg-panel h-2 rounded-full overflow-hidden border border-border-main max-w-md">
                                <div 
                                    className="h-full bg-accent transition-all duration-300 shadow-[0_0_15px_var(--accent-glow)]" 
                                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {step === 'DONE' && (
                        <div className="animate-in zoom-in-95 duration-500 py-12 flex flex-col items-center gap-8 h-full justify-center p-4">
                            <div className="bg-accent/10 p-8 rounded-full border-2 border-accent/20 animate-bounce shadow-[0_0_50px_var(--accent-glow)]">
                                <CheckCircle2 size={80} className="text-accent drop-shadow-[0_0_20px_var(--accent-glow)]" />
                            </div>
                            <div className="text-center space-y-4">
                                <h3 className="text-3xl font-black text-text-bright uppercase tracking-tighter">{t.importSuccess}</h3>
                                <div className="bg-panel border border-border-main p-6 rounded-xl flex flex-col gap-4 mt-4 shadow-xl">
                                    <div className="flex items-center gap-4 text-sm font-bold">
                                        <Users size={20} className="text-accent" />
                                        <span className="text-text-main">{importResult?.message}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm font-bold">
                                        <AlertCircle size={20} className="text-accent" />
                                        <span className="text-text-dim uppercase tracking-widest">{t.classLabel} <span className="text-accent drop-shadow-[0_0_5px_var(--accent-glow)]">{importResult?.turma}</span></span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleConfirm}
                                className="w-full max-w-md bg-accent hover:bg-accent/80 text-black py-5 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_30px_var(--accent-glow)] mt-6 text-lg"
                            >
                                {t.useImport}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MoodleImportWizard;
