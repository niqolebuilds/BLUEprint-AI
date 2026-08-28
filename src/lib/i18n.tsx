import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

/**
 * Lightweight in-app translation layer — English / Indonesian. Scoped to the
 * post-login Workspace shell (sidebar, header, dashboard, project
 * management chrome): the parts every user sees on every screen. Deeper
 * forms, AI-generated content, and a user's own captured process text stay
 * in whatever language the user typed them in — those aren't UI chrome, so
 * translating them isn't this switch's job.
 *
 * Indonesian copy is deliberately casual-friendly (informal "kamu"/"-mu",
 * everyday words) rather than formal business Indonesian — matches how
 * modern Indonesian consumer apps talk to their users.
 */

export type Language = 'en' | 'id';

const STORAGE_KEY = 'bp_language';

type Dict = Record<string, string>;

const EN: Dict = {
  // Sidebar / navigation
  nav_dashboard: 'Dashboard',
  nav_dashboard_short: 'Dashboard',
  nav_catalogue: 'Catalogue',
  nav_catalogue_short: 'Catalogue',
  nav_prd_hub: 'Consolidated PRD Hub',
  nav_prd_hub_short: 'PRD Hub',
  nav_capture: 'Capture a process',
  nav_capture_short: 'Capture',
  nav_refinement: 'AI Refinement',
  nav_refinement_short: 'AI Refine',
  nav_notifications: 'Project Management',
  nav_notifications_short: 'Projects',
  nav_admin: 'Programme admin',
  nav_admin_short: 'Admin',

  // Persona / role labels
  persona_L1: 'CFO',
  persona_L2: 'GM / Head',
  persona_L3: 'Manager',
  persona_L4: 'Executor',
  persona_Admin: 'Admin',

  // Workspace header
  header_subtitle: "Let's make the way you work visible.",
  header_processes_documented: 'Processes documented',
  header_yours: 'yours',
  header_avg_completeness: 'Avg. completeness',
  header_capture_process: 'Capture process',
  header_transfer_data: 'Transfer Data',
  header_view_as: 'View As',
  header_log_out: 'Log out',
  header_language: 'Language',

  // DashboardCFO
  dash_directorate_overview: 'Directorate overview',
  dash_subfunction_overview: 'Subfunction overview',
  dash_last_refreshed: 'Last refreshed',
  stat_processes_documented_hint: 'across 7 functions',
  stat_avg_completeness_hint: 'of required detail captured',
  stat_automation_candidates: 'Automation candidates',
  stat_automation_candidates_hint: 'suitability ≥ 70',
  stat_improvements_resolved: 'Improvements resolved',
  stat_improvements_resolved_hint: 'tracked initiatives',
  dash_coverage_title: 'Documentation coverage by line of work',
  dash_coverage_subtitle: 'Documented processes per subfunction',
  dash_splits_title: 'How the work splits',
  dash_splits_count: 'classified steps',
  dash_splits_empty: 'Run AI refinement on a process to see the agentic / automation / human split.',
  dash_latest_activity: 'Latest documentation activity',
  dash_champions: 'Directorate champions',
  dash_rice_summary: 'RICE Score summary',
  dash_rice_formula: '(Reach × Impact × Confidence) ÷ Effort — locked projects ranked by priority',
  dash_rice_empty: 'No projects scored with RICE inputs yet.',
  dash_transformation_title: 'Native-AI transformation',
  dash_manage: 'Manage',
  dash_transformation_footer: 'Stages 4–6 · Connected directly to active Locked Projects & execution tracker.',

  // Project Management
  pm_title: 'Project Management',
  pm_stages_badge: 'Stages 4–6',
  pm_subtitle: 'Operational workspace for locked projects carrying execution from investment gate to benefit realization.',
  pm_in_app_alerts: 'In-App Alerts',
  pm_lock_new_project: 'Lock New Project',
  pm_my_projects: 'My Projects',
  pm_all_projects: 'All Projects',
  pm_back_to_projects: 'All Projects',
  pm_gallery_empty: 'No projects involve you yet.',
  pm_gallery_empty_switch: 'Switch to "All Projects" above, or ',
  pm_gallery_empty_lock: 'lock a new project to get started.',
  pm_section_team: 'Project Team',
  pm_section_transcripts: 'Meeting Transcripts & Ingestion',
  pm_section_assistant: 'AI Meeting Assistant & Action Items',
  pm_section_timeline: 'Project Timeline (Gantt)',
  pm_section_okr: 'Project OKR',

  // Common atoms
  common_cancel: 'Cancel',
  common_save: 'Save',
  common_add: 'Add',
  common_close: 'Close',
  common_edit: 'Edit',
};

const ID: Dict = {
  // Sidebar / navigation
  nav_dashboard: 'Dasbor',
  nav_dashboard_short: 'Dasbor',
  nav_catalogue: 'Katalog',
  nav_catalogue_short: 'Katalog',
  nav_prd_hub: 'Hub PRD Gabungan',
  nav_prd_hub_short: 'Hub PRD',
  nav_capture: 'Catat proses',
  nav_capture_short: 'Catat',
  nav_refinement: 'Penyempurnaan AI',
  nav_refinement_short: 'AI',
  nav_notifications: 'Manajemen Proyek',
  nav_notifications_short: 'Proyek',
  nav_admin: 'Admin Program',
  nav_admin_short: 'Admin',

  // Persona / role labels
  persona_L1: 'CFO',
  persona_L2: 'GM / Kepala Unit',
  persona_L3: 'Manajer',
  persona_L4: 'Pelaksana',
  persona_Admin: 'Admin',

  // Workspace header
  header_subtitle: 'Yuk, buat cara kerjamu jadi lebih jelas.',
  header_processes_documented: 'Proses tercatat',
  header_yours: 'milikmu',
  header_avg_completeness: 'Rata-rata kelengkapan',
  header_capture_process: 'Catat proses',
  header_transfer_data: 'Transfer Data',
  header_view_as: 'Lihat Sebagai',
  header_log_out: 'Keluar',
  header_language: 'Bahasa',

  // DashboardCFO
  dash_directorate_overview: 'Ringkasan direktorat',
  dash_subfunction_overview: 'Ringkasan sub-fungsi',
  dash_last_refreshed: 'Terakhir diperbarui',
  stat_processes_documented_hint: 'dari 7 fungsi',
  stat_avg_completeness_hint: 'dari detail yang dibutuhkan',
  stat_automation_candidates: 'Kandidat otomatisasi',
  stat_automation_candidates_hint: 'skor kecocokan ≥ 70',
  stat_improvements_resolved: 'Perbaikan selesai',
  stat_improvements_resolved_hint: 'inisiatif yang dipantau',
  dash_coverage_title: 'Cakupan dokumentasi per lini kerja',
  dash_coverage_subtitle: 'Proses yang tercatat per sub-fungsi',
  dash_splits_title: 'Pembagian jenis pekerjaan',
  dash_splits_count: 'langkah yang sudah diklasifikasi',
  dash_splits_empty: 'Jalankan Penyempurnaan AI pada satu proses untuk melihat pembagian agentic AI, otomatisasi, dan manual.',
  dash_latest_activity: 'Aktivitas dokumentasi terbaru',
  dash_champions: 'Juara direktorat',
  dash_rice_summary: 'Ringkasan Skor RICE',
  dash_rice_formula: '(Reach × Impact × Confidence) ÷ Effort — proyek terkunci diurutkan berdasarkan prioritas',
  dash_rice_empty: 'Belum ada proyek yang dinilai pakai RICE.',
  dash_transformation_title: 'Transformasi Native-AI',
  dash_manage: 'Kelola',
  dash_transformation_footer: 'Tahap 4–6 · Terhubung langsung dengan Proyek Terkunci yang aktif & pelacak eksekusi.',

  // Project Management
  pm_title: 'Manajemen Proyek',
  pm_stages_badge: 'Tahap 4–6',
  pm_subtitle: 'Ruang kerja operasional untuk proyek terkunci, dari gerbang investasi sampai manfaatnya benar-benar terasa.',
  pm_in_app_alerts: 'Notifikasi Aplikasi',
  pm_lock_new_project: 'Kunci Proyek Baru',
  pm_my_projects: 'Proyek Saya',
  pm_all_projects: 'Semua Proyek',
  pm_back_to_projects: 'Semua Proyek',
  pm_gallery_empty: 'Belum ada proyek yang melibatkanmu.',
  pm_gallery_empty_switch: 'Coba pilih "Semua Proyek" di atas, atau ',
  pm_gallery_empty_lock: 'kunci proyek baru untuk mulai.',
  pm_section_team: 'Tim Proyek',
  pm_section_transcripts: 'Transkrip Rapat & Input Data',
  pm_section_assistant: 'Asisten Rapat AI & Tugas Tindak Lanjut',
  pm_section_timeline: 'Linimasa Proyek (Gantt)',
  pm_section_okr: 'OKR Proyek',

  // Common atoms
  common_cancel: 'Batal',
  common_save: 'Simpan',
  common_add: 'Tambah',
  common_close: 'Tutup',
  common_edit: 'Ubah',
};

const DICTS: Record<Language, Dict> = { en: EN, id: ID };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'id' ? 'id' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore — storage may be unavailable (private browsing, etc.)
    }
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);

  const t = (key: string): string => DICTS[language][key] ?? EN[key] ?? key;

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
