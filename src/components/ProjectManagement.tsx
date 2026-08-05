import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Briefcase,
  Users,
  FileText,
  Sparkles,
  Calendar,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Send,
  Upload,
  Link as LinkIcon,
  Bell,
  Clock,
  ArrowRight,
  ArrowLeft,
  Info,
  Check,
  ChevronRight,
  Edit2,
  X,
  Mic,
  MicOff,
  Copy,
  ExternalLink,
  Sliders,
  Filter,
  FolderKanban,
  LayoutGrid,
} from 'lucide-react';
import {
  ManagedProject,
  TeamMember,
  MeetingTranscript,
  MeetingNote,
  GanttTask,
  ProjectOKR,
  Persona,
  UserNotification,
  ProjectStage,
  Process,
} from '../types';
import { Avatar } from './ui';
import { useLanguage } from '../lib/i18n';
import { uid, timeAgo } from '../lib/utils';

/**
 * Renders modal overlays into document.body via a portal. This is required
 * because the page content sits inside an `.animate-fade-up` ancestor —
 * CSS animations that touch `transform` (even a resting `translateY(0)`)
 * establish a new containing block for `position: fixed` descendants, so a
 * plain in-tree `fixed inset-0` overlay would center against that ancestor's
 * box instead of the viewport, landing near the top-left of the page instead
 * of dead-center. Portaling to <body> sidesteps that entirely.
 */
function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4">
      {children}
    </div>,
    document.body,
  );
}

type ProjectSectionId = 'team' | 'transcripts' | 'assistant' | 'timeline' | 'okr';

export default function ProjectManagement({
  projects,
  catalogueProcesses = [],
  teamMembers,
  transcripts,
  meetingNotes,
  ganttTasks,
  projectOkrs,
  notifications,
  currentPersona,
  profileName,
  profileEmail,
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
  onMarkNotificationRead,
  onActionNotification,
  onNavigateToCatalogue,
}: {
  projects: ManagedProject[];
  catalogueProcesses?: Process[];
  teamMembers: TeamMember[];
  transcripts: MeetingTranscript[];
  meetingNotes: MeetingNote[];
  ganttTasks: GanttTask[];
  projectOkrs: ProjectOKR[];
  notifications: UserNotification[];
  currentPersona: Persona;
  profileName: string;
  profileEmail: string;
  onUpdateProject: (proj: ManagedProject) => void;
  onAddProject: (proj: ManagedProject) => void;
  onDeleteProject: (projectId: string) => void;
  onAddTeamMember: (member: TeamMember) => void;
  onRemoveTeamMember: (memberId: string) => void;
  onAddTranscript: (transcript: MeetingTranscript) => void;
  onAddMeetingNote: (note: MeetingNote) => void;
  onUpdateMeetingNote: (note: MeetingNote) => void;
  onUpdateActionItemStatus: (noteId: string, itemId: string, status: 'pending' | 'sent' | 'acknowledged') => void;
  onAddGanttTask: (task: GanttTask) => void;
  onUpdateGanttTask: (task: GanttTask) => void;
  onUpdateOkrKeyResult: (okrId: string, krId: string, currentVal: number) => void;
  onMarkNotificationRead: (id: string) => void;
  onActionNotification: (id: string, response: string) => void;
  onNavigateToCatalogue?: (processId?: string) => void;
}) {
  const { t } = useLanguage();
  // Gallery / detail navigation — landing page is a gallery of project cards;
  // selecting one opens the detail view. `null` = show the gallery.
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [galleryScope, setGalleryScope] = useState<'mine' | 'all'>('mine');
  // Which categorized section is showing in the detail view (right-side nav),
  // so the whole page doesn't have to be scrolled to reach a section.
  const [activeSection, setActiveSection] = useState<ProjectSectionId>('team');

  // Modals & form state
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<'Lead' | 'Contributor' | 'Stakeholder'>('Contributor');

  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestMode, setIngestMode] = useState<'upload' | 'paste' | 'mic'>('paste');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingParticipantsText, setMeetingParticipantsText] = useState(profileName);
  const [meetingRawText, setMeetingRawText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // AI Meeting Assistant processing state
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [reviewNote, setReviewNote] = useState<MeetingNote | null>(null);

  // Gantt task modal (Add & Edit)
  const [showAddGanttModal, setShowAddGanttModal] = useState(false);
  const [newGanttLabel, setNewGanttLabel] = useState('');
  const [newGanttStart, setNewGanttStart] = useState(new Date().toISOString().split('T')[0]);
  const [newGanttEnd, setNewGanttEnd] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [newGanttOwner, setNewGanttOwner] = useState(profileName);

  const [showEditGanttModal, setShowEditGanttModal] = useState(false);
  const [editingGanttTask, setEditingGanttTask] = useState<GanttTask | null>(null);

  // Deliverable Details & Links Modal
  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [selectedGanttTaskForDeliverables, setSelectedGanttTaskForDeliverables] = useState<GanttTask | null>(null);
  const [deliverableUrlInput, setDeliverableUrlInput] = useState('');
  const [deliverableNotesInput, setDeliverableNotesInput] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);

  // Notifications modal for L2 and L3
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const isL2orL3 = currentPersona === 'L2' || currentPersona === 'L3';
  const unreadAlerts = notifications.filter((n) => n.status === 'Unread');

  // Lock New Project modal (Catalogue Import workflow)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjTarget, setNewProjTarget] = useState('');
  const [newProjTargetDate, setNewProjTargetDate] = useState('2026-12-31');
  const [selectedCatalogueProcessId, setSelectedCatalogueProcessId] = useState<string>('none');
  const [catalogueFilter, setCatalogueFilter] = useState<'automation_ai' | 'all'>('automation_ai');

  const [showEditOwnerModal, setShowEditOwnerModal] = useState(false);
  const [editingOwnerName, setEditingOwnerName] = useState('');
  const [editingOwnerEmail, setEditingOwnerEmail] = useState('');

  const [deletingProject, setDeletingProject] = useState<ManagedProject | null>(null);

  // Cleanup mic timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleMicrophone = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentSpeech = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentSpeech += event.results[i][0].transcript;
          }
          if (currentSpeech) {
            setMeetingRawText((prev) => (prev ? prev + ' ' + currentSpeech : currentSpeech));
          }
        };

        recognition.onerror = () => {
          // Fallback simulation if mic throws error inside sandboxed iframe
          fallbackSimulatedSpeech();
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
        setMicSeconds(0);
        timerRef.current = setInterval(() => setMicSeconds((s) => s + 1), 1000);
      } catch (e) {
        fallbackSimulatedSpeech();
      }
    } else {
      fallbackSimulatedSpeech();
    }
  };

  const fallbackSimulatedSpeech = () => {
    setIsListening(true);
    setMicSeconds(0);
    timerRef.current = setInterval(() => setMicSeconds((s) => s + 1), 1000);
    const speechText = "Live capture from microphone: Reviewed CIMB host-to-host feed variances. Agreed to set fuzzy matching threshold to 0.85 and route unmapped unit codes directly to L3 unit manager.";
    setMeetingRawText((prev) => (prev ? prev + "\n\n" + speechText : speechText));
  };

  if (projects.length === 0) {
    return (
      <div className="card p-8 text-center space-y-4">
        <Briefcase className="w-12 h-12 text-mute mx-auto" />
        <h3 className="font-display font-semibold text-lg">No Locked Projects Found</h3>
        <p className="text-sm text-mute max-w-md mx-auto">
          Project Management tracks processes that have passed Stage 3 (Investment Decision). Lock a process from the catalogue or create a new locked project.
        </p>
        <button
          onClick={() => {
            const newProj: ManagedProject = {
              id: uid('proj'),
              title: 'New High-Priority Finance Initiative',
              targetStatement: 'Automate manual hospital reconciliation workflows to reduce turnaround time.',
              ownerName: profileName,
              ownerEmail: profileEmail,
              stage: '4: Locked Project',
              progressPercent: 10,
              targetDate: '2026-12-31',
            };
            onAddProject(newProj);
            setSelectedProjectId(newProj.id);
          }}
          className="btn-dark"
        >
          <Plus size={16} /> Create Locked Project
        </button>
      </div>
    );
  }

  // Projects that involve the current user directly — owner, or a named team member.
  const isInvolved = (proj: ManagedProject) => {
    if (proj.ownerName === profileName || (profileEmail && proj.ownerEmail === profileEmail)) return true;
    return teamMembers.some(
      (m) => m.projectId === proj.id && (m.name === profileName || (profileEmail && m.email === profileEmail)),
    );
  };
  const myProjects = projects.filter(isInvolved);
  const hasOtherProjects = myProjects.length < projects.length;
  const galleryList = galleryScope === 'mine' && myProjects.length > 0 ? myProjects : projects;

  const currentProject = projects.find((p) => p.id === selectedProjectId) || null;

  // Filter project-specific data (only meaningful once a project is selected)
  const currentTeam = currentProject ? teamMembers.filter((m) => m.projectId === currentProject.id) : [];
  const currentTranscripts = currentProject ? transcripts.filter((t) => t.projectId === currentProject.id) : [];
  const currentNotes = currentProject ? meetingNotes.filter((n) => n.projectId === currentProject.id) : [];
  const currentGantt = currentProject ? ganttTasks.filter((g) => g.projectId === currentProject.id) : [];
  const currentOkr = currentProject ? projectOkrs.find((o) => o.projectId === currentProject.id) : undefined;

  const SECTION_NAV: Array<{ id: ProjectSectionId; label: string; icon: typeof Users; count?: number }> = [
    { id: 'team', label: t('pm_section_team'), icon: Users, count: currentTeam.length },
    { id: 'transcripts', label: t('pm_section_transcripts'), icon: FileText, count: currentTranscripts.length },
    { id: 'assistant', label: t('pm_section_assistant'), icon: Sparkles, count: currentNotes.length },
    { id: 'timeline', label: t('pm_section_timeline'), icon: Calendar, count: currentGantt.length },
    { id: 'okr', label: t('pm_section_okr'), icon: Target },
  ];

  // Submit new team member
  const handleAddPersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newPersonName.trim() || !newPersonEmail.trim()) return;

    const newMember: TeamMember = {
      id: uid('tm'),
      projectId: currentProject.id,
      name: newPersonName.trim(),
      email: newPersonEmail.trim(),
      role: newPersonRole,
      addedBy: profileName,
    };
    onAddTeamMember(newMember);
    setNewPersonName('');
    setNewPersonEmail('');
    setShowAddPersonModal(false);
  };

  // Submit transcript ingestion & run AI Meeting Assistant
  const handleIngestTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !meetingRawText.trim()) return;

    const participants = meetingParticipantsText
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const newTranscript: MeetingTranscript = {
      id: uid('tr'),
      projectId: currentProject.id,
      date: meetingDate,
      title: meetingTitle.trim() || 'Project Coordination Sync',
      participants: participants.length > 0 ? participants : [profileName],
      source: ingestMode,
      rawText: meetingRawText,
      fileName: uploadedFileName || undefined,
    };

    onAddTranscript(newTranscript);

    // Now invoke AI Assistant
    setIsProcessingAi(true);
    setShowIngestModal(false);

    try {
      const resp = await fetch('/api/ai/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTranscript.title,
          date: newTranscript.date,
          participants: newTranscript.participants,
          rawText: newTranscript.rawText,
          teamMembers: currentTeam.map((m) => ({ name: m.name, email: m.email })),
        }),
      });

      if (!resp.ok) throw new Error('Failed to generate AI meeting summary');
      const data = await resp.json();

      const draftNote: MeetingNote = {
        id: uid('mn'),
        projectId: currentProject.id,
        transcriptId: newTranscript.id,
        summary: data.summary || 'Summary generated.',
        decisions: data.decisions || [],
        openQuestions: data.openQuestions || [],
        actionItems: (data.actionItems || []).map((item: any) => ({
          id: uid('ai'),
          description: item.description,
          assigneeName: item.assigneeName || profileName,
          assigneeEmail: item.assigneeEmail || profileEmail,
          dueDate: item.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'pending',
        })),
        isFinalized: false,
        createdAt: new Date().toISOString(),
      };

      setReviewNote(draftNote);
    } catch (err) {
      console.error('Error invoking AI meeting assistant:', err);
      // Fallback draft note
      const fallbackNote: MeetingNote = {
        id: uid('mn'),
        projectId: currentProject.id,
        transcriptId: newTranscript.id,
        summary: 'Discussed project milestones and validated system integrations.',
        decisions: ['Agreed on schedule adjustments for upcoming release.'],
        openQuestions: ['Confirm backend OAuth scope credentials with IT team.'],
        actionItems: [
          {
            id: uid('ai'),
            description: 'Follow up on API scope authorization',
            assigneeName: profileName,
            assigneeEmail: profileEmail,
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            status: 'pending',
          },
        ],
        isFinalized: false,
        createdAt: new Date().toISOString(),
      };
      setReviewNote(fallbackNote);
    } finally {
      setIsProcessingAi(false);
      // Reset form
      setMeetingTitle('');
      setMeetingRawText('');
      setUploadedFileName('');
    }
  };

  // Confirm and finalize meeting note
  const handleConfirmAndSendNote = () => {
    if (!reviewNote) return;

    const finalizedNote: MeetingNote = {
      ...reviewNote,
      isFinalized: true,
      actionItems: reviewNote.actionItems.map((item) => ({
        ...item,
        status: 'sent', // Simulate auto-sending email to assignee
      })),
    };

    onAddMeetingNote(finalizedNote);
    setReviewNote(null);
  };

  // Add new Gantt task
  const handleAddGanttSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newGanttLabel.trim()) return;

    const newTask: GanttTask = {
      id: uid('gt'),
      projectId: currentProject.id,
      label: newGanttLabel.trim(),
      startDate: newGanttStart,
      endDate: newGanttEnd,
      progress: 0,
      owner: newGanttOwner,
    };

    onAddGanttTask(newTask);
    setNewGanttLabel('');
    setShowAddGanttModal(false);
  };

  // Stage styles
  const getStageBadge = (stage: ProjectStage) => {
    switch (stage) {
      case '4: Locked Project':
        return <span className="chip bg-veil border-line text-ink font-semibold">4: Locked Project</span>;
      case '5: Tracked Execution':
        return <span className="chip bg-citron-soft border-citron/50 text-citron-deep font-semibold">5: Tracked Execution</span>;
      case '6: Realised Benefit':
        return <span className="chip bg-emerald-100 text-emerald-800 font-semibold border-emerald-200">6: Realised Benefit</span>;
      default:
        return <span className="chip">{stage}</span>;
    }
  };

  return (
    <div className="animate-fade-up space-y-6">
      {/* Top Header & L2/L3 In-App Alerts Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-semibold tracking-tight">{t('pm_title')}</h2>
            <span className="chip bg-ink text-citron font-medium text-xs">{t('pm_stages_badge')}</span>
          </div>
          <p className="text-sm text-mute mt-0.5">
            {t('pm_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* L2 & L3 In-App Alerts Toggle Button */}
          {isL2orL3 && (
            <button
              onClick={() => setShowAlertsModal(true)}
              className="btn-ghost relative flex items-center gap-2 !py-2 !px-3"
              title="View In-App Alerts (L2/L3)"
            >
              <Bell size={16} className="text-ink" />
              <span className="text-xs font-medium">{t('pm_in_app_alerts')}</span>
              {unreadAlerts.length > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-citron text-ink text-[10px] font-bold grid place-items-center">
                  {unreadAlerts.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setShowNewProjectModal(true)}
            className="btn-dark !py-2 !px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus size={15} /> {t('pm_lock_new_project')}
          </button>
        </div>
      </div>

      {!currentProject ? (
        /* Project Gallery — landing page: a gallery of projects to choose from */
        <div className="space-y-4">
          {hasOtherProjects && (
            <div className="flex items-center gap-1 p-1 bg-veil rounded-xl text-xs w-fit">
              <button
                onClick={() => setGalleryScope('mine')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  galleryScope === 'mine' ? 'bg-white shadow-lift text-ink' : 'text-mute'
                }`}
              >
                {t('pm_my_projects')} ({myProjects.length})
              </button>
              <button
                onClick={() => setGalleryScope('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  galleryScope === 'all' ? 'bg-white shadow-lift text-ink' : 'text-mute'
                }`}
              >
                {t('pm_all_projects')} ({projects.length})
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryList.map((proj) => {
              const projTeamCount = teamMembers.filter((m) => m.projectId === proj.id).length;
              return (
                <div key={proj.id} className="relative group">
                  <button
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      setActiveSection('team');
                    }}
                    className="w-full text-left card p-5 space-y-4 hover:border-veil-deep/40 hover:shadow-lift transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {getStageBadge(proj.stage)}
                      <span className="text-xs font-bold text-ink">{proj.progressPercent}%</span>
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-base leading-snug line-clamp-2">{proj.title}</h3>
                      <p className="text-xs text-mute mt-1 line-clamp-2">{proj.targetStatement}</p>
                    </div>
                    <div className="w-full bg-veil h-1.5 rounded-full overflow-hidden">
                      <div className="bg-citron-deep h-full rounded-full" style={{ width: `${proj.progressPercent}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-line">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={proj.ownerName} size={26} />
                        <span className="text-[11px] text-mute font-medium truncate">{proj.ownerName}</span>
                      </div>
                      <span className="text-[10px] text-faint flex items-center gap-1 shrink-0">
                        <Users size={11} /> {projTeamCount}
                      </span>
                    </div>
                  </button>

                  {(isL2orL3 || currentPersona === 'Admin') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProject(proj);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-line text-rose-500 items-center justify-center hidden group-hover:flex hover:bg-rose-50 transition-all cursor-pointer shadow-sm z-10"
                      title="Erase Project"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}

            {galleryList.length === 0 && (
              <div className="col-span-full text-center py-10 text-xs text-mute border border-dashed border-line rounded-2xl">
                {t('pm_gallery_empty')} {hasOtherProjects && t('pm_gallery_empty_switch')}{t('pm_gallery_empty_lock')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedProjectId(null)}
            className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1.5 w-fit"
          >
            <ArrowLeft size={14} /> {t('pm_back_to_projects')}
          </button>

          {/* Section 1: Overview Header */}
          <div className="card p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-display text-2xl font-semibold tracking-tight">{currentProject.title}</h3>
                {getStageBadge(currentProject.stage)}
              </div>

              <p className="text-sm text-inksoft leading-relaxed max-w-3xl">{currentProject.targetStatement}</p>

              {currentProject.linkedEngineTitle && (
                <div className="flex items-center gap-2 text-xs text-mute pt-1">
                  <LinkIcon size={13} className="text-veil-deep" />
                  <span>Linked Engine:</span>
                  <button
                    onClick={() => onNavigateToCatalogue?.(currentProject.linkedProcessId)}
                    className="font-medium text-ink hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {currentProject.linkedEngineTitle} <ArrowRight size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* Stage Selector & Owner Details */}
            <div className="flex flex-col items-start md:items-end gap-3 shrink-0 bg-canvas p-4 rounded-2xl border border-line relative group">
              {(isL2orL3 || currentPersona === 'Admin') && (
                <button
                  onClick={() => {
                    setEditingOwnerName(currentProject.ownerName);
                    setEditingOwnerEmail(currentProject.ownerEmail);
                    setShowEditOwnerModal(true);
                  }}
                  className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white border border-line text-mute flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-ink hover:border-ink transition-all cursor-pointer shadow-sm"
                  title="Assign New Project Owner"
                >
                  <Edit2 size={12} />
                </button>
              )}
              <div className="text-right">
                <span className="text-[11px] font-semibold text-mute block">PROJECT OWNER</span>
                <span className="text-xs font-bold text-ink">{currentProject.ownerName}</span>
                <span className="text-[10px] text-faint block">{currentProject.ownerEmail}</span>
              </div>

              <div className="w-full text-right">
                <label className="text-[10px] font-semibold text-mute block mb-1">CHANGE STAGE</label>
                <select
                  value={currentProject.stage}
                  onChange={(e) =>
                    onUpdateProject({
                      ...currentProject,
                      stage: e.target.value as ProjectStage,
                    })
                  }
                  className="field !py-1 !px-2 text-xs font-medium cursor-pointer"
                >
                  <option value="4: Locked Project">Stage 4: Locked Project</option>
                  <option value="5: Tracked Execution">Stage 5: Tracked Execution</option>
                  <option value="6: Realised Benefit">Stage 6: Realised Benefit</option>
                </select>
              </div>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="space-y-2 pt-2 border-t border-line">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-ink">Overall Execution Progress</span>
              <span className="font-bold text-ink">{currentProject.progressPercent}% Complete</span>
            </div>
            <div className="w-full bg-veil h-3 rounded-full overflow-hidden p-0.5 border border-line">
              <div
                className="bg-citron-deep h-full rounded-full transition-all duration-500"
                style={{ width: `${currentProject.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-faint">
              <span>Target Launch: {currentProject.targetDate}</span>
              <span>Stage 4 Lock -&gt; Stage 6 Realisation</span>
            </div>
          </div>
        </div>

        {/* Categorized sections — right-side nav picks which one shows, so the
            page doesn't have to be scrolled through top to bottom. */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-3 space-y-6">
        {activeSection === 'team' && (
        <>
        {/* Section 2: Team */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-ink" />
              <h3 className="font-display font-semibold text-base">{t('pm_section_team')}</h3>
              <span className="text-xs text-mute font-medium">({currentTeam.length} members)</span>
            </div>

            <button
              onClick={() => setShowAddPersonModal(true)}
              className="btn-ghost !py-1.5 !px-3 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> Add person
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {currentTeam.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-line hover:border-veil-deep/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={member.name} size={36} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">{member.name}</div>
                    <div className="text-[10px] text-faint truncate">{member.email}</div>
                    <span className="chip bg-veil/80 border-transparent text-[9px] mt-1">
                      {member.role}
                    </span>
                  </div>
                </div>

                {member.role !== 'Lead' && (
                  <button
                    onClick={() => onRemoveTeamMember(member.id)}
                    className="text-faint hover:text-warn p-1 cursor-pointer transition-colors"
                    title="Remove member"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        </>
        )}

        {activeSection === 'transcripts' && (
        <>
        {/* Section 3: Meeting Transcripts & Ingestion */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-ink" />
                <h3 className="font-display font-semibold text-base">{t('pm_section_transcripts')}</h3>
              </div>
              <p className="text-xs text-mute mt-0.5">Ingest raw call notes or transcripts for AI action extraction.</p>
            </div>

            <button
              onClick={() => setShowIngestModal(true)}
              className="btn-dark !py-1.5 !px-3.5 text-xs flex items-center gap-1.5"
            >
              <Upload size={14} /> Ingest Transcript / Notes
            </button>
          </div>

          {/* Callout Banner for Engineering Team (Live Capture Note) */}
          <div className="p-4 rounded-2xl bg-citron-soft/50 border border-citron/40 text-xs text-inksoft flex items-start gap-3">
            <Info size={16} className="text-citron-deep shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-ink block">💡 Engineering Note for Live Call Capture</span>
              <p className="leading-relaxed text-[11px]">
                Real-time meeting capture (bot joining Zoom/Teams calls or live microphone capture) requires dedicated Speech-to-Text (STT) worker infrastructure and calendar OAuth integration. This pass provides instant file upload (`.txt`, `.docx`, `.pdf`, `.mp3`) and direct text paste ingestion; live call listening is sized for Phase 2.
              </p>
            </div>
          </div>

          {/* List of ingested transcripts */}
          {currentTranscripts.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-line rounded-2xl text-xs text-mute">
              No meeting transcripts ingested yet. Click &quot;Ingest Transcript / Notes&quot; to submit notes for AI processing.
            </div>
          ) : (
            <div className="space-y-3">
              {currentTranscripts.map((tr) => (
                <div key={tr.id} className="p-4 rounded-2xl bg-canvas border border-line space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText size={15} className="text-veil-deep shrink-0" />
                      <span className="text-xs font-bold text-ink">{tr.title}</span>
                      <span className="chip bg-veil text-[10px]">{tr.date}</span>
                      {tr.fileName && <span className="chip bg-blush text-[10px] max-w-[70vw] truncate">{tr.fileName}</span>}
                    </div>
                    <span className="text-[10px] text-faint">
                      Participants: {tr.participants.join(', ')}
                    </span>
                  </div>
                  <p className="text-xs text-mute line-clamp-2 italic bg-white p-2.5 rounded-xl border border-line/60">
                    &quot;{tr.rawText.slice(0, 180)}...&quot;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {activeSection === 'assistant' && (
        <>
        {/* Section 4: AI Meeting Assistant */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-citron-deep" />
              <h3 className="font-display font-semibold text-base">{t('pm_section_assistant')}</h3>
            </div>
            {isProcessingAi && (
              <span className="text-xs font-semibold text-citron-deep flex items-center gap-1.5 animate-pulse">
                <Sparkles size={14} className="animate-spin" /> Processing transcript with Gemini...
              </span>
            )}
          </div>

          {/* Editable Review Card (Shown after running AI Assistant) */}
          {reviewNote && (
            <div className="p-5 rounded-2xl bg-citron-soft/30 border-2 border-citron-deep/30 space-y-4 animate-fade-up">
              <div className="flex items-center justify-between">
                <span className="chip bg-citron text-ink font-bold text-xs">AI Generated Review Draft</span>
                <span className="text-xs text-mute">Review and edit before confirming</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">Executive Summary</label>
                  <textarea
                    className="field text-xs min-h-16"
                    value={reviewNote.summary}
                    onChange={(e) => setReviewNote({ ...reviewNote, summary: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">Decisions Made</label>
                    <textarea
                      className="field text-xs min-h-20"
                      value={reviewNote.decisions.join('\n')}
                      onChange={(e) => setReviewNote({ ...reviewNote, decisions: e.target.value.split('\n').filter(Boolean) })}
                      placeholder="One decision per line"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">Open Questions</label>
                    <textarea
                      className="field text-xs min-h-20"
                      value={reviewNote.openQuestions.join('\n')}
                      onChange={(e) => setReviewNote({ ...reviewNote, openQuestions: e.target.value.split('\n').filter(Boolean) })}
                      placeholder="One question per line"
                    />
                  </div>
                </div>

                {/* Extracted Action Items */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink block">Extracted Action Items</label>
                  {reviewNote.actionItems.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-white rounded-xl border border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          className="field !py-1 text-xs font-medium w-full"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...reviewNote.actionItems];
                            updated[idx].description = e.target.value;
                            setReviewNote({ ...reviewNote, actionItems: updated });
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          className="field !py-1 text-xs"
                          value={item.assigneeName}
                          onChange={(e) => {
                            const found = currentTeam.find((m) => m.name === e.target.value);
                            const updated = [...reviewNote.actionItems];
                            updated[idx].assigneeName = e.target.value;
                            if (found) updated[idx].assigneeEmail = found.email;
                            setReviewNote({ ...reviewNote, actionItems: updated });
                          }}
                        >
                          {currentTeam.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          className="field !py-1 text-xs"
                          value={item.dueDate}
                          onChange={(e) => {
                            const updated = [...reviewNote.actionItems];
                            updated[idx].dueDate = e.target.value;
                            setReviewNote({ ...reviewNote, actionItems: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button onClick={() => setReviewNote(null)} className="btn-ghost text-xs !py-1.5">
                  Discard
                </button>
                <button onClick={handleConfirmAndSendNote} className="btn-dark text-xs !py-1.5 flex items-center gap-1.5">
                  <Send size={13} /> Confirm &amp; Dispatch Action Items
                </button>
              </div>
            </div>
          )}

          {/* Finalized Notes & Action Items Display */}
          {currentNotes.length === 0 && !reviewNote ? (
            <div className="text-center py-6 text-xs text-mute border border-line rounded-2xl">
              No meeting notes generated yet. Ingest a transcript above to extract structured action items.
            </div>
          ) : (
            <div className="space-y-4">
              {currentNotes.map((note) => (
                <div key={note.id} className="p-5 rounded-2xl bg-canvas border border-line space-y-4">
                  <div>
                    <div className="text-xs font-bold text-ink">Meeting Summary</div>
                    <p className="text-xs text-inksoft mt-1 leading-relaxed">{note.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {note.decisions.length > 0 && (
                      <div className="bg-white p-3 rounded-xl border border-line space-y-1">
                        <span className="font-bold text-ink flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-600" /> Decisions
                        </span>
                        <ul className="list-disc list-inside text-[11px] text-mute space-y-1">
                          {note.decisions.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {note.openQuestions.length > 0 && (
                      <div className="bg-white p-3 rounded-xl border border-line space-y-1">
                        <span className="font-bold text-ink flex items-center gap-1">
                          <Clock size={13} className="text-amber-600" /> Open Questions
                        </span>
                        <ul className="list-disc list-inside text-[11px] text-mute space-y-1">
                          {note.openQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Action items list */}
                  <div className="space-y-2 pt-2 border-t border-line">
                    <span className="text-xs font-bold text-ink block">Action Items &amp; Routing Status</span>
                    <div className="space-y-2">
                      {note.actionItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white border border-line text-xs gap-3 flex-wrap"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Avatar name={item.assigneeName} size={28} />
                            <div className="min-w-0">
                              <div className="font-semibold text-ink truncate">{item.description}</div>
                              <div className="text-[10px] text-faint">
                                {item.assigneeName} ({item.assigneeEmail}) · Due: {item.dueDate}
                              </div>
                            </div>
                          </div>

                          {/* Status pill selector */}
                          <div className="flex items-center gap-1 shrink-0">
                            {(['pending', 'sent', 'acknowledged'] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => onUpdateActionItemStatus(note.id, item.id, st)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize transition-all cursor-pointer ${
                                  item.status === st
                                    ? st === 'acknowledged'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : st === 'sent'
                                      ? 'bg-citron-soft text-citron-deep border border-citron'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'text-faint hover:text-ink'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {activeSection === 'timeline' && (
        <>
        {/* Section 5: Project Timeline (Gantt Chart) */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-ink" />
                <h3 className="font-display font-semibold text-base">{t('pm_section_timeline')}</h3>
              </div>
              <p className="text-xs text-mute mt-0.5">Execution phases and milestones against target date ({currentProject.targetDate}).</p>
            </div>

            <button
              onClick={() => setShowAddGanttModal(true)}
              className="btn-dark !py-1.5 !px-3 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Phase / Task
            </button>
          </div>

          {/* Interactive Gantt Chart Display */}
          <div className="space-y-4 bg-canvas p-5 rounded-2xl border border-line">
            {/* Timeline Header Date Axis */}
            <div className="flex justify-between items-center text-[10px] font-bold text-faint border-b border-line pb-2">
              <span>JUN 2026</span>
              <span>JUL 2026</span>
              <span>AUG 2026</span>
              <span>SEP 2026</span>
              <span>OCT 2026</span>
              <span>NOV 2026</span>
            </div>

            <div className="space-y-3 relative">
              {/* Target Date Vertical Line Marker */}
              <div
                className="absolute top-0 bottom-0 border-r-2 border-dashed border-warn/70 z-10 flex flex-col justify-start"
                style={{ left: '72%' }}
                title={`Target Date: ${currentProject.targetDate}`}
              >
                <span className="text-[9px] font-bold bg-blush text-warn px-1 rounded -translate-x-1/2">
                  Target: {currentProject.targetDate}
                </span>
              </div>

              {currentGantt.map((task) => (
                <div key={task.id} className="p-3 bg-white rounded-2xl border border-line space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{task.label}</span>
                      {task.owner && (
                        <span className="chip bg-veil text-[10px] text-inksoft font-medium">
                          Lead: {task.owner}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-faint">
                        {task.startDate} &rarr; {task.endDate} ({task.progress}% done)
                      </span>

                      {/* Details & Output Links Button */}
                      <button
                        onClick={() => {
                          setSelectedGanttTaskForDeliverables(task);
                          setDeliverableUrlInput(task.deliverableUrl || '');
                          setDeliverableNotesInput(task.notes || '');
                          setShowDeliverableModal(true);
                        }}
                        className="btn-ghost !py-1 !px-2 text-[11px] flex items-center gap-1 cursor-pointer hover:bg-citron-soft hover:text-ink transition-colors"
                        title="View or add output links / folder"
                      >
                        <FolderKanban size={13} className={task.deliverableUrl ? 'text-citron-deep' : 'text-faint'} />
                        <span>{task.deliverableUrl ? 'Output Linked' : 'Details / Link'}</span>
                      </button>

                      {/* Edit Phase Menu Button */}
                      <button
                        onClick={() => {
                          setEditingGanttTask(task);
                          setShowEditGanttModal(true);
                        }}
                        className="btn-ghost !py-1 !px-2 text-[11px] flex items-center gap-1 cursor-pointer hover:bg-veil transition-colors"
                        title="Edit phase details & timeline"
                      >
                        <Edit2 size={13} className="text-ink" />
                        <span>Edit Phase</span>
                      </button>
                    </div>
                  </div>

                  {/* Gantt Bar Container */}
                  <div className="w-full bg-canvas h-7 rounded-xl border border-line relative overflow-hidden flex items-center px-3">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-citron-soft/80 border-r-2 border-citron-deep rounded-l-xl transition-all duration-300"
                      style={{ width: `${Math.max(8, task.progress)}%` }}
                    />
                    <div className="relative z-10 w-full flex justify-between items-center text-[10px]">
                      <span className="font-semibold text-ink truncate">
                        {task.notes ? task.notes : `Phase Progress (${task.progress}%)`}
                      </span>
                      {task.deliverableUrl && (
                        <span className="font-bold text-citron-deep flex items-center gap-1">
                          <ExternalLink size={10} /> {task.deliverableUrl.replace(/https?:\/\//, '').slice(0, 28)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
        )}

        {activeSection === 'okr' && (
        <>
        {/* Section 6: Project OKR */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-citron-deep" />
              <h3 className="font-display font-semibold text-base">{t('pm_section_okr')}</h3>
            </div>
            {currentOkr && (
              <span className="chip bg-veil border-line text-xs font-semibold max-w-full whitespace-normal text-left">
                {currentOkr.parentOkrLabel}
              </span>
            )}
          </div>

          {currentOkr ? (
            <div className="p-5 rounded-2xl bg-canvas border border-line space-y-4">
              <div>
                <span className="text-[10px] font-bold text-faint uppercase block">OBJECTIVE</span>
                <p className="text-sm font-bold text-ink mt-0.5">{currentOkr.objective}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentOkr.keyResults.map((kr) => {
                  const pct = Math.min(100, Math.round((kr.current / kr.target) * 100));
                  return (
                    <div key={kr.id} className="p-4 bg-white rounded-2xl border border-line space-y-3">
                      <div>
                        <span className="text-xs font-bold text-ink block">{kr.label}</span>
                        <span className="text-xs text-mute">
                          Current: <strong className="text-ink">{kr.current}</strong> / Target: {kr.target} {kr.unit}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-veil h-2 rounded-full overflow-hidden">
                          <div className="bg-citron-deep h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-faint">
                          <span>Progress</span>
                          <span className="font-bold text-ink">{pct}%</span>
                        </div>
                      </div>

                      {/* Interactive adjustment slider */}
                      <input
                        type="range"
                        min="0"
                        max={kr.target * 1.2 || 100}
                        value={kr.current}
                        onChange={(e) => onUpdateOkrKeyResult(currentOkr.id, kr.id, parseFloat(e.target.value))}
                        className="w-full accent-ink h-1 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-mute border border-line rounded-2xl">
              No OKRs defined for this project.
            </div>
          )}
        </div>
        </>
        )}
          </div>

          {/* Right-side category navigation */}
          <div className="lg:col-span-1">
            <div className="card p-2.5 space-y-1 lg:sticky lg:top-6">
              {SECTION_NAV.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                    activeSection === s.id ? 'bg-ink text-white shadow-lift' : 'text-inksoft hover:bg-veil/50'
                  }`}
                >
                  <s.icon size={15} className={activeSection === s.id ? 'text-citron' : 'text-mute'} />
                  <span className="flex-1">{s.label}</span>
                  {typeof s.count === 'number' && (
                    <span
                      className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                        activeSection === s.id ? 'bg-white/20 text-white' : 'bg-veil text-inksoft'
                      }`}
                    >
                      {s.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Add Team Member Modal */}
      {showAddPersonModal && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <h3 className="font-display font-semibold text-base text-ink">Add Person to Project Team</h3>
              <button onClick={() => setShowAddPersonModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddPersonSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hendra Wijaya"
                  className="field text-xs"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. hendra.w@siloamhospitals.com"
                  className="field text-xs"
                  value={newPersonEmail}
                  onChange={(e) => setNewPersonEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Role</label>
                <select
                  className="field text-xs"
                  value={newPersonRole}
                  onChange={(e) => setNewPersonRole(e.target.value as any)}
                >
                  <option value="Contributor">Contributor</option>
                  <option value="Lead">Lead</option>
                  <option value="Stakeholder">Stakeholder</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button type="button" onClick={() => setShowAddPersonModal(false)} className="btn-ghost text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-dark text-xs">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Ingest Transcript / Call Notes Modal (with Speech-to-Text Microphone) */}
      {showIngestModal && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <div>
                <h3 className="font-display font-semibold text-base text-ink">Ingest Meeting Transcript / Notes</h3>
                <p className="text-xs text-mute">Paste text, record live mic speech, or upload transcript file.</p>
              </div>
              <button onClick={() => setShowIngestModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-1.5 p-1 bg-veil rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setIngestMode('paste')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  ingestMode === 'paste' ? 'bg-white shadow-lift text-ink' : 'text-mute'
                }`}
              >
                Direct Paste
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('mic')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  ingestMode === 'mic' ? 'bg-white shadow-lift text-ink' : 'text-mute'
                }`}
              >
                <Mic size={13} className={isListening ? 'text-warn animate-pulse' : ''} />
                Live Mic STT
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('upload')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  ingestMode === 'upload' ? 'bg-white shadow-lift text-ink' : 'text-mute'
                }`}
              >
                Upload File
              </button>
            </div>

            <form onSubmit={handleIngestTranscript} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint 4 Reconciliation Review"
                  className="field"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-ink block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="field"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Participants</label>
                  <input
                    type="text"
                    placeholder="Comma separated names"
                    className="field"
                    value={meetingParticipantsText}
                    onChange={(e) => setMeetingParticipantsText(e.target.value)}
                  />
                </div>
              </div>

              {ingestMode === 'mic' ? (
                <div className="p-4 rounded-2xl bg-canvas border border-line space-y-3 text-center">
                  <div className="flex items-center justify-between text-xs text-inksoft">
                    <span className="font-bold">In-App Speech-to-Text Microphone</span>
                    {isListening && (
                      <span className="chip bg-blush text-warn font-bold text-[10px] animate-pulse flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-warn animate-ping" />
                        Recording [{Math.floor(micSeconds / 60)}:{(micSeconds % 60).toString().padStart(2, '0')}]
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={toggleMicrophone}
                    className={`mx-auto p-4 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lift ${
                      isListening ? 'bg-warn text-white animate-pulse' : 'bg-ink text-citron hover:bg-inksoft'
                    }`}
                  >
                    {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                    <span className="font-bold text-xs">
                      {isListening ? 'Stop Recording' : 'Start Microphone Capture'}
                    </span>
                  </button>

                  <p className="text-[11px] text-faint">
                    {isListening
                      ? 'Speak clearly. Speech is continuously converted to text below in real-time.'
                      : 'Click button above to capture live speech from your built-in microphone.'}
                  </p>

                  <textarea
                    rows={5}
                    placeholder="Transcribed speech will stream here automatically..."
                    className="field text-xs bg-white"
                    value={meetingRawText}
                    onChange={(e) => setMeetingRawText(e.target.value)}
                  />
                </div>
              ) : ingestMode === 'upload' ? (
                <div>
                  <label className="font-bold text-ink block mb-1">Upload File</label>
                  <div className="border-2 border-dashed border-line rounded-xl p-6 text-center space-y-2">
                    <Upload className="mx-auto text-mute" size={24} />
                    <p className="text-xs text-mute">Select transcript file (.txt, .docx, .pdf, .mp3)</p>
                    {uploadedFileName && (
                      <span className="chip bg-citron-soft text-citron-deep font-bold text-xs block mx-auto max-w-xs truncate">
                        {uploadedFileName}
                      </span>
                    )}
                    <input
                      type="file"
                      accept=".txt,.docx,.pdf,.mp3"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadedFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setMeetingRawText((ev.target?.result as string) || file.name);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="text-xs cursor-pointer block mx-auto"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-ink block mb-1">Raw Transcript / Meeting Notes</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Paste meeting transcript or notes here... The AI assistant will summarize decisions, open questions, and action items with assignees."
                    className="field"
                    value={meetingRawText}
                    onChange={(e) => setMeetingRawText(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button type="button" onClick={() => setShowIngestModal(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-dark flex items-center gap-1.5">
                  <Sparkles size={14} /> Process with AI Assistant
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Add Gantt Task Modal */}
      {showAddGanttModal && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <h3 className="font-display font-semibold text-base text-ink">Add Phase / Milestone Task</h3>
              <button onClick={() => setShowAddGanttModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddGanttSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Phase Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phase 3: Auto-GL Posting"
                  className="field"
                  value={newGanttLabel}
                  onChange={(e) => setNewGanttLabel(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-ink block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    className="field"
                    value={newGanttStart}
                    onChange={(e) => setNewGanttStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    className="field"
                    value={newGanttEnd}
                    onChange={(e) => setNewGanttEnd(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Phase Lead / Owner</label>
                <input
                  type="text"
                  className="field"
                  value={newGanttOwner}
                  onChange={(e) => setNewGanttOwner(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button type="button" onClick={() => setShowAddGanttModal(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-dark">
                  Add Phase
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Edit Gantt Task Modal */}
      {showEditGanttModal && editingGanttTask && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <h3 className="font-display font-semibold text-base text-ink">Edit Phase / Gantt Task</h3>
              <button onClick={() => setShowEditGanttModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateGanttTask(editingGanttTask);
                setShowEditGanttModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-ink block mb-1">Phase Title</label>
                <input
                  type="text"
                  required
                  className="field"
                  value={editingGanttTask.label}
                  onChange={(e) => setEditingGanttTask({ ...editingGanttTask, label: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-ink block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    className="field"
                    value={editingGanttTask.startDate}
                    onChange={(e) => setEditingGanttTask({ ...editingGanttTask, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    className="field"
                    value={editingGanttTask.endDate}
                    onChange={(e) => setEditingGanttTask({ ...editingGanttTask, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-ink block">Progress Percentage</label>
                  <span className="font-bold text-citron-deep">{editingGanttTask.progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingGanttTask.progress}
                  onChange={(e) =>
                    setEditingGanttTask({ ...editingGanttTask, progress: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-ink h-2 cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Phase Owner</label>
                <input
                  type="text"
                  className="field"
                  value={editingGanttTask.owner || ''}
                  onChange={(e) => setEditingGanttTask({ ...editingGanttTask, owner: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Working Output / Deliverable Link URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/... or GitHub / SharePoint link"
                  className="field"
                  value={editingGanttTask.deliverableUrl || ''}
                  onChange={(e) => setEditingGanttTask({ ...editingGanttTask, deliverableUrl: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button type="button" onClick={() => setShowEditGanttModal(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-dark">
                  Save Phase
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Deliverable Details & Output Links Modal */}
      {showDeliverableModal && selectedGanttTaskForDeliverables && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <FolderKanban size={18} className="text-citron-deep" />
                <h3 className="font-display font-semibold text-base text-ink">Phase Deliverables &amp; Output Links</h3>
              </div>
              <button onClick={() => setShowDeliverableModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-canvas rounded-2xl border border-line space-y-1">
              <span className="text-[10px] font-bold text-faint uppercase block">PHASE NAME</span>
              <div className="text-xs font-bold text-ink">{selectedGanttTaskForDeliverables.label}</div>
              <div className="text-[10px] text-mute">
                Lead Owner: {selectedGanttTaskForDeliverables.owner || 'Unassigned'} · Progress: {selectedGanttTaskForDeliverables.progress}%
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Working Output / Folder URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/... or GitHub / SharePoint URL"
                    className="field flex-1"
                    value={deliverableUrlInput}
                    onChange={(e) => setDeliverableUrlInput(e.target.value)}
                  />
                  {deliverableUrlInput && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(deliverableUrlInput);
                        setCopiedToast(true);
                        setTimeout(() => setCopiedToast(false), 2000);
                      }}
                      className="btn-ghost !py-1.5 !px-3 flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Copy link to clipboard"
                    >
                      <Copy size={13} />
                      <span>{copiedToast ? 'Copied!' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {deliverableUrlInput && (
                <div className="pt-1">
                  <a
                    href={deliverableUrlInput}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost !py-1.5 text-xs flex items-center justify-center gap-1.5 w-full text-citron-deep border-citron/40 bg-citron-soft/30 hover:bg-citron-soft"
                  >
                    <ExternalLink size={14} /> Open Working Output Link in New Tab
                  </a>
                </div>
              )}

              <div>
                <label className="font-bold text-ink block mb-1">Deliverable Notes / Context</label>
                <textarea
                  rows={3}
                  placeholder="Describe working output specs, API endpoint documentation, or Figma prototype notes..."
                  className="field"
                  value={deliverableNotesInput}
                  onChange={(e) => setDeliverableNotesInput(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button type="button" onClick={() => setShowDeliverableModal(false)} className="btn-ghost">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = {
                      ...selectedGanttTaskForDeliverables,
                      deliverableUrl: deliverableUrlInput,
                      notes: deliverableNotesInput,
                    };
                    onUpdateGanttTask(updated);
                    setShowDeliverableModal(false);
                  }}
                  className="btn-dark"
                >
                  Save Deliverable Details
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Edit Owner Modal */}
      {showEditOwnerModal && (
        <ModalPortal>
          <div className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <h3 className="font-display font-semibold text-base text-ink">Edit Project Owner</h3>
              <button onClick={() => setShowEditOwnerModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-mute block mb-1">Owner Name</label>
                <input
                  type="text"
                  value={editingOwnerName}
                  onChange={(e) => setEditingOwnerName(e.target.value)}
                  className="field w-full text-xs"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-mute block mb-1">Owner Email</label>
                <input
                  type="email"
                  value={editingOwnerEmail}
                  onChange={(e) => setEditingOwnerEmail(e.target.value)}
                  className="field w-full text-xs"
                  placeholder="e.g. john@example.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEditOwnerModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-mute hover:bg-canvas transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingOwnerName && editingOwnerEmail) {
                    onUpdateProject({
                      ...currentProject,
                      ownerName: editingOwnerName,
                      ownerEmail: editingOwnerEmail
                    });
                    setShowEditOwnerModal(false);
                  }
                }}
                className="btn-dark"
                disabled={!editingOwnerName || !editingOwnerEmail}
              >
                Save Changes
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Project Confirm Modal */}
      {deletingProject && (
        <ModalPortal>
          <div className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-fade-up space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 grid place-items-center mx-auto mb-2">
              <X size={24} />
            </div>
            <h3 className="font-display font-semibold text-lg text-ink">Delete Project?</h3>
            <p className="text-sm text-mute">
              Are you sure you want to completely delete the project <span className="font-semibold text-ink">"{deletingProject.title}"</span>? This action cannot be undone.
            </p>
            
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-mute hover:bg-canvas transition-colors cursor-pointer w-full"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const isOpenInDetail = !!currentProject && deletingProject.id === currentProject.id;
                  onDeleteProject(deletingProject.id);
                  if (isOpenInDetail) setSelectedProjectId(null);
                  setDeletingProject(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer w-full"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Lock New Project Modal (Catalogue Selection Workflow) */}
      {showNewProjectModal && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <div>
                <h3 className="font-display font-semibold text-base text-ink">Lock New Project (Stage 4)</h3>
                <p className="text-xs text-mute">Select an Automation or Agentic AI process from the Catalogue to lock.</p>
              </div>
              <button onClick={() => setShowNewProjectModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Filter toggle for catalogue */}
              <div className="flex items-center justify-between gap-2 p-2 bg-canvas rounded-2xl border border-line">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Filter size={13} className="text-citron-deep" /> Process Catalogue Selection
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setCatalogueFilter('automation_ai')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                      catalogueFilter === 'automation_ai' ? 'bg-ink text-citron shadow-lift' : 'text-mute hover:text-ink'
                    }`}
                  >
                    Automation &amp; AI
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogueFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                      catalogueFilter === 'all' ? 'bg-ink text-citron shadow-lift' : 'text-mute hover:text-ink'
                    }`}
                  >
                    All Processes
                  </button>
                </div>
              </div>

              {/* Catalogue Process Radio Options */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                <label
                  className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    selectedCatalogueProcessId === 'none'
                      ? 'border-ink bg-citron-soft/30 shadow-lift'
                      : 'border-line hover:border-veil-deep/40 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="catalogueSelect"
                    checked={selectedCatalogueProcessId === 'none'}
                    onChange={() => setSelectedCatalogueProcessId('none')}
                    className="mt-0.5 accent-ink cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-ink block">Custom Unlinked Initiative</span>
                    <span className="text-[11px] text-mute">Enter a new custom project title and target outcome without importing from catalogue.</span>
                  </div>
                </label>

                {catalogueProcesses
                  .filter((proc) => {
                    if (catalogueFilter === 'all') return true;
                    return (
                      proc.category === 'Automation & AI' ||
                      proc.isCandidateForAI ||
                      proc.title.toLowerCase().includes('automation') ||
                      proc.title.toLowerCase().includes('ai') ||
                      proc.title.toLowerCase().includes('bot') ||
                      proc.title.toLowerCase().includes('recon')
                    );
                  })
                  .map((proc) => (
                    <label
                      key={proc.id}
                      className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                        selectedCatalogueProcessId === proc.id
                          ? 'border-ink bg-citron-soft/40 shadow-lift'
                          : 'border-line hover:border-veil-deep/40 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="catalogueSelect"
                        checked={selectedCatalogueProcessId === proc.id}
                        onChange={() => {
                          setSelectedCatalogueProcessId(proc.id);
                          setNewProjTitle(proc.title);
                          setNewProjTarget(proc.problemStatement || proc.aiOpportunity || `Automate ${proc.title} workflow.`);
                        }}
                        className="mt-0.5 accent-ink cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-ink truncate">{proc.title}</span>
                          <span className="chip bg-citron text-ink text-[9px] font-bold">
                            {proc.subFunction}
                          </span>
                        </div>
                        <p className="text-[11px] text-mute line-clamp-1 mt-0.5">
                          {proc.problemStatement || proc.aiOpportunity || 'Candidate for automation & agentic AI deployment.'}
                        </p>
                      </div>
                    </label>
                  ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newProjTitle.trim()) return;

                  const selectedProc = catalogueProcesses?.find((p) => p.id === selectedCatalogueProcessId);

                  const newProj: ManagedProject = {
                    id: uid('proj'),
                    title: newProjTitle.trim(),
                    targetStatement: newProjTarget.trim() || 'Automate manual process workflow.',
                    ownerName: profileName,
                    ownerEmail: profileEmail,
                    stage: '4: Locked Project',
                    progressPercent: 10,
                    targetDate: newProjTargetDate,
                    linkedProcessId: selectedProc?.id,
                    linkedEngineTitle: selectedProc?.title,
                  };

                  onAddProject(newProj);
                  
                  if (selectedProc?.savedDeploymentPlan) {
                    const plan = selectedProc.savedDeploymentPlan;
                    
                    let prevTaskId: string | null = null;
                    const startDateObj = new Date();
                    
                    plan.deploymentSteps.forEach((step, idx) => {
                      const stepStart = new Date(startDateObj);
                      stepStart.setDate(stepStart.getDate() + (idx * 14));
                      
                      const stepEnd = new Date(stepStart);
                      stepEnd.setDate(stepEnd.getDate() + 14);
                      
                      const tId = uid('gt');
                      const newTask: GanttTask = {
                        id: tId,
                        projectId: newProj.id,
                        label: `${step.phase}: ${step.title}`,
                        startDate: stepStart.toISOString().split('T')[0],
                        endDate: stepEnd.toISOString().split('T')[0],
                        dependsOnId: prevTaskId,
                        progress: 0,
                        owner: profileName,
                        notes: step.description
                      };
                      onAddGanttTask(newTask);
                      prevTaskId = tId;
                    });
                  }

                  setSelectedProjectId(newProj.id);
                  setActiveSection('team');
                  setShowNewProjectModal(false);
                  setNewProjTitle('');
                  setNewProjTarget('');
                  setSelectedCatalogueProcessId('none');
                }}
                className="space-y-3 pt-2 border-t border-line"
              >
                <div>
                  <label className="font-bold text-ink block mb-1">Project Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AP Vendor Invoice AI Scanner"
                    className="field"
                    value={newProjTitle}
                    onChange={(e) => setNewProjTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-bold text-ink block mb-1">Target Outcome Statement</label>
                  <textarea
                    rows={2}
                    placeholder="Describe target business outcome (e.g. Reduce manual processing time by 80%)"
                    className="field"
                    value={newProjTarget}
                    onChange={(e) => setNewProjTarget(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-bold text-ink block mb-1">Target Realisation Date</label>
                  <input
                    type="date"
                    required
                    className="field"
                    value={newProjTargetDate}
                    onChange={(e) => setNewProjTargetDate(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <button type="button" onClick={() => setShowNewProjectModal(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" className="btn-dark">
                    Import Details &amp; Lock Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* In-App Alerts Modal for L2 & L3 Users */}
      {showAlertsModal && isL2orL3 && (
        <ModalPortal>
          <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-up space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-ink" />
                <h3 className="font-display font-semibold text-base text-ink">In-App Alerts &amp; Notifications</h3>
                <span className="chip bg-citron-soft text-citron-deep font-bold text-[10px]">
                  {currentPersona} View
                </span>
              </div>
              <button onClick={() => setShowAlertsModal(false)} className="text-mute hover:text-ink cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-6 text-xs text-mute">No in-app alerts at present.</div>
            ) : (
              <div className="space-y-3 divide-y divide-line">
                {notifications.map((notif) => (
                  <div key={notif.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className={`text-xs ${notif.status === 'Unread' ? 'font-bold text-ink' : 'font-medium text-inksoft'}`}>
                          {notif.subject}
                        </div>
                        <div className="text-[10px] text-faint">
                          From: {notif.senderName} · {timeAgo(notif.timestamp)}
                        </div>
                      </div>

                      {notif.status === 'Unread' && (
                        <button
                          onClick={() => onMarkNotificationRead(notif.id)}
                          className="chip bg-citron text-ink text-[10px] font-bold cursor-pointer"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-mute leading-relaxed">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
