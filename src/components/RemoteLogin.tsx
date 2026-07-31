import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { remoteLogin, RemoteUser } from '../lib/blueprintApi';

export default function RemoteLogin({
  onSignedIn,
}: {
  onSignedIn: (token: string, user: RemoteUser) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const attempt = async () => {
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
            onKeyDown={(e) => e.key === 'Enter' && attempt()}
            aria-label="Username"
          />
          <input
            type="password"
            className="field text-center"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && attempt()}
            aria-label="Password"
          />
          {error && <div className="text-xs text-bad">{error}</div>}
        </motion.div>

        <button className="btn-dark w-full mt-5" onClick={attempt} disabled={!username || !password || checking}>
          {checking ? 'Signing in…' : 'Sign in'} <ArrowRight size={15} />
        </button>
      </motion.div>
    </div>
  );
}
