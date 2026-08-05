import {
  BookOpen,
  FileText,
  FolderKanban,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Persona } from '../types';

export interface NavItem {
  id: string;
  label: string;
  shortLabel: string; // fits a phone bottom-tab without truncating mid-word
  icon: typeof LayoutDashboard;
  roles: Persona[];
  badge?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard, roles: ['L1', 'L2', 'L3'] },
  { id: 'catalogue', label: 'Catalogue', shortLabel: 'Catalogue', icon: BookOpen, roles: ['L1', 'L2', 'L3', 'L4', 'Admin'] },
  { id: 'prd_hub', label: 'Consolidated PRD Hub', shortLabel: 'PRD Hub', icon: FileText, roles: ['L2', 'Admin'] },
  { id: 'capture', label: 'Capture a process', shortLabel: 'Capture', icon: PlusCircle, roles: ['L1', 'L2', 'L3', 'L4'] },
  { id: 'refinement', label: 'AI Refinement', shortLabel: 'AI Refine', icon: Sparkles, roles: ['L1', 'L2', 'L3', 'L4', 'Admin'] },
  { id: 'notifications', label: 'Project Management', shortLabel: 'Projects', icon: FolderKanban, roles: ['L2', 'L3', 'L4', 'Admin'] },
  { id: 'admin', label: 'Programme admin', shortLabel: 'Admin', icon: ShieldCheck, roles: ['Admin'] },
];

const PERSONA_LABELS: Record<Persona, string> = {
  L1: 'CFO',
  L2: 'GM / Head',
  L3: 'Manager',
  L4: 'Executor',
  Admin: 'Admin',
};

export default function Sidebar({
  currentTab,
  setCurrentTab,
  currentPersona,
  setPersona,
  unreadNotifications,
  onCaptureNew,
  onLock,
  profileRole,
}: {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentPersona: Persona;
  setPersona: (persona: Persona) => void;
  unreadNotifications: number;
  onCaptureNew: () => void;
  onLock: () => void;
  profileRole: Persona;
}) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(currentPersona));

  const badgeFor = (itemId: string) =>
    itemId === 'notifications' && (currentPersona === 'L2' || currentPersona === 'L3') ? unreadNotifications : 0;

  return (
    <>
      {/* Desktop / tablet: vertical icon rail on the left */}
      <aside className="hidden sm:flex shrink-0 py-4 pl-4 flex-col z-10 print:hidden">
        <div className="glass rounded-full flex flex-col items-center gap-1.5 px-2 py-3 flex-1 max-h-full">
          {/* Brand — clicking the logo opens the process documentation (catalogue) */}
          <button
            onClick={() => setCurrentTab('catalogue')}
            title="Blueprint — go to the process catalogue"
            aria-label="Blueprint — go to the process catalogue"
            className="w-11 h-11 rounded-full bg-ink text-citron grid place-items-center mb-2 shrink-0 cursor-pointer transition-transform hover:scale-105"
          >
            <Sparkles size={17} />
          </button>

          {/* Nav icons */}
          <nav className="flex flex-col items-center gap-1.5">
            {items.map((item) => {
              const active = currentTab === item.id;
              const badge = badgeFor(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => (item.id === 'capture' ? onCaptureNew() : setCurrentTab(item.id))}
                  title={item.label}
                  aria-label={item.label}
                  className={`relative w-11 h-11 rounded-full grid place-items-center transition-all cursor-pointer ${
                    active
                      ? 'bg-ink text-white shadow-lift'
                      : 'text-mute hover:bg-white/80 hover:text-ink'
                  }`}
                >
                  <item.icon size={18} />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-citron text-ink text-[10px] font-bold grid place-items-center border-2 border-white">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />
        </div>
      </aside>

      {/* Phone: bottom tab bar instead of the side rail — thumb-reachable, no width stolen from content */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 print:hidden bg-white/90 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex items-stretch overflow-x-auto scrollbar-none">
          {items.map((item) => {
            const active = currentTab === item.id;
            const badge = badgeFor(item.id);
            return (
              <button
                key={item.id}
                onClick={() => (item.id === 'capture' ? onCaptureNew() : setCurrentTab(item.id))}
                aria-label={item.label}
                className={`relative flex-1 min-w-16 flex flex-col items-center justify-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
                  active ? 'text-ink' : 'text-faint'
                }`}
              >
                <item.icon size={19} className={active ? 'text-ink' : 'text-faint'} />
                {badge > 0 && (
                  <span className="absolute top-1 right-1/4 min-w-3.5 h-3.5 px-0.5 rounded-full bg-citron text-ink text-[8px] font-bold grid place-items-center border border-white">
                    {badge}
                  </span>
                )}
                <span className="text-[9px] font-semibold leading-none truncate max-w-full px-1">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
