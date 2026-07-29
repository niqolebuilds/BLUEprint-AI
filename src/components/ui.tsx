import { ReactNode, useEffect, useRef, TextareaHTMLAttributes } from 'react';
import { CLASSIFICATION_META, initials } from '../lib/utils';

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold text-mute mb-1">{children}</div>;
}

export function ClassChip({
  classification,
  overridden,
}: {
  classification: 'agentic-ai' | 'automation' | 'human-in-the-loop';
  overridden?: boolean;
}) {
  const meta = CLASSIFICATION_META[classification];
  return (
    <span className={`chip border-transparent ${meta.bg} ${meta.fg}`} title={overridden ? 'Manually overridden' : undefined}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
      {overridden && <span className="opacity-70">· edited</span>}
    </span>
  );
}

export function StatusChip({ status }: { status: 'Draft' | 'Submitted' | 'Refined' | 'Approved' }) {
  const styles: Record<string, string> = {
    Draft: 'bg-canvas text-mute',
    Submitted: 'bg-veil-soft text-veil-deep',
    Refined: 'bg-citron-soft text-citron-deep',
    Approved: 'bg-citron text-ink',
  };
  return <span className={`chip border-transparent ${styles[status]}`}>{status}</span>;
}

export function Meter({ value, tone = 'citron' }: { value: number; tone?: 'citron' | 'veil' | 'ink' }) {
  const bg = tone === 'citron' ? 'var(--color-citron)' : tone === 'veil' ? 'var(--color-veil)' : 'var(--color-ink)';
  return (
    <div className="h-1.5 w-full rounded-full bg-canvas overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: bg }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: 'citron' | 'veil';
}) {
  return (
    <div className={`card p-5 ${accent === 'citron' ? 'bg-citron-soft border-transparent' : ''} ${accent === 'veil' ? 'bg-veil-soft border-transparent' : ''}`}>
      <div className="text-xs font-semibold text-mute">{label}</div>
      <div className="font-display text-3xl font-semibold mt-1.5 tracking-tight">{value}</div>
      {hint && <div className="text-xs text-mute mt-1">{hint}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-ink text-white grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name || '?')}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-12 flex flex-col items-center text-center gap-3">
      <div className="w-14 h-14 rounded-full bg-veil-soft grid place-items-center text-veil-deep">{icon}</div>
      <div className="font-display text-lg font-semibold">{title}</div>
      <p className="text-sm text-mute max-w-sm">{body}</p>
      {action}
    </div>
  );
}

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 26 : 8,
            height: 8,
            background: i < current ? 'var(--color-citron)' : i === current ? 'var(--color-ink)' : 'var(--color-line)',
          }}
        />
      ))}
    </div>
  );
}

export function TagList({ items, onRemove }: { items: string[]; onRemove?: (item: string) => void }) {
  if (items.length === 0) return <span className="text-xs text-faint">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="chip">
          {item}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="text-faint hover:text-bad cursor-pointer leading-none"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function AutoTextarea({
  value,
  ...props
}: { value: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      // Use scrollHeight or default minimum height
      const offsetHeight = el.scrollHeight;
      el.style.height = `${offsetHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      {...props}
    />
  );
}

