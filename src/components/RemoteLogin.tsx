import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Copy } from 'lucide-react';
import { bootstrapAdmin, remoteLogin, RemoteUser } from '../lib/blueprintApi';

type Mode = 'login' | 'bootstrap' | 'bootstrap-result';

export default function RemoteLogin({
  onSignedIn,
}: {
  onSignedIn: (token: string, user: RemoteUser) => void;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const attemptLogin = async () => {
    if (!username || !password || checking) return;
    setChecking(true);
    setError('');
    try {
      const { token, user } = await remoteLogin(username.trim(), password);
      onSignedIn(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setChecking(false);
    }
  };

  const attemptBootstrap = async () => {
    if (!name || !email || checking) return;
    setChecking(true);
    setError('');
    try {
      const creds = await bootstrapAdmin(name.trim(), email.trim());
      setCreatedCreds(creds);
      setMode('bootstrap-result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the Admin account.');
    } finally {
      setChecking(false);
    }
  };

  if (mode === 'bootstrap-result' && createdCreds) {
    return (
      <div className="min-h-full sky-wash flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-card p-10 w-full max-w-sm text-center"
        >
          <div className="flex justify-center">
            <span className="w-14 h-14 rounded-full bg-citron grid place-items-center">
              <ShieldCheck size={22} className="text-ink" />
            </span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight mt-4">Admin account created</h1>
          <p className="text-xs text-mute mt-1.5">Copy these now — the temporary password won't be shown again.</p>

          <div className="mt-6 space-y-2 text-left">
            <div className="rounded-lg border border-line bg-white/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-mute">Username</div>
              <div className="font-mono text-sm">{createdCreds.username}</div>
            </div>
            <div className="rounded-lg border border-line bg-white/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-mute">Temporary password</div>
              <div className="font-mono text-sm">{createdCreds.tempPassword}</div>
            </div>
          </div>

          <button
            className="btn-dark w-full mt-6"
            onClick={() => {
              setUsername(createdCreds.username);
              setPassword('');
              setMode('login');
            }}
          >
            <Copy size={15} /> Continue to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  if (mode === 'bootstrap') {
    return (
      <div className="min-h-full sky-wash flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-card p-10 w-full max-w-sm text-center"
        >
          <div className="flex justify-center">
            <span className="w-14 h-14 rounded-full bg-citron grid place-items-center">
              <ShieldCheck size={22} className="text-ink" />
            </span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight mt-4">Set up the Admin account</h1>
          <p className="text-xs text-mute mt-1.5">
            This only works once, before any account exists. Everyone else should be created from the Admin dashboard afterwards.
          </p>

          <motion.div
            animate={error ? { x: [0, -8, 8, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="mt-7 space-y-3"
          >
            <input
              autoFocus
              className="field text-center"
              placeholder="Your full name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              aria-label="Full name"
            />
            <input
              className="field text-center"
              placeholder="Your work email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && attemptBootstrap()}
              aria-label="Work email"
            />
            {error && <div className="text-xs text-bad">{error}</div>}
          </motion.div>

          <button className="btn-dark w-full mt-5" onClick={attemptBootstrap} disabled={!name || !email || checking}>
            {checking ? 'Creating…' : 'Create Admin account'} <ArrowRight size={15} />
          </button>
          <button className="text-xs text-mute mt-4 underline" onClick={() => { setMode('login'); setError(''); }}>
            Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full sky-wash flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-card p-10 w-full max-w-sm text-center"
      >
        <div className="flex justify-center">
          <span className="w-14 h-14 rounded-full bg-citron grid place-items-center">
            <ShieldCheck size={22} className="text-ink" />
          </span>
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight mt-4">Blueprint</h1>
        <p className="text-xs text-mute mt-1.5">
          Sign in with the username and password your Programme Admin gave you.
        </p>

        <motion.div
          animate={error ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="mt-7 space-y-3"
        >
          <input
            autoFocus
            className="field text-center"
            placeholder="Username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && attemptLogin()}
            aria-label="Username"
          />
          <input
            type="password"
            className="field text-center"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && attemptLogin()}
            aria-label="Password"
          />
          {error && <div className="text-xs text-bad">{error}</div>}
        </motion.div>

        <button className="btn-dark w-full mt-5" onClick={attemptLogin} disabled={!username || !password || checking}>
          {checking ? 'Signing in…' : 'Sign in'} <ArrowRight size={15} />
        </button>
        <button className="text-xs text-mute mt-4 underline" onClick={() => { setMode('bootstrap'); setError(''); }}>
          First time setting this up? Create the Admin account
        </button>
      </motion.div>
    </div>
  );
}
