import { useState } from 'react';
import { UserPlus, KeyRound, Power, Copy } from 'lucide-react';
import {
  adminCreateRemoteUser,
  adminResetRemotePassword,
  adminSetRemoteActive,
} from '../lib/blueprintApi';
import { SUBFUNCTIONS_LIST } from '../data/mockData';
import { Persona } from '../types';

const LEVELS: Persona[] = ['L1', 'L2', 'L3', 'L4', 'Admin'];

function getToken(): string | null {
  return sessionStorage.getItem('bp_remote_token');
}

/**
 * Only shown when VITE_ENABLE_REMOTE_AUTH=true. This is the only way anyone
 * besides the bootstrap Admin gets an account — there's no self-service
 * onboarding in remote mode (App.tsx routes straight to RemoteLogin).
 */
export default function RemoteUserAdmin() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<Persona>('L4');
  const [subFunction, setSubFunction] = useState<string>(SUBFUNCTIONS_LIST[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);

  const [resetUsername, setResetUsername] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetTempPassword, setResetTempPassword] = useState('');

  const [activeUsername, setActiveUsername] = useState('');
  const [activeBusy, setActiveBusy] = useState(false);
  const [activeMessage, setActiveMessage] = useState('');

  const createUser = async () => {
    const token = getToken();
    if (!token || !name || !email || creating) return;
    setCreating(true);
    setCreateError('');
    setCreatedCreds(null);
    try {
      const creds = await adminCreateRemoteUser(token, {
        name: name.trim(),
        email: email.trim(),
        level,
        subFunction: level === 'L1' || level === 'L2' || level === 'Admin' ? 'All' : subFunction,
      });
      setCreatedCreds(creds);
      setName('');
      setEmail('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create user.');
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async () => {
    const token = getToken();
    if (!token || !resetUsername || resetBusy) return;
    setResetBusy(true);
    setResetError('');
    setResetTempPassword('');
    try {
      const { tempPassword } = await adminResetRemotePassword(token, resetUsername.trim());
      setResetTempPassword(tempPassword);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setResetBusy(false);
    }
  };

  const setActive = async (active: boolean) => {
    const token = getToken();
    if (!token || !activeUsername || activeBusy) return;
    setActiveBusy(true);
    setActiveMessage('');
    try {
      await adminSetRemoteActive(token, activeUsername.trim(), active);
      setActiveMessage(`${activeUsername.trim()} is now ${active ? 'active' : 'deactivated'}.`);
    } catch (err) {
      setActiveMessage(err instanceof Error ? err.message : 'Could not update user.');
    } finally {
      setActiveBusy(false);
    }
  };

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <UserPlus size={15} /> Create a new account
        </h3>
        <p className="text-xs text-mute mt-0.5">
          This is the only way anyone gets in — there's no self-signup. Send them the username and
          temporary password privately (Slack DM, in person), not in a group channel or email thread.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <input className="field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value as Persona)}>
            {LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
          {level !== 'L1' && level !== 'L2' && level !== 'Admin' ? (
            <select className="field" value={subFunction} onChange={(e) => setSubFunction(e.target.value)}>
              {SUBFUNCTIONS_LIST.map((sf) => (
                <option key={sf} value={sf}>{sf}</option>
              ))}
            </select>
          ) : (
            <div className="field flex items-center text-mute text-sm">All (directorate-wide)</div>
          )}
        </div>
        {createError && <div className="text-xs text-bad mt-2">{createError}</div>}
        <button className="btn-dark mt-3" onClick={createUser} disabled={!name || !email || creating}>
          {creating ? 'Creating…' : 'Create account'}
        </button>

        {createdCreds && (
          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-line bg-white/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-mute">Username</div>
              <div className="font-mono text-sm">{createdCreds.username}</div>
            </div>
            <div className="rounded-lg border border-line bg-white/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-mute">Temporary password (shown once)</div>
              <div className="font-mono text-sm">{createdCreds.tempPassword}</div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <KeyRound size={15} /> Reset a password
        </h3>
        <div className="flex gap-2 mt-3">
          <input
            className="field flex-1"
            placeholder="Username"
            value={resetUsername}
            onChange={(e) => setResetUsername(e.target.value)}
          />
          <button className="btn-ghost" onClick={resetPassword} disabled={!resetUsername || resetBusy}>
            {resetBusy ? 'Resetting…' : 'Reset'}
          </button>
        </div>
        {resetError && <div className="text-xs text-bad mt-2">{resetError}</div>}
        {resetTempPassword && (
          <div className="rounded-lg border border-line bg-white/60 px-3 py-2 mt-2 flex items-center gap-2">
            <Copy size={13} className="text-mute" />
            <span className="text-[10px] uppercase tracking-wide text-mute">New temp password:</span>
            <span className="font-mono text-sm">{resetTempPassword}</span>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Power size={15} /> Activate / deactivate
        </h3>
        <div className="flex gap-2 mt-3">
          <input
            className="field flex-1"
            placeholder="Username"
            value={activeUsername}
            onChange={(e) => setActiveUsername(e.target.value)}
          />
          <button className="btn-ghost" onClick={() => setActive(true)} disabled={!activeUsername || activeBusy}>
            Activate
          </button>
          <button className="btn-ghost" onClick={() => setActive(false)} disabled={!activeUsername || activeBusy}>
            Deactivate
          </button>
        </div>
        {activeMessage && <div className="text-xs text-mute mt-2">{activeMessage}</div>}
      </div>
    </div>
  );
}
