import { Process, ProcessStep, RiceScore } from '../types';

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Completeness score (US-22): each step contributes attributes; a process
 * needs title, description and at least one fully-attributed step to hit 100.
 */
export function computeCompleteness(p: {
  title: string;
  description: string;
  steps: ProcessStep[];
}): number {
  if (p.steps.length === 0) return p.title.trim() ? 10 : 0;

  let earned = 0;
  let possible = 0;

  possible += 2;
  if (p.title.trim()) earned += 1;
  if (p.description.trim()) earned += 1;

  for (const s of p.steps) {
    possible += 6;
    if (s.name.trim()) earned += 1;
    if (s.description.trim()) earned += 1;
    if (s.inputs.length > 0) earned += 1;
    if (s.outputs.length > 0) earned += 1;
    if (s.systems.length > 0) earned += 1;
    if (s.handOffs.length > 0 || s.decisionPoints.length > 0) earned += 1;
  }

  return Math.round((earned / possible) * 100);
}

export function stepGaps(s: ProcessStep): string[] {
  const gaps: string[] = [];
  if (!s.description.trim()) gaps.push('description');
  if (s.inputs.length === 0) gaps.push('inputs');
  if (s.outputs.length === 0) gaps.push('outputs');
  if (s.systems.length === 0) gaps.push('systems');
  return gaps;
}

export const CLASSIFICATION_META: Record<
  'agentic-ai' | 'automation' | 'human-in-the-loop',
  { label: string; short: string; bg: string; fg: string; dot: string }
> = {
  'agentic-ai': {
    label: 'Agentic AI',
    short: 'Agentic',
    bg: 'bg-veil',
    fg: 'text-veil-deep',
    dot: '#2f6cb2',
  },
  automation: {
    label: 'Automation',
    short: 'Auto',
    bg: 'bg-citron',
    fg: 'text-citron-deep',
    dot: '#55661d',
  },
  'human-in-the-loop': {
    label: 'Human-in-the-loop',
    short: 'Human',
    bg: 'bg-blush',
    fg: 'text-warn',
    dot: '#b3721c',
  },
};

/**
 * Chart series colors, validated (dataviz six checks) against the white card
 * surface: lightness band, chroma, CVD separation and 3:1 contrast all pass.
 */
export const CHART_COLORS = {
  'agentic-ai': '#2f6cb2',
  automation: '#4d661a',
  'human-in-the-loop': '#c9822e',
  primary: '#2f6cb2',
  neutral: '#94a3b8',
} as const;

export function classificationCounts(processes: Process[]) {
  const counts = { 'agentic-ai': 0, automation: 0, 'human-in-the-loop': 0, unclassified: 0 };
  for (const p of processes) {
    for (const s of p.steps) {
      const cls = p.userOverrides?.[s.id] ?? s.aiClassification;
      if (cls) counts[cls] += 1;
      else counts.unclassified += 1;
    }
  }
  return counts;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(language: 'en' | 'id' = 'en'): string {
  const h = new Date().getHours();
  if (language === 'id') {
    if (h < 5) return 'Masih kerja ya';
    if (h < 12) return 'Selamat pagi';
    if (h < 17) return 'Selamat siang';
    return 'Selamat malam';
  }
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * RICE Score = (Reach × Impact × Confidence) ÷ Effort.
 * Reach = n of people; Impact = rupiah or time saving; Confidence = 0-100 (%);
 * Effort = effort to deliver (time / money that has to be spent).
 */
export function computeRiceScore(rice: RiceScore): number {
  if (!rice.effort) return 0;
  return (rice.reach * rice.impact * (rice.confidence / 100)) / rice.effort;
}

export function formatRiceImpact(rice: RiceScore): string {
  if (rice.impactUnit === 'hours_per_month') return `${rice.impact.toLocaleString('id-ID')} hrs/mo`;
  return `Rp ${rice.impact.toLocaleString('id-ID')}`;
}

/**
 * Compact display for a RICE score. Raw scores can land anywhere from single
 * digits (time-saving impact) to the hundreds of millions (rupiah impact),
 * so abbreviate with K/M/B rather than showing every digit.
 */
export function formatRiceScoreValue(score: number): string {
  if (!isFinite(score)) return '0';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(score);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Full "Rp 1.234.567" style IDR formatting — shared by the ROI/TCO panel. */
export function formatIDR(val: number): string {
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

/** Compact "Rp 1,2 Juta" / "Rp 3,4 Miliar" formatting for tight card layouts. */
export function formatIDRCompact(val: number): string {
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2)} Miliar`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} Juta`;
  // Below 1 Juta still gets a "Ribu" tier so small figures (e.g. per-doc
  // inference cost) don't suddenly switch to a raw, un-abbreviated number
  // next to otherwise-compact Miliar/Juta figures in the same table.
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(1)} Ribu`;
  return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
}
