import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Upload,
  Database,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  X,
  FileJson,
  Plus,
  RefreshCw
} from 'lucide-react';
import {
  Process,
  SystemItem,
  UserProfile,
  ImprovementItem,
  UserNotification,
  NotificationLog
} from '../types';

interface BackupData {
  version: string;
  timestamp: string;
  profile?: UserProfile;
  processes?: Process[];
  systems?: SystemItem[];
  improvementItems?: ImprovementItem[];
  notifications?: UserNotification[];
  adminBroadcastLogs?: NotificationLog[];
}

export default function LocalDataHub({
  profile,
  processes,
  availableSystems,
  improvementItems,
  notifications,
  adminBroadcastLogs,
  onImportComplete,
  onClose,
}: {
  profile: UserProfile;
  processes: Process[];
  availableSystems: SystemItem[];
  improvementItems: ImprovementItem[];
  notifications: UserNotification[];
  adminBroadcastLogs: NotificationLog[];
  onImportComplete: (data: {
    processes?: Process[];
    systems?: SystemItem[];
    profile?: UserProfile;
    improvementItems?: ImprovementItem[];
    notifications?: UserNotification[];
    adminBroadcastLogs?: NotificationLog[];
  }, mode: 'merge' | 'overwrite') => void;
  onClose: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<BackupData | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- EXPORT LOGIC ----------
  const handleExport = () => {
    try {
      const backup: BackupData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        profile,
        processes,
        systems: availableSystems,
        improvementItems,
        notifications,
        adminBroadcastLogs,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      
      link.href = url;
      link.download = `blueprint_backup_${safeName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to generate export file.');
    }
  };

  // ---------- FILE PARSING & VALIDATION ----------
  const processFile = (file: File) => {
    setError(null);
    setParsedData(null);

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setError('Please select a valid JSON backup file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text) as BackupData;

        // Basic structural validation
        if (!json || typeof json !== 'object') {
          setError('Invalid backup file: Format is not a valid JSON object.');
          return;
        }

        const hasProcesses = Array.isArray(json.processes);
        const hasSystems = Array.isArray(json.systems);

        if (!hasProcesses && !hasSystems && !json.profile) {
          setError('This JSON does not appear to contain Blueprint platform data (no processes or systems found).');
          return;
        }

        setParsedData(json);
      } catch (err) {
        setError('Failed to parse JSON file. Ensure the file is not corrupted.');
      }
    };
    reader.readAsText(file);
  };

  // Drag & drop handlers
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // ---------- IMPORT APPLY ACTIONS ----------
  const applyImport = (mode: 'merge' | 'overwrite') => {
    if (!parsedData) return;

    onImportComplete({
      processes: parsedData.processes,
      systems: parsedData.systems,
      profile: parsedData.profile,
      improvementItems: parsedData.improvementItems,
      notifications: parsedData.notifications,
      adminBroadcastLogs: parsedData.adminBroadcastLogs,
    }, mode);

    setSuccessMsg(`Successfully ${mode === 'merge' ? 'merged' : 'restored'} local data!`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div id="local-data-hub-overlay" className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="glass w-full max-w-2xl rounded-card p-6 md:p-8 flex flex-col max-h-[90vh] overflow-hidden shadow-double bg-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-citron-soft text-ink grid place-items-center">
              <ArrowLeftRight size={18} />
            </span>
            <div>
              <h2 className="font-display font-semibold text-lg leading-tight">Local Data Transfer</h2>
              <p className="text-xs text-mute mt-0.5">Import, export, and feed local data to another disk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full grid place-items-center hover:bg-veil text-mute hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div ref={(el) => { if (el) el.scrollTop = 0; }} className="flex-1 overflow-y-auto py-6 space-y-6">
          {successMsg ? (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
              <span className="w-16 h-16 rounded-full bg-ok/10 text-ok grid place-items-center animate-bounce">
                <CheckCircle2 size={36} />
              </span>
              <h3 className="font-display font-semibold text-lg">{successMsg}</h3>
              <p className="text-xs text-mute max-w-xs">Updating workspace database state...</p>
            </div>
          ) : (
            <>
              {/* Dual Action Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Column */}
                <div className="border border-line rounded-2xl p-5 bg-canvas-soft/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-ink font-semibold text-sm">
                      <Download size={16} className="text-mute" />
                      <span>Export Data Bundle</span>
                    </div>
                    <p className="text-xs text-mute leading-relaxed">
                      Backup and download your entire local profile, documented processes, custom systems, and AI classifications as a single portable JSON file.
                    </p>
                  </div>
                  <button
                    onClick={handleExport}
                    className="btn-dark w-full mt-5 text-xs flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Download Backup (.json)
                  </button>
                </div>

                {/* Info Box */}
                <div className="border border-line rounded-2xl p-5 bg-citron/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-ink font-semibold text-sm">
                      <Database size={16} className="text-citron-deep" />
                      <span>Front-End Storage</span>
                    </div>
                    <p className="text-xs text-mute leading-relaxed">
                      Blueprint operates with privacy-first local storage. By exporting your data, you can import it on another computer or browser tab to resume exactly where you left off.
                    </p>
                  </div>
                  <div className="text-[10px] text-faint border-t border-line/60 pt-3 mt-3 flex items-center gap-1.5 font-mono">
                    <CheckCircle2 size={11} className="text-ok shrink-0" />
                    <span>No cloud accounts or servers needed</span>
                  </div>
                </div>
              </div>

              {/* Import Section */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs text-ink uppercase tracking-wider">Import Data Bundle</h4>
                
                {/* Drag and Drop Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                    dragActive
                      ? 'border-ink bg-veil-soft'
                      : parsedData
                      ? 'border-ok/50 bg-ok/5'
                      : 'border-line hover:border-faint hover:bg-canvas-soft/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".json"
                    onChange={handleFileChange}
                  />

                  {parsedData ? (
                    <span className="w-12 h-12 rounded-full bg-ok/15 text-ok grid place-items-center">
                      <FileJson size={22} />
                    </span>
                  ) : (
                    <span className="w-12 h-12 rounded-full bg-canvas text-mute grid place-items-center">
                      <Upload size={20} />
                    </span>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-ink">
                      {parsedData ? 'Selected backup package loaded!' : 'Drag and drop your .json backup file here'}
                    </p>
                    <p className="text-[11px] text-mute mt-1">
                      {parsedData ? 'Review summary below before proceeding' : 'or click to browse your local disk'}
                    </p>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-bad/10 border border-bad/20 p-3.5 flex gap-2.5 text-xs text-bad"
                  >
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Data Preview Summary */}
                <AnimatePresence>
                  {parsedData && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-line rounded-2xl overflow-hidden"
                    >
                      <div className="bg-canvas-soft/60 px-4 py-3 border-b border-line text-xs font-semibold text-ink flex items-center justify-between">
                        <span>Backup File Overview</span>
                        <span className="text-[10px] font-normal text-mute">
                          Generated: {new Date(parsedData.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="p-4 grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <div className="text-mute">Profile Holder</div>
                          <div className="font-semibold text-ink">
                            {parsedData.profile?.name || 'Anonymous User'} 
                            <span className="ml-1.5 chip py-0.5 px-1.5 text-[10px]">{parsedData.profile?.role || 'L4'}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-mute">Processes Packaged</div>
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            <span className="text-sm font-bold">{parsedData.processes?.length || 0}</span>
                            <span className="text-[10px] text-faint">documented workflows</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-mute">Systems Tracker</div>
                          <div className="font-semibold text-ink flex items-center gap-1.5">
                            <span className="text-sm font-bold">{parsedData.systems?.length || 0}</span>
                            <span className="text-[10px] text-faint">referenced applications</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-mute">Backup Version</div>
                          <div className="font-semibold text-ink">
                            v{parsedData.version || '1.0'}
                          </div>
                        </div>
                      </div>

                      <div className="bg-citron/5 p-4 border-t border-line space-y-3">
                        <div className="flex items-start gap-2 text-[11px] text-citron-deep leading-relaxed">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span>
                            How do you want to apply this backup bundle? Merging is safe and won't overwrite existing unique processes. Overwriting performs a complete factory restore.
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            onClick={() => applyImport('merge')}
                            className="btn-dark text-xs flex items-center justify-center gap-2 py-3"
                          >
                            <Plus size={14} /> Merge with current data
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Warning: This will wipe your current local browser data for this app and replace it with the backup content. Continue?')) {
                                applyImport('overwrite');
                              }
                            }}
                            className="btn-ghost !border-bad text-bad hover:bg-bad/5 text-xs flex items-center justify-center gap-2 py-3"
                          >
                            <RefreshCw size={13} /> Restore & Wipe current
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
