import { useEffect, useState } from 'react';
import { Plus, ArrowLeftRight, LockKeyhole, UserCog } from 'lucide-react';
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

const PERSONA_LABELS: Record<Persona, string> = {
  L1: 'CFO',
  L2: 'GM / Head',
  L3: 'Manager',
  L4: 'Executor',
  Admin: 'Admin',
};

export default function Workspace({
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
}: {
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
}) {
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [selectedViewProcess, setSelectedViewProcess] = useState<Process | null>(
    () => (focusProcessId && initialTab === 'catalogue' ? processes.find((p) => p.id === focusProcessId) ?? null : null),
  );
  const [showDataHub, setShowDataHub] = useState(false);

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
        {/* Header */}
        <header className="app-header px-6 md:px-10 pt-7 pb-2 flex items-end justify-between gap-4 flex-wrap print:pb-6 print:border-b print:border-line">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-light tracking-tight">
              {greeting()}, <span className="font-semibold">{profile.name.split(' ')[0]}!</span>
            </h1>
            <p className="text-sm text-mute mt-1">Let&rsquo;s make the way you work visible.</p>
          </div>
          <div className="flex items-center gap-5 print:hidden">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] font-semibold text-mute">Processes documented</div>
              <div className="font-display text-2xl font-semibold leading-tight">
                {processes.length}
                <span className="text-sm text-faint font-normal ml-1.5">{myProcessCount} yours</span>
              </div>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-[11px] font-semibold text-mute">Avg. completeness</div>
              <div className="font-display text-2xl font-semibold leading-tight">{avgCompleteness}%</div>
            </div>
            {currentPersona !== 'Admin' && (
              <button onClick={onCaptureNew} className="btn-dark print:hidden">
                <Plus size={16} /> Capture process
              </button>
            )}
            <button
              onClick={() => setShowDataHub(true)}
              className="btn-ghost flex items-center gap-2 !py-2.5 !px-3 print:hidden"
              title="Transfer local data (Import/Export)"
              aria-label="Transfer local data (Import/Export)"
            >
              <ArrowLeftRight size={15} />
              <span className="hidden sm:inline">Transfer Data</span>
            </button>
            <Avatar name={profile.name} size={42} />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 md:px-10 py-6 print:h-auto print:overflow-visible">
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

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end group print:hidden">
        <div className="flex flex-col items-center gap-2 mb-2 opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100 origin-bottom transition-all duration-200">
          {(profile.role === 'Admin' || profile.role === 'L1') && (
            <div className="flex flex-col items-center gap-1 bg-white p-2 rounded-full shadow-lg border border-line">
              <span className="text-[9px] font-bold text-faint tracking-wide text-center leading-tight mb-1 pt-1">VIEW<br/>AS</span>
              {(['L1', 'L2', 'L3', 'L4', 'Admin'] as Persona[]).map((level) => (
                <button
                  key={level}
                  onClick={() => handlePersonaChange(level)}
                  title={`View as ${PERSONA_LABELS[level]} (${level})`}
                  className={`w-9 h-9 rounded-full text-[10px] font-bold grid place-items-center transition-all cursor-pointer ${
                    currentPersona === level ? 'bg-veil text-ink' : 'text-faint hover:bg-canvas hover:text-ink'
                  }`}
                >
                  {level === 'Admin' ? 'AD' : level}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onLock}
            className="w-12 h-12 rounded-full bg-white text-mute shadow-lg border border-line grid place-items-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all cursor-pointer"
            title="Log out"
          >
            <LockKeyhole size={18} />
          </button>
        </div>
        
        {/* Main FAB Trigger */}
        <button className="w-14 h-14 rounded-full bg-ink text-white shadow-xl grid place-items-center hover:bg-ink-deep hover:scale-105 transition-all cursor-pointer">
          <UserCog size={22} />
        </button>
      </div>
    </div>
  );
}
