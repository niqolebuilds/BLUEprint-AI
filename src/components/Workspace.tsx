import { useEffect, useRef, useState } from 'react';
import { Plus, ArrowLeftRight, LockKeyhole } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Sidebar from './Sidebar';
import ProcessCatalogue from './ProcessCatalogue';
import AIRefinementPanel from './AIRefinementPanel';
import PRDHub from './PRDHub';
import DashboardCFO from './DashboardCFO';
import DashboardManager from './DashboardManager';
import AdminPanel from './AdminPanel';
import NotificationCenter from './NotificationCenter';
import ProjectManagement from './ProjectManagement';
import LocalDataHub from './LocalDataHub';
import { Avatar } from './ui';
import {
  GanttTask,
  ImprovementItem,
  ManagedProject,
  MeetingNote,
  MeetingTranscript,
  NotificationLog,
  Persona,
  Process,
  ProjectOKR,
  SystemItem,
  TeamMember,
  UserNotification,
  UserProfile,
} from '../types';
import { greeting } from '../lib/utils';
import { LanguageProvider, useLanguage } from '../lib/i18n';

type WorkspaceProps = {
  profile: UserProfile;
  currentPersona: Persona;
  setCurrentPersona: (persona: Persona) => void;
  initialTab: string;
  focusProcessId: string | null;
  clearFocusProcess: () => void;
  processes: Process[];
  availableSystems: SystemItem[];
  onUpdateSystems: (systems: SystemItem[]) => void;
  notifications: UserNotification[];
  adminBroadcastLogs: NotificationLog[];
  improvementItems: ImprovementItem[];
  projectsManaged?: ManagedProject[];
  teamMembers?: TeamMember[];
  transcripts?: MeetingTranscript[];
  meetingNotes?: MeetingNote[];
  ganttTasks?: GanttTask[];
  projectOkrs?: ProjectOKR[];
  onSaveProcess: (process: Process) => void;
  onDeleteProcess: (id: string) => void;
  onAddSystem: (name: string) => void;
  onMarkRead: (id: string) => void;
  onActionNotification: (id: string, response: string) => void;
  onTriggerReminder: (email: string, subject: string, msg: string) => void;
  onTriggerAdminNotification: (subject: string, msg: string, type: 'individual' | 'level' | 'subfunction' | 'all', val: string) => void;
  onAddImprovementItem: (item: ImprovementItem) => void;
  onUpdateImprovementItem: (item: ImprovementItem) => void;
  onUpdateProject?: (proj: ManagedProject) => void;
  onAddProject?: (proj: ManagedProject) => void;
  onDeleteProject?: (projectId: string) => void;
  onAddTeamMember?: (member: TeamMember) => void;
  onRemoveTeamMember?: (memberId: string) => void;
  onAddTranscript?: (tr: MeetingTranscript) => void;
  onAddMeetingNote?: (note: MeetingNote) => void;
  onUpdateMeetingNote?: (note: MeetingNote) => void;
  onUpdateActionItemStatus?: (noteId: string, itemId: string, status: 'pending' | 'sent' | 'acknowledged') => void;
  onAddGanttTask?: (task: GanttTask) => void;
  onUpdateGanttTask?: (task: GanttTask) => void;
  onUpdateOkrKeyResult?: (okrId: string, krId: string, currentVal: number) => void;
  onCaptureNew: () => void;
  onLock: () => void;
  onImportData: (
    data: {
      processes?: Process[];
      systems?: SystemItem[];
      profile?: UserProfile;
      improvementItems?: ImprovementItem[];
      notifications?: UserNotification[];
      adminBroadcastLogs?: NotificationLog[];
    },
    mode: 'merge' | 'overwrite'
  ) => void;
};

export default function Workspace(props: WorkspaceProps) {
  return (
    <LanguageProvider>
      <WorkspaceShell {...props} />
    </LanguageProvider>
  );
}

function WorkspaceShell({
  profile,
  currentPersona,
  setCurrentPersona,
  initialTab,
  focusProcessId,
  clearFocusProcess,
  processes,
  availableSystems,
  onUpdateSystems,
  notifications,
  adminBroadcastLogs,
  improvementItems,
  projectsManaged = [],
  teamMembers = [],
  transcripts = [],
  meetingNotes = [],
  ganttTasks = [],
  projectOkrs = [],
  onSaveProcess,
  onDeleteProcess,
  onAddSystem,
  onMarkRead,
  onActionNotification,
  onTriggerReminder,
  onTriggerAdminNotification,
  onAddImprovementItem,
  onUpdateImprovementItem,
  onUpdateProject,
  onAddProject,
  onDeleteProject,
  onAddTeamMember,
  onRemoveTeamMember,
  onAddTranscript,
  onAddMeetingNote,
  onUpdateMeetingNote,
  onUpdateActionItemStatus,
  onAddGanttTask,
  onUpdateGanttTask,
  onUpdateOkrKeyResult,
  onCaptureNew,
  onLock,
  onImportData,
}: WorkspaceProps) {
  const { language, setLanguage, t } = useLanguage();
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [selectedViewProcess, setSelectedViewProcess] = useState<Process | null>(
    () => (focusProcessId && initialTab === 'catalogue' ? processes.find((p) => p.id === focusProcessId) ?? null : null),
  );
  const [showDataHub, setShowDataHub] = useState(false);

  // User menu — tap-to-toggle (hover is a bonus on desktop, but phones have no
  // mouse, so a pure CSS :hover dropdown is unreachable on touch).
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Keep the open detail view in sync when a process is updated elsewhere.
  useEffect(() => {
    if (selectedViewProcess) {
      const fresh = processes.find((p) => p.id === selectedViewProcess.id);
      if (fresh && fresh !== selectedViewProcess) setSelectedViewProcess(fresh);
    }
  }, [processes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePersonaChange = (persona: Persona) => {
    setCurrentPersona(persona);
    setSelectedViewProcess(null);
    if (persona === 'Admin') setCurrentTab('admin');
    else if (persona === 'L4') setCurrentTab('catalogue');
    else setCurrentTab('dashboard');
  };

  /**
   * Editing reuses the guided journey: pre-load the journey draft with this
   * process, then jump back into the capture phase at the review stage.
   */
  const handleEditProcess = (process: Process) => {
    localStorage.setItem(
      'bp_journey_draft_v2',
      JSON.stringify({
        stage: 'review',
        outputs: [],
        title: process.title,
        subFunction: process.subFunction,
        narrative: process.description,
        overallSummary: null,
        processes: [
          {
            id: process.id,
            title: process.title,
            subFunction: process.subFunction,
            summary: process.description,
            steps: process.steps,
            isShared: process.isShared,
            taggedUsers: process.taggedUsers,
            manualRoleOverride: process.manualRoleOverride,
          },
        ],
      }),
    );
    onCaptureNew();
  };

  const unreadCount = notifications.filter((n) => n.status === 'Unread').length;
  const myProcessCount = processes.filter((p) => p.ownerName === profile.name).length;
  const avgCompleteness = processes.length
    ? Math.round(processes.reduce((sum, p) => sum + p.completenessScore, 0) / processes.length)
    : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden canvas-wash print:h-auto print:w-auto print:overflow-visible bg-white print:bg-white">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'catalogue') setSelectedViewProcess(null);
        }}
        currentPersona={currentPersona}
        setPersona={handlePersonaChange}
        unreadNotifications={unreadCount}
        onCaptureNew={onCaptureNew}
        onLock={onLock}
        profileRole={profile.role}
      />

      <div className="flex-1 flex flex-col min-w-0 print:h-auto print:overflow-visible">
        {/* Header — left 60%: greeting + subtitle + KPIs · right 40%: primary/secondary CTA + user menu */}
        <header className="app-header px-4 sm:px-6 md:px-10 pt-6 sm:pt-7 pb-5 grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 print:pb-6 print:border-b print:border-line">
          {/* Left 60% */}
          <div className="md:col-span-3 min-w-0">
            <h1 className="font-display text-3xl md:text-4xl font-light tracking-tight">
              {greeting(language)}, <span className="font-semibold">{profile.name.split(' ')[0]}!</span>
            </h1>
            <p className="text-sm text-mute mt-1">{t('header_subtitle')}</p>

            <div className="flex items-center gap-6 mt-4 print:hidden">
              <div>
                <div className="text-[11px] font-semibold text-mute">{t('header_processes_documented')}</div>
                <div className="font-display text-2xl font-semibold leading-tight">
                  {processes.length}
                  <span className="text-sm text-faint font-normal ml-1.5">{myProcessCount} {t('header_yours')}</span>
                </div>
              </div>
              <div className="w-px h-8 bg-line" />
              <div>
                <div className="text-[11px] font-semibold text-mute">{t('header_avg_completeness')}</div>
                <div className="font-display text-2xl font-semibold leading-tight">{avgCompleteness}%</div>
              </div>
            </div>
          </div>

          {/* Right 40% */}
          <div className="md:col-span-2 flex items-center justify-end gap-3 print:hidden flex-wrap">
            {currentPersona !== 'Admin' && (
              <button onClick={onCaptureNew} className="btn-dark" title="Primary action">
                <Plus size={16} /> {t('header_capture_process')}
              </button>
            )}
            <button
              onClick={() => setShowDataHub(true)}
              className="btn-ghost flex items-center gap-2 !py-2.5 !px-3"
              title="Transfer local data (Import/Export)"
              aria-label="Transfer local data (Import/Export)"
            >
              <ArrowLeftRight size={15} />
              <span className="hidden sm:inline">{t('header_transfer_data')}</span>
            </button>

            {/* User menu — single button; tap or hover reveals View As + Log out */}
            <div ref={userMenuRef} className="relative group shrink-0">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className={`rounded-full ring-2 transition-all cursor-pointer ${showUserMenu ? 'ring-veil' : 'ring-transparent group-hover:ring-veil'}`}
                title={`${profile.name} · ${t('persona_' + currentPersona)}`}
                aria-label="User menu"
                aria-expanded={showUserMenu}
              >
                <Avatar name={profile.name} size={42} />
              </button>

              {/* Hover bridge + dropdown — visible on tap (showUserMenu) or hover (desktop) */}
              <div
                className={`absolute right-0 top-full pt-2 z-50 transition-all duration-150 ${
                  showUserMenu
                    ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                    : 'opacity-0 invisible translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:pointer-events-auto'
                }`}
              >
                <div className="w-52 max-w-[calc(100vw-2rem)] bg-white border border-line rounded-2xl shadow-xl p-2.5">
                  {(profile.role === 'Admin' || profile.role === 'L1') && (
                    <>
                      <div className="text-[10px] font-bold text-faint tracking-wide px-1.5 pb-1.5">{t('header_view_as').toUpperCase()}</div>
                      <div className="flex items-center gap-1 px-0.5 pb-2">
                        {(['L1', 'L2', 'L3', 'L4', 'Admin'] as Persona[]).map((level) => (
                          <button
                            key={level}
                            onClick={() => {
                              handlePersonaChange(level);
                              setShowUserMenu(false);
                            }}
                            title={`${t('header_view_as')} ${t('persona_' + level)} (${level})`}
                            className={`flex-1 h-8 rounded-lg text-[10px] font-bold grid place-items-center transition-all cursor-pointer ${
                              currentPersona === level ? 'bg-ink text-citron' : 'text-mute hover:bg-veil/60 hover:text-ink'
                            }`}
                          >
                            {level === 'Admin' ? 'AD' : level}
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-line my-0.5" />
                    </>
                  )}

                  {/* Language switch */}
                  <div className="text-[10px] font-bold text-faint tracking-wide px-1.5 pb-1.5">{t('header_language').toUpperCase()}</div>
                  <div className="flex items-center gap-1 px-0.5 pb-2">
                    {(['en', 'id'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        title={lang === 'en' ? 'English' : 'Bahasa Indonesia'}
                        className={`flex-1 h-8 rounded-lg text-[11px] font-bold grid place-items-center transition-all cursor-pointer ${
                          language === lang ? 'bg-ink text-citron' : 'text-mute hover:bg-veil/60 hover:text-ink'
                        }`}
                      >
                        {lang === 'en' ? 'EN' : 'ID'}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-line my-0.5" />

                  <button
                    onClick={onLock}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold text-mute hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <LockKeyhole size={14} /> {t('header_log_out')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 pt-6 pb-24 sm:pb-6 print:h-auto print:overflow-visible">
          <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {currentTab === 'dashboard' &&
              (currentPersona === 'L3' ? (
                <DashboardManager
                  processes={processes}
                  improvementItems={improvementItems}
                  onAddImprovementItem={onAddImprovementItem}
                  onUpdateImprovementItem={onUpdateImprovementItem}
                  onTriggerReminder={onTriggerReminder}
                />
              ) : (
                <DashboardCFO
                  processes={processes}
                  currentPersona={currentPersona}
                  improvementItems={improvementItems}
                  managedProjects={projectsManaged}
                  onUpdateProject={onUpdateProject}
                  onNavigateToProject={() => setCurrentTab('projects')}
                  onSelectProcess={(proc) => {
                    setSelectedViewProcess(proc);
                    setCurrentTab('catalogue');
                  }}
                />
              ))}

            {currentTab === 'catalogue' && (
              <ProcessCatalogue
                processes={processes}
                availableSystems={availableSystems}
                selectedViewProcess={selectedViewProcess}
                onSelectProcess={setSelectedViewProcess}
                onEditProcess={handleEditProcess}
                onDeleteProcess={(id) => {
                  if (confirm('Permanently remove this process from the catalogue?')) {
                    onDeleteProcess(id);
                    if (selectedViewProcess?.id === id) setSelectedViewProcess(null);
                  }
                }}
                currentPersona={currentPersona}
                profileName={profile.name}
                profileRole={profile.role}
                onCreateNew={onCaptureNew}
                onSaveProcess={onSaveProcess}
              />
            )}

            {currentTab === 'prd_hub' && (
              <PRDHub processes={processes} isAdmin={currentPersona === 'Admin'} />
            )}

            {currentTab === 'refinement' && (
              <AIRefinementPanel
                processes={processes}
                availableSystems={availableSystems}
                focusProcessId={focusProcessId}
                clearFocusProcess={clearFocusProcess}
                onUpdateProcess={(updated) => {
                  onSaveProcess(updated);
                  if (selectedViewProcess?.id === updated.id) setSelectedViewProcess(updated);
                }}
              />
            )}

            {(currentTab === 'notifications' || currentTab === 'projects') && (
              <ProjectManagement
                projects={projectsManaged}
                catalogueProcesses={processes}
                teamMembers={teamMembers}
                transcripts={transcripts}
                meetingNotes={meetingNotes}
                ganttTasks={ganttTasks}
                projectOkrs={projectOkrs}
                notifications={notifications}
                currentPersona={currentPersona}
                profileName={profile.name}
                profileEmail={profile.email}
                onUpdateProject={onUpdateProject || (() => {})}
                onAddProject={onAddProject || (() => {})}
                onDeleteProject={onDeleteProject || (() => {})}
                onAddTeamMember={onAddTeamMember || (() => {})}
                onRemoveTeamMember={onRemoveTeamMember || (() => {})}
                onAddTranscript={onAddTranscript || (() => {})}
                onAddMeetingNote={onAddMeetingNote || (() => {})}
                onUpdateMeetingNote={onUpdateMeetingNote || (() => {})}
                onUpdateActionItemStatus={onUpdateActionItemStatus || (() => {})}
                onAddGanttTask={onAddGanttTask || (() => {})}
                onUpdateGanttTask={onUpdateGanttTask || (() => {})}
                onUpdateOkrKeyResult={onUpdateOkrKeyResult || (() => {})}
                onMarkNotificationRead={onMarkRead}
                onActionNotification={onActionNotification}
                onNavigateToCatalogue={(procId) => {
                  if (procId) {
                    const found = processes.find((p) => p.id === procId);
                    if (found) setSelectedViewProcess(found);
                  }
                  setCurrentTab('catalogue');
                }}
              />
            )}

            {currentTab === 'admin' && (
              <AdminPanel
                processes={processes}
                availableSystems={availableSystems}
                onUpdateSystems={onUpdateSystems}
                improvementItems={improvementItems}
                onTriggerAdminNotification={onTriggerAdminNotification}
              />
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showDataHub && (
          <LocalDataHub
            profile={profile}
            processes={processes}
            availableSystems={availableSystems}
            improvementItems={improvementItems}
            notifications={notifications}
            adminBroadcastLogs={adminBroadcastLogs}
            onImportComplete={onImportData}
            onClose={() => setShowDataHub(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
