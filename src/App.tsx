import { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import Onboarding from './components/Onboarding';
import LockScreen from './components/LockScreen';
import CaptureJourney from './components/journey/CaptureJourney';
import Workspace from './components/Workspace';

import {
  AppPhase,
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
} from './types';
import {
  MOCK_PROCESSES,
  MOCK_SYSTEMS,
  MOCK_NOTIFICATIONS,
  MOCK_NOTIFICATION_LOGS,
  MOCK_IMPROVEMENT_ITEMS,
} from './data/mockData';
import {
  INITIAL_MANAGED_PROJECTS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_TRANSCRIPTS,
  INITIAL_MEETING_NOTES,
  INITIAL_GANTT_TASKS,
  INITIAL_PROJECT_OKRS,
} from './data/projectData';
import { uid } from './lib/utils';

const STORAGE = {
  profile: 'bp_profile',
  phase: 'bp_phase',
  processes: 'bp_processes',
  systems: 'bp_systems',
  unlocked: 'bp_unlocked', // sessionStorage — cleared when the browser tab closes
  projects: 'bp_projects',
  teamMembers: 'bp_team_members',
  transcripts: 'bp_transcripts',
  meetingNotes: 'bp_meeting_notes',
  ganttTasks: 'bp_gantt_tasks',
  projectOkrs: 'bp_project_okrs',
} as const;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const loaded = loadJSON<UserProfile | null>(STORAGE.profile, null);
    if (loaded) {
      const isNicole = loaded.name.toLowerCase().includes('nicole') || (loaded.email || '').toLowerCase().includes('nicole');
      if (isNicole && loaded.role !== 'Admin') {
        loaded.role = 'Admin';
        localStorage.setItem(STORAGE.profile, JSON.stringify(loaded));
      }
    }
    return loaded;
  });

  const [phase, setPhase] = useState<AppPhase>(() => {
    const saved = loadJSON<UserProfile | null>(STORAGE.profile, null);
    if (!saved) return 'landing';
    if (sessionStorage.getItem(STORAGE.unlocked) !== 'true') return 'locked';
    const savedPhase = localStorage.getItem(STORAGE.phase);
    return savedPhase === 'journey' || savedPhase === 'workspace' ? savedPhase : 'journey';
  });

  // Which workspace tab to open when entering the workspace (recap choices route here)
  const [workspaceTab, setWorkspaceTab] = useState<string>('dashboard');
  const [focusProcessId, setFocusProcessId] = useState<string | null>(null);

  const [currentPersona, setCurrentPersona] = useState<Persona>(() => {
    const loaded = loadJSON<UserProfile | null>(STORAGE.profile, null);
    if (loaded) {
      const isNicole = loaded.name.toLowerCase().includes('nicole') || (loaded.email || '').toLowerCase().includes('nicole');
      if (isNicole) return 'Admin';
      return loaded.role;
    }
    return 'L4';
  });

  // ---------- Data layer (local-first, mock-seeded) ----------
  const [processes, setProcesses] = useState<Process[]>(() => {
    const loaded = loadJSON<Process[]>(STORAGE.processes, MOCK_PROCESSES);
    if (!loaded.some(p => p.id === 'proc-ai-reconciliation')) {
      const target = MOCK_PROCESSES.find(p => p.id === 'proc-ai-reconciliation');
      if (target) {
        return [target, ...loaded];
      }
    }
    return loaded;
  });
  const [availableSystems, setAvailableSystems] = useState<SystemItem[]>(() => loadJSON(STORAGE.systems, MOCK_SYSTEMS));
  const [notifications, setNotifications] = useState<UserNotification[]>(MOCK_NOTIFICATIONS);
  const [adminBroadcastLogs, setAdminBroadcastLogs] = useState<NotificationLog[]>(MOCK_NOTIFICATION_LOGS);
  const [improvementItems, setImprovementItems] = useState<ImprovementItem[]>(MOCK_IMPROVEMENT_ITEMS);

  // ---------- Project Management state ----------
  const [managedProjects, setManagedProjects] = useState<ManagedProject[]>(() => loadJSON(STORAGE.projects, INITIAL_MANAGED_PROJECTS));
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => loadJSON(STORAGE.teamMembers, INITIAL_TEAM_MEMBERS));
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>(() => loadJSON(STORAGE.transcripts, INITIAL_TRANSCRIPTS));
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>(() => loadJSON(STORAGE.meetingNotes, INITIAL_MEETING_NOTES));
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(() => loadJSON(STORAGE.ganttTasks, INITIAL_GANTT_TASKS));
  const [projectOkrs, setProjectOkrs] = useState<ProjectOKR[]>(() => loadJSON(STORAGE.projectOkrs, INITIAL_PROJECT_OKRS));

  useEffect(() => {
    localStorage.setItem(STORAGE.processes, JSON.stringify(processes));
  }, [processes]);

  useEffect(() => {
    localStorage.setItem(STORAGE.systems, JSON.stringify(availableSystems));
  }, [availableSystems]);

  useEffect(() => {
    localStorage.setItem(STORAGE.projects, JSON.stringify(managedProjects));
  }, [managedProjects]);

  useEffect(() => {
    localStorage.setItem(STORAGE.teamMembers, JSON.stringify(teamMembers));
  }, [teamMembers]);

  useEffect(() => {
    localStorage.setItem(STORAGE.transcripts, JSON.stringify(transcripts));
  }, [transcripts]);

  useEffect(() => {
    localStorage.setItem(STORAGE.meetingNotes, JSON.stringify(meetingNotes));
  }, [meetingNotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE.ganttTasks, JSON.stringify(ganttTasks));
  }, [ganttTasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE.projectOkrs, JSON.stringify(projectOkrs));
  }, [projectOkrs]);

  useEffect(() => {
    if (phase === 'journey' || phase === 'workspace') {
      localStorage.setItem(STORAGE.phase, phase);
    }
  }, [phase]);

  // ---------- Phase transitions ----------
  const handleOnboardingComplete = (newProfile: UserProfile) => {
    localStorage.setItem(STORAGE.profile, JSON.stringify(newProfile));
    sessionStorage.setItem(STORAGE.unlocked, 'true');
    setProfile(newProfile);
    setCurrentPersona(newProfile.role);
    setPhase('journey');
  };

  const handleUnlock = (updatedProfile?: UserProfile) => {
    if (updatedProfile) {
      localStorage.setItem(STORAGE.profile, JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
    }
    sessionStorage.setItem(STORAGE.unlocked, 'true');
    const savedPhase = localStorage.getItem(STORAGE.phase);
    setPhase(savedPhase === 'workspace' ? 'workspace' : 'journey');
  };

  const handleStartOver = () => {
    localStorage.removeItem(STORAGE.profile);
    localStorage.removeItem(STORAGE.phase);
    sessionStorage.removeItem(STORAGE.unlocked);
    setProfile(null);
    setPhase('landing');
  };

  const handleLock = () => {
    sessionStorage.removeItem(STORAGE.unlocked);
    setPhase('locked');
  };

  // ---------- Process actions ----------
  const handleSaveProcess = (newProcess: Process) => {
    setProcesses((prev) => {
      const exists = prev.some((p) => p.id === newProcess.id);
      return exists ? prev.map((p) => (p.id === newProcess.id ? newProcess : p)) : [newProcess, ...prev];
    });
  };

  const handleDeleteProcess = (id: string) => {
    setProcesses((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddSystem = (systemName: string) => {
    setAvailableSystems((prev) => {
      if (prev.some((s) => s.name.toLowerCase() === systemName.toLowerCase())) return prev;
      return [...prev, { id: uid('sys'), name: systemName, category: 'Unclassified ERP App', processCount: 1 }];
    });
  };

  // ---------- Notification actions ----------
  const handleMarkRead = (notifId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, status: 'Read' } : n)));
  };

  const handleActionNotification = (notifId: string, responseText: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, status: 'Actioned', responseText } : n)));
  };

  const handleTriggerReminder = (_targetEmail: string, subject: string, msg: string) => {
    setNotifications((prev) => [
      {
        id: uid('notif'),
        senderName: profile?.name ? `${profile.name} (Manager)` : 'Unit Manager',
        subject,
        message: msg,
        timestamp: new Date().toISOString(),
        status: 'Unread',
        actionRequired: true,
      },
      ...prev,
    ]);
  };

  const handleTriggerAdminNotification = (
    subject: string,
    msg: string,
    type: 'individual' | 'level' | 'subfunction' | 'all',
    val: string,
  ) => {
    const senderName = profile?.name ? `${profile.name} (Admin)` : 'Programme Admin';
    setAdminBroadcastLogs((prev) => [
      {
        id: uid('log'),
        senderName,
        subject,
        message: msg,
        targetType: type,
        targetValue: val,
        timestamp: new Date().toISOString(),
        status: 'Sent',
        responsesCount: 0,
      },
      ...prev,
    ]);
    setNotifications((prev) => [
      {
        id: uid('notif'),
        senderName,
        subject,
        message: msg,
        timestamp: new Date().toISOString(),
        status: 'Unread',
        actionRequired: true,
      },
      ...prev,
    ]);
  };

  const handleAddImprovementItem = (item: ImprovementItem) => {
    setImprovementItems((prev) => [item, ...prev]);
  };

  const handleUpdateImprovementItem = (updated: ImprovementItem) => {
    setImprovementItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  // ---------- Project Management actions ----------
  const handleUpdateProject = (updated: ManagedProject) => {
    setManagedProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleAddProject = (newProj: ManagedProject) => {
    setManagedProjects((prev) => [newProj, ...prev]);
  };

  const handleDeleteProject = (projectId: string) => {
    setManagedProjects((prev) => prev.filter((p) => p.id !== projectId));
    // Optional: Also clean up related entities if we wanted to be perfectly clean
  };

  const handleAddTeamMember = (member: TeamMember) => {
    setTeamMembers((prev) => [...prev, member]);
  };

  const handleRemoveTeamMember = (memberId: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleAddTranscript = (tr: MeetingTranscript) => {
    setTranscripts((prev) => [tr, ...prev]);
  };

  const handleAddMeetingNote = (note: MeetingNote) => {
    setMeetingNotes((prev) => [note, ...prev]);
  };

  const handleUpdateMeetingNote = (note: MeetingNote) => {
    setMeetingNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
  };

  const handleUpdateActionItemStatus = (noteId: string, itemId: string, status: 'pending' | 'sent' | 'acknowledged') => {
    setMeetingNotes((prev) =>
      prev.map((note) => {
        if (note.id !== noteId) return note;
        return {
          ...note,
          actionItems: note.actionItems.map((item) => (item.id === itemId ? { ...item, status } : item)),
        };
      })
    );
  };

  const handleAddGanttTask = (task: GanttTask) => {
    setGanttTasks((prev) => [...prev, task]);
  };

  const handleUpdateGanttTask = (task: GanttTask) => {
    setGanttTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  };

  const handleUpdateOkrKeyResult = (okrId: string, krId: string, currentVal: number) => {
    setProjectOkrs((prev) =>
      prev.map((okr) => {
        if (okr.id !== okrId) return okr;
        return {
          ...okr,
          keyResults: okr.keyResults.map((kr) => (kr.id === krId ? { ...kr, current: currentVal } : kr)),
        };
      })
    );
  };

  const handleImportData = (
    data: {
      processes?: Process[];
      systems?: SystemItem[];
      profile?: UserProfile;
      improvementItems?: ImprovementItem[];
      notifications?: UserNotification[];
      adminBroadcastLogs?: NotificationLog[];
    },
    mode: 'merge' | 'overwrite'
  ) => {
    if (mode === 'overwrite') {
      if (data.profile) {
        localStorage.setItem(STORAGE.profile, JSON.stringify(data.profile));
        setProfile(data.profile);
        setCurrentPersona(data.profile.role);
      }
      if (data.processes) {
        setProcesses(data.processes);
      }
      if (data.systems) {
        setAvailableSystems(data.systems);
      }
      if (data.improvementItems) {
        setImprovementItems(data.improvementItems);
      }
      if (data.notifications) {
        setNotifications(data.notifications);
      }
      if (data.adminBroadcastLogs) {
        setAdminBroadcastLogs(data.adminBroadcastLogs);
      }
    } else {
      if (data.profile && !profile) {
        localStorage.setItem(STORAGE.profile, JSON.stringify(data.profile));
        setProfile(data.profile);
        setCurrentPersona(data.profile.role);
      }
      
      if (data.processes) {
        setProcesses((prev) => {
          const merged = [...prev];
          data.processes!.forEach((importedProc) => {
            const index = merged.findIndex((p) => p.id === importedProc.id);
            if (index > -1) {
              merged[index] = importedProc;
            } else {
              merged.push(importedProc);
            }
          });
          return merged;
        });
      }

      if (data.systems) {
        setAvailableSystems((prev) => {
          const merged = [...prev];
          data.systems!.forEach((importedSys) => {
            const index = merged.findIndex((s) => s.id === importedSys.id || s.name.toLowerCase() === importedSys.name.toLowerCase());
            if (index > -1) {
              merged[index] = {
                ...merged[index],
                ...importedSys,
                processCount: Math.max(merged[index].processCount, importedSys.processCount),
              };
            } else {
              merged.push(importedSys);
            }
          });
          return merged;
        });
      }

      if (data.improvementItems) {
        setImprovementItems((prev) => {
          const merged = [...prev];
          data.improvementItems!.forEach((importedImp) => {
            if (!merged.some((item) => item.id === importedImp.id)) {
              merged.push(importedImp);
            }
          });
          return merged;
        });
      }

      if (data.notifications) {
        setNotifications((prev) => {
          const merged = [...prev];
          data.notifications!.forEach((importedNotif) => {
            if (!merged.some((item) => item.id === importedNotif.id)) {
              merged.push(importedNotif);
            }
          });
          return merged;
        });
      }

      if (data.adminBroadcastLogs) {
        setAdminBroadcastLogs((prev) => {
          const merged = [...prev];
          data.adminBroadcastLogs!.forEach((importedLog) => {
            if (!merged.some((item) => item.id === importedLog.id)) {
              merged.push(importedLog);
            }
          });
          return merged;
        });
      }
    }
  };

  // ---------- Render current phase ----------
  if (phase === 'landing') {
    return <LandingPage onStart={() => setPhase('onboarding')} />;
  }

  if (phase === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} onBack={() => setPhase('landing')} />;
  }

  if (phase === 'locked' && profile) {
    return <LockScreen profile={profile} onUnlock={handleUnlock} onStartOver={handleStartOver} />;
  }

  if (phase === 'journey' && profile) {
    return (
      <CaptureJourney
        profile={profile}
        allProcesses={processes}
        availableSystems={availableSystems}
        onAddSystem={handleAddSystem}
        onSaveProcess={handleSaveProcess}
        onFinish={(destinationTab, processId) => {
          setWorkspaceTab(destinationTab);
          setFocusProcessId(processId ?? null);
          setPhase('workspace');
        }}
        onSkipToWorkspace={() => {
          setWorkspaceTab(currentPersona === 'Admin' ? 'admin' : 'dashboard');
          setPhase('workspace');
        }}
      />
    );
  }

  if (phase === 'workspace' && profile) {
    return (
      <Workspace
        profile={profile}
        currentPersona={currentPersona}
        setCurrentPersona={setCurrentPersona}
        initialTab={workspaceTab}
        focusProcessId={focusProcessId}
        clearFocusProcess={() => setFocusProcessId(null)}
        processes={processes}
        availableSystems={availableSystems}
        onUpdateSystems={setAvailableSystems}
        notifications={notifications}
        adminBroadcastLogs={adminBroadcastLogs}
        improvementItems={improvementItems}
        onSaveProcess={handleSaveProcess}
        onDeleteProcess={handleDeleteProcess}
        onAddSystem={handleAddSystem}
        onMarkRead={handleMarkRead}
        onActionNotification={handleActionNotification}
        onTriggerReminder={handleTriggerReminder}
        onTriggerAdminNotification={handleTriggerAdminNotification}
        onAddImprovementItem={handleAddImprovementItem}
        onUpdateImprovementItem={handleUpdateImprovementItem}
        projectsManaged={managedProjects}
        teamMembers={teamMembers}
        transcripts={transcripts}
        meetingNotes={meetingNotes}
        ganttTasks={ganttTasks}
        projectOkrs={projectOkrs}
        onUpdateProject={handleUpdateProject}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
        onAddTeamMember={handleAddTeamMember}
        onRemoveTeamMember={handleRemoveTeamMember}
        onAddTranscript={handleAddTranscript}
        onAddMeetingNote={handleAddMeetingNote}
        onUpdateMeetingNote={handleUpdateMeetingNote}
        onUpdateActionItemStatus={handleUpdateActionItemStatus}
        onAddGanttTask={handleAddGanttTask}
        onUpdateGanttTask={handleUpdateGanttTask}
        onUpdateOkrKeyResult={handleUpdateOkrKeyResult}
        onCaptureNew={() => setPhase('journey')}
        onLock={handleLock}
        onImportData={handleImportData}
      />
    );
  }

  // Fallback — inconsistent persisted state, restart cleanly.
  return <LandingPage onStart={() => setPhase('onboarding')} />;
}
