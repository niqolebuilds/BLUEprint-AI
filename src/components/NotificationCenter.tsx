import { useState } from 'react';
import { CheckCheck, Inbox, MailOpen, Megaphone, Reply } from 'lucide-react';
import { NotificationLog, Persona, UserNotification } from '../types';
import { timeAgo } from '../lib/utils';
import { Avatar, EmptyState, AutoTextarea } from './ui';

/** Inbox & broadcast history (US-11/12/22) — reminders, tags and admin chases land here. */
export default function NotificationCenter({
  notifications,
  logs,
  onMarkRead,
  onActionNotification,
  currentPersona,
}: {
  notifications: UserNotification[];
  logs: NotificationLog[];
  onMarkRead: (id: string) => void;
  onActionNotification: (id: string, response: string) => void;
  currentPersona: Persona;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const showBroadcasts = currentPersona === 'Admin' || currentPersona === 'L1';

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Inbox</h2>
        <p className="text-sm text-mute mt-0.5">Collaboration tags, completion chases and programme updates.</p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Inbox size={22} />} title="All clear" body="Nothing needs your attention right now." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {notifications.map((notif) => {
            const isOpen = openId === notif.id;
            return (
              <div key={notif.id} className={notif.status === 'Unread' ? 'bg-veil-soft/40' : ''}>
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-3.5 cursor-pointer"
                  onClick={() => {
                    setOpenId(isOpen ? null : notif.id);
                    setReply('');
                    if (notif.status === 'Unread') onMarkRead(notif.id);
                  }}
                >
                  <Avatar name={notif.senderName} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${notif.status === 'Unread' ? 'font-bold' : 'font-medium'}`}>{notif.subject}</div>
                    <div className="text-[11px] text-faint truncate">{notif.senderName} · {timeAgo(notif.timestamp)}</div>
                  </div>
                  {notif.actionRequired && notif.status !== 'Actioned' && (
                    <span className="chip bg-blush/70 border-transparent text-warn shrink-0">Action required</span>
                  )}
                  {notif.status === 'Actioned' && (
                    <span className="chip bg-citron-soft border-transparent text-citron-deep shrink-0">
                      <CheckCheck size={11} /> Actioned
                    </span>
                  )}
                  {notif.status === 'Unread' && <span className="w-2 h-2 rounded-full bg-veil-deep shrink-0" aria-label="Unread" />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pl-12 md:pl-[4.6rem] animate-fade-up flex flex-col h-auto min-h-0">
                    <p className="text-sm text-inksoft leading-relaxed max-w-2xl whitespace-pre-wrap break-words h-auto">{notif.message}</p>
                    {notif.responseText && (
                      <div className="mt-3 text-xs bg-canvas rounded-xl px-3.5 py-2.5 max-w-2xl whitespace-pre-wrap break-words h-auto flex flex-col gap-1">
                        <span className="font-semibold text-mute">Your response:</span>
                        <div className="text-ink">{notif.responseText}</div>
                      </div>
                    )}
                    {notif.actionRequired && notif.status !== 'Actioned' && (
                      <div className="mt-3.5 max-w-2xl">
                        <AutoTextarea
                          className="field !py-2.5 min-h-20 text-sm"
                          placeholder="Respond with the requested detail or a status update…"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            className="btn-dark !py-2 !px-4 text-xs"
                            disabled={!reply.trim()}
                            onClick={() => {
                              onActionNotification(notif.id, reply.trim());
                              setReply('');
                            }}
                          >
                            <Reply size={13} /> Send response
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showBroadcasts && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <Megaphone size={15} className="text-veil-deep" /> Broadcast history
          </h3>
          <p className="text-xs text-mute mt-0.5">Targeted sends from the programme team, with response counts.</p>
          <ul className="mt-4 space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="rounded-2xl border border-line px-4 py-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-semibold">{log.subject}</div>
                  <div className="flex items-center gap-2">
                    <span className="chip">
                      {log.targetType === 'all' ? 'Everyone' : `${log.targetType}: ${log.targetValue}`}
                    </span>
                    <span className="text-[11px] text-faint whitespace-nowrap">{timeAgo(log.timestamp)}</span>
                  </div>
                </div>
                <p className="text-xs text-mute mt-1.5 leading-relaxed max-w-2xl">{log.message}</p>
                <div className="text-[11px] text-faint mt-2 flex items-center gap-1.5">
                  <MailOpen size={11} /> {log.responsesCount ?? 0} response{(log.responsesCount ?? 0) === 1 ? '' : 's'} · sent by {log.senderName}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
