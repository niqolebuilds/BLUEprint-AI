import { motion } from 'motion/react';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  ChartNoAxesColumn,
  Fingerprint,
  LayoutDashboard,
  Lightbulb,
  MessagesSquare,
  ScanSearch,
  Sparkles,
  UsersRound,
} from 'lucide-react';

const HOW_IT_WORKS = [
  {
    icon: Fingerprint,
    title: 'Tell us about you',
    body: 'Your role, your name, and a password so only you can come back to your work.',
  },
  {
    icon: AudioLines,
    title: 'Capture your process',
    body: 'Upload working outputs, type, or just talk — describe how you actually work.',
  },
  {
    icon: ScanSearch,
    title: 'AI mines & refines',
    body: 'The understanding agent counts, expands and classifies every step for you.',
  },
  {
    icon: ChartNoAxesColumn,
    title: 'See what’s next',
    body: 'Dashboards, a living catalogue, and concrete improvement advice per workflow.',
  },
];

const CAPABILITIES = [
  { icon: BookOpen, title: 'Living process catalogue', body: 'Every documented workflow in one structured, searchable place.' },
  { icon: Sparkles, title: 'AI refinement & classification', body: 'Steps labelled agentic-AI, automation, or human-in-the-loop — with the reasoning shown.' },
  { icon: LayoutDashboard, title: 'Role-scoped dashboards', body: 'Directorate views for the CFO, subfunction maps for leads, completion tracking for managers.' },
  { icon: Lightbulb, title: 'Improvement advice', body: 'High-effort workflows flagged with recommended solutions and tracked outcomes.' },
  { icon: UsersRound, title: 'Collaboration built-in', body: 'Tag teammates on shared tasks so nothing is double-recorded.' },
  { icon: MessagesSquare, title: 'Targeted notifications', body: 'Reach people by level or line-of-work when detail is missing.' },
];

export default function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-full sky-wash overflow-y-auto">
      {/* Floating pill nav */}
      <nav className="sticky top-4 z-20 mx-auto max-w-3xl px-4">
        <div className="glass rounded-full px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-semibold text-sm">
            <span className="w-7 h-7 rounded-full bg-ink text-citron grid place-items-center">
              <Sparkles size={14} />
            </span>
            Blueprint
          </div>
          <div className="hidden sm:flex items-center gap-5 text-sm font-medium text-inksoft">
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#capabilities" className="hover:text-ink transition-colors">Capabilities</a>
          </div>
          <button onClick={onStart} className="btn-dark !py-2 !px-4 text-xs">
            Start
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <span className="chip bg-citron-soft border-transparent text-citron-deep mb-6 inline-flex">
            <Sparkles size={12} /> Native-AI transformation · Project Vanguard
          </span>
          <h1 className="font-display font-semibold tracking-tight text-5xl sm:text-6xl leading-[1.05] text-ink">
            Map how you really work.
            <br />
            <span className="text-veil-deep">Let AI find what&rsquo;s next.</span>
          </h1>
          <p className="mt-6 text-lg text-mute max-w-2xl mx-auto leading-relaxed">
            Blueprint turns the way you work — spoken, typed, or uploaded — into a structured process
            catalogue, then shows where agentic AI, automation, or a human touch fits best.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button onClick={onStart} className="btn-dark !px-7 !py-3.5 text-base">
              Start your journey <ArrowRight size={17} />
            </button>
            <a href="#how" className="btn-ghost !px-7 !py-3.5 text-base">
              Learn more
            </a>
          </div>
        </motion.div>

        {/* Hero visual: soft glass "process" preview */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 glass rounded-card p-6 sm:p-8 max-w-3xl mx-auto text-left"
        >
          <div className="text-xs font-semibold text-mute mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-citron animate-pulse" />
            Understanding agent · mining your narrative
          </div>
          <div className="space-y-3">
            {[
              { name: 'Retrieve patient billing records', tag: 'Automation', tagClass: 'bg-citron text-ink' },
              { name: 'Verify tariffs against INA-CBG rules', tag: 'Agentic AI', tagClass: 'bg-veil text-ink' },
              { name: 'Manager sign-off on exceptions', tag: 'Human-in-the-loop', tagClass: 'bg-blush text-ink' },
            ].map((step, i) => (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.18 }}
                className="bg-card rounded-2xl border border-line px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-canvas grid place-items-center text-[11px] font-bold text-mute shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium truncate">{step.name}</span>
                </div>
                <span className={`chip border-transparent ${step.tagClass}`}>{step.tag}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </header>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-center">Four steps, no training needed</h2>
        <p className="text-mute text-center mt-2 text-sm">From &ldquo;this is how I work&rdquo; to a transformation-ready catalogue.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW_IT_WORKS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.08 }}
              className="card p-6"
            >
              <div className="w-10 h-10 rounded-full bg-veil-soft text-veil-deep grid place-items-center mb-4">
                <item.icon size={18} />
              </div>
              <div className="text-[11px] font-bold text-faint mb-1.5">STEP {i + 1}</div>
              <div className="font-display font-semibold">{item.title}</div>
              <p className="text-sm text-mute mt-1.5 leading-relaxed">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="max-w-5xl mx-auto px-6 py-16">
        <div className="card bg-ink border-transparent p-8 sm:p-12 text-white">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Everything the directorate needs, <span className="text-citron">in one place</span>
          </h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title}>
                <div className="flex items-center gap-2.5 font-semibold text-sm">
                  <cap.icon size={16} className="text-citron shrink-0" />
                  {cap.title}
                </div>
                <p className="text-[13px] text-white/60 mt-1.5 leading-relaxed">{cap.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="max-w-5xl mx-auto px-6 pb-20 pt-4 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Ready when you are.</h2>
        <p className="text-mute mt-2 text-sm">It takes about ten minutes to document your first process.</p>
        <button onClick={onStart} className="btn-citron !px-7 !py-3.5 text-base mt-6">
          Start now <ArrowRight size={17} />
        </button>
        <div className="mt-14 text-xs text-faint">Blueprint · Finance Process Catalogue · Project Vanguard</div>
      </footer>
    </div>
  );
}
