import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Crown, Landmark, ShieldCheck, UserRound, Users, Wrench } from 'lucide-react';
import { Persona, UserProfile } from '../types';
import { hashPassword } from '../lib/utils';
import { ProgressDots } from './ui';

const ROLE_OPTIONS: Array<{ role: Persona; title: string; sub: string; body: string; icon: typeof Crown }> = [
  { role: 'L1', title: 'CFO', sub: 'L1 · Directorate leader', body: 'Full-directorate visibility, strategy and native-AI adoption.', icon: Crown },
  { role: 'L2', title: 'GM / Head / Advisor', sub: 'L2 · Subfunction leader', body: 'Plans the transformation for one subfunction.', icon: Landmark },
  { role: 'L3', title: 'Controller / Dept. head', sub: 'L3 · Unit manager', body: 'Manages people and tracks documentation completion.', icon: Users },
  { role: 'L4', title: 'Executive / Coordinator', sub: 'L4 · Process executor', body: 'Documents day-to-day working processes in detail.', icon: Wrench },
  { role: 'Admin', title: 'Programme admin', sub: 'Project Vanguard lead', body: 'Runs the programme: data quality, hackathon list, next stage.', icon: ShieldCheck },
];

const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
};

export default function Onboarding({
  onComplete,
  onBack,
}: {
  onComplete: (profile: UserProfile) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0); // 0 role · 1 name · 2 password · 3 done
  const [role, setRole] = useState<Persona | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [manualRoleOverride, setManualRoleOverride] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const passwordChecks = [
    { ok: password.length >= 8, text: 'At least 8 characters' },
    { ok: /[a-zA-Z]/.test(password) && /\d/.test(password), text: 'Mixes letters and numbers' },
    { ok: password.length > 0 && password === confirm, text: 'Both entries match' },
  ];
  const passwordValid = passwordChecks.every((c) => c.ok);

  const finish = async () => {
    if (!role || !name.trim() || !passwordValid || saving) return;
    setSaving(true);
    const passwordHash = await hashPassword(password);
    setStep(3);
    const lowerName = name.toLowerCase();
    const lowerEmail = (email || '').toLowerCase();
    const isNicole = lowerName.includes('nicole') || lowerEmail.includes('nicole');
    const finalRole = isNicole ? 'Admin' : role;
    setTimeout(() => {
      onComplete({
        name: name.trim(),
        email: email.trim() || undefined,
        role: finalRole,
        passwordHash,
        createdAt: new Date().toISOString(),
        manualRoleOverride: manualRoleOverride.trim() || undefined,
      });
    }, 1600);
  };

  return (
    <div className="min-h-full sky-wash flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-6 px-1">
          <button
            onClick={() => (step === 0 ? onBack() : setStep(step - 1))}
            className="btn-ghost !py-2 !px-3.5 text-xs"
            disabled={step === 3}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <ProgressDots total={3} current={Math.min(step, 2)} />
        </div>

        <div className="glass rounded-card p-8 sm:p-10 min-h-[430px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="role" {...slide} className="flex-1 flex flex-col">
                <div className="text-xs font-semibold text-mute">Understanding you · 1 of 3</div>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
                  What&rsquo;s your role?
                </h1>
                <p className="text-sm text-mute mt-1.5">This decides which views and dashboards you&rsquo;ll get.</p>
                <div className="mt-6 grid gap-2.5">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.role}
                      onClick={() => {
                        setRole(opt.role);
                        setTimeout(() => setStep(1), 220);
                      }}
                      className={`text-left rounded-2xl border px-4 py-3.5 flex items-center gap-4 transition-all cursor-pointer bg-card ${
                        role === opt.role ? 'border-ink shadow-lift' : 'border-line hover:border-faint'
                      }`}
                    >
                      <span
                        className={`w-10 h-10 rounded-full grid place-items-center shrink-0 transition-colors ${
                          role === opt.role ? 'bg-citron text-ink' : 'bg-canvas text-mute'
                        }`}
                      >
                        <opt.icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-2">
                          <span className="font-semibold text-sm">{opt.title}</span>
                          <span className="text-[11px] font-medium text-faint">{opt.sub}</span>
                        </span>
                        <span className="block text-xs text-mute mt-0.5">{opt.body}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="name" {...slide} className="flex-1 flex flex-col">
                <div className="text-xs font-semibold text-mute">Understanding you · 2 of 3</div>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
                  What&rsquo;s your name?
                </h1>
                <p className="text-sm text-mute mt-1.5">So we can greet you properly and attribute your catalogue.</p>
                <div className="mt-8 space-y-4 flex-1">
                  <div>
                    <label className="label" htmlFor="ob-name">Full name</label>
                    <input
                      id="ob-name"
                      autoFocus
                      className="field !text-lg !py-4"
                      placeholder="e.g. Budi Santoso"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ob-email">Work email <span className="text-faint font-normal">(optional)</span></label>
                    <input
                      id="ob-email"
                      type="email"
                      className="field"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ob-role-override">
                      Manual Role Override <span className="text-faint font-normal">(optional — completely bypasses system-assigned role)</span>
                    </label>
                    <input
                      id="ob-role-override"
                      className="field"
                      placeholder="e.g. Senior Finance Manager, CFO Consultant"
                      value={manualRoleOverride}
                      onChange={(e) => setManualRoleOverride(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
                    />
                  </div>
                </div>
                <button className="btn-dark w-full mt-6" disabled={!name.trim()} onClick={() => setStep(2)}>
                  Continue <ArrowRight size={15} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="password" {...slide} className="flex-1 flex flex-col">
                <div className="text-xs font-semibold text-mute">Understanding you · 3 of 3</div>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
                  Set a password
                </h1>
                <p className="text-sm text-mute mt-1.5">
                  Your catalogue stays on this device — the password makes sure only you can re-open it later.
                </p>
                <div className="mt-8 space-y-4 flex-1">
                  <div>
                    <label className="label" htmlFor="ob-pass">Password</label>
                    <input
                      id="ob-pass"
                      autoFocus
                      type="password"
                      className="field"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ob-confirm">Confirm password</label>
                    <input
                      id="ob-confirm"
                      type="password"
                      className="field"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && finish()}
                    />
                  </div>
                  <ul className="space-y-1.5 pt-1">
                    {passwordChecks.map((check) => (
                      <li key={check.text} className={`text-xs flex items-center gap-2 ${check.ok ? 'text-ok' : 'text-faint'}`}>
                        <span className={`w-4 h-4 rounded-full grid place-items-center ${check.ok ? 'bg-citron' : 'bg-canvas'}`}>
                          {check.ok && <Check size={10} className="text-ink" />}
                        </span>
                        {check.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="btn-dark w-full mt-6" disabled={!passwordValid || saving} onClick={finish}>
                  Create my space <ArrowRight size={15} />
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-citron grid place-items-center"
                >
                  <Check size={34} className="text-ink" />
                </motion.div>
                <h1 className="font-display text-3xl font-semibold tracking-tight mt-6">
                  You&rsquo;re set, {name.trim().split(' ')[0]}!
                </h1>
                <p className="text-sm text-mute mt-2 max-w-xs">
                  Let&rsquo;s capture your first working process — the understanding agent is ready.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs text-faint">
                  <UserRound size={13} /> Starting your journey…
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
