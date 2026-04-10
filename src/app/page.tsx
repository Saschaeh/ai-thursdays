'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

type Member = { id: number; name: string; email?: string; avatar?: string; created_at?: string };
type Comment = { id: number; idea_id: number; parent_id: number | null; member_id: number; member_name: string; content: string; created_at: string };
type Notification = { id: number; member_id: number; type: string; message: string; idea_id: number | null; read: boolean; created_at: string };
type Vote = { id: number; idea_id: number; member_id: number; member_name: string };
type Idea = {
  id: number; title: string; description: string; category: string;
  status: string; submitted_by: number; submitted_by_name: string;
  assigned_to: number[]; assigned_to_name: string | null; assigned_to_names: string[];
  links?: string[]; target_date: string | null; vote_count: number; comment_count: number;
  created_at: string; updated_at: string;
  comments?: Comment[]; votes?: Vote[];
};

const CATEGORIES = ['AI Tool', 'Framework', 'Model', 'Technique', 'Platform', 'General'];
const STATUSES = ['new', 'discussed', 'assigned', 'in-progress', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  'new': 'New', 'discussed': 'Discussed', 'assigned': 'Assigned',
  'in-progress': 'In Progress', 'completed': 'Completed'
};
const STATUS_COLORS: Record<string, string> = {
  'new': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'discussed': 'bg-amber-50 text-amber-700 border border-amber-200',
  'assigned': 'bg-sky-50 text-sky-700 border border-sky-200',
  'in-progress': 'bg-orange-50 text-orange-700 border border-orange-200',
  'completed': 'bg-green-50 text-green-700 border border-green-200',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '/Thursdays';

function Avatar({ member, size = 'md', animate = false }: { member: { name: string; avatar?: string }; size?: 'sm' | 'md' | 'lg' | 'ml'; animate?: boolean }) {
  const sizeClasses = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', ml: 'w-13 h-13 text-xl', lg: 'w-16 h-16 text-2xl' };
  const animClass = animate ? 'hover:animate-bounce transition-transform hover:scale-110' : 'transition-transform hover:scale-110';
  if (member.avatar) {
    return <img src={`${BASE}/avatars/${member.avatar}`} alt={member.name} className={`${sizeClasses[size]} rounded-full ${animClass}`} />;
  }
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-semibold shrink-0 ${animClass}`}>
      {member.name.charAt(0).toUpperCase()}
    </div>
  );
}

function findMemberAvatar(members: Member[], name: string): string | undefined {
  return members.find(m => m.name === name)?.avatar;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api.php?route=${encodeURIComponent(path)}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [tab, setTab] = useState<'ideas' | 'diary' | 'profile'>('ideas');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [showNewMember, setShowNewMember] = useState(false);
  const [hp, setHp] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadIdeas = useCallback(async () => {
    const data = await api<Idea[]>('/ideas');
    setIdeas(data);
  }, []);

  const loadMembers = useCallback(async () => {
    const data = await api<Member[]>('/members');
    setMembers(data);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    const res = await fetch(`${BASE}/api.php?route=${encodeURIComponent('/notifications')}&member_id=${currentUser.id}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data: Notification[] = await res.json();
    setNotifications(data);
  }, [currentUser]);

  useEffect(() => {
    loadMembers();
    loadIdeas();
    // Restore user from localStorage
    try {
      const saved = localStorage.getItem('ai-thursdays-user');
      if (saved) {
        const user = JSON.parse(saved) as Member;
        // Fetch fresh data from API
        api<Member>(`/members/${user.id}`).then(fresh => {
          const m = { ...user, ...fresh };
          setCurrentUser(m);
          localStorage.setItem('ai-thursdays-user', JSON.stringify(m));
          if (!m.avatar) setTab('profile');
        }).catch(() => {
          setCurrentUser(user);
          if (!user.avatar) setTab('profile');
        });
      }
    } catch {}
  }, [loadIdeas, loadMembers]);

  useEffect(() => {
    if (!currentUser) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser, loadNotifications]);

  const selectUser = (member: Member) => {
    // Fetch latest member data from API to get current avatar
    api<Member>(`/members/${member.id}`).then(fresh => {
      const m = { ...member, ...fresh };
      setCurrentUser(m);
      localStorage.setItem('ai-thursdays-user', JSON.stringify(m));
      if (!m.avatar) setTab('profile');
    }).catch(() => {
      setCurrentUser(member);
      localStorage.setItem('ai-thursdays-user', JSON.stringify(member));
      if (!member.avatar) setTab('profile');
    });
  };

  const handleNewMember = async () => {
    if (!nameInput.trim() || hp) return;
    const member = await api<Member>('/members', {
      method: 'POST',
      body: JSON.stringify({ name: nameInput.trim(), email: emailInput.trim(), website: hp }),
    });
    selectUser(member);
    setNameInput('');
    setEmailInput('');
    setShowNewMember(false);
    loadMembers();
  };

  const markAllRead = async () => {
    if (!currentUser) return;
    await fetch(`${BASE}/api.php?route=${encodeURIComponent('/notifications/read-all')}&member_id=${currentUser.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    loadNotifications();
  };

  const needsAvatar = !currentUser?.avatar;
  const unreadCount = notifications.filter(n => !n.read).length + (needsAvatar ? 1 : 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ai-thursdays-user');
  };

  const handleDelete = async (ideaId: number) => {
    await api(`/ideas/${ideaId}`, { method: 'DELETE' });
    setSelectedIdea(null);
    loadIdeas();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 bg-cover bg-center bg-fixed" style={{ backgroundImage: "linear-gradient(rgba(3,7,18,0.85), rgba(3,7,18,0.85)), url('/Thursdays/bg-moon.jpg')", backgroundPosition: "center 20%" }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src={`${BASE}/icon.svg?v=4`} alt="AT" className="w-12 h-12 rounded-xl mb-4 inline-block" />
            <h1 className="text-2xl font-semibold text-white tracking-tight">AI Thursdays</h1>
            <p className="text-gray-400 mt-1 text-sm">Select your name to continue</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            {members.length > 0 && (
              <div className="space-y-2 mb-4">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => selectUser(m)}
                    className="group/btn w-full flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white hover:border-emerald-500/50 hover:bg-gray-800/80 transition text-left"
                  >
                    <span className="group-hover/btn:animate-bounce inline-block">
                      <Avatar member={m} />
                    </span>
                    <span className="font-medium">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
            {!showNewMember ? (
              <button
                onClick={() => setShowNewMember(true)}
                className="w-full px-4 py-3 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-emerald-400 hover:border-emerald-500/50 transition text-sm"
              >
                + New member
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewMember()}
                  placeholder="Your name"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                />
                <input
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewMember()}
                  placeholder="Email (optional — for notifications)"
                  type="email"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                />
                <input
                  value={hp}
                  onChange={e => setHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
                  style={{ position: 'absolute', left: '-9999px' }}
                />
                <button
                  onClick={handleNewMember}
                  className="w-full px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-400 transition"
                >
                  Join
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 bg-cover bg-center bg-fixed overflow-x-hidden" style={{ backgroundImage: "linear-gradient(rgba(3,7,18,0.82), rgba(3,7,18,0.82)), url('/Thursdays/bg-moon.jpg')", backgroundPosition: "center 20%" }}>
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={`${BASE}/icon.svg?v=4`} alt="AT" className="w-8 h-8 rounded-lg shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight truncate">AI Thursdays</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button onClick={() => setTab('profile')} className="flex items-center gap-2 hover:opacity-80 transition" title="View profile">
              <Avatar member={currentUser} size="sm" />
              <span className="text-sm text-gray-400 hidden sm:inline">Hi, <strong className="text-gray-200">{currentUser.name}</strong></span>
            </button>
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-400 hover:text-white transition"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {needsAvatar && (
                      <div
                        className="px-4 py-3 border-b border-gray-800/50 cursor-pointer hover:bg-amber-500/10 transition bg-amber-500/5"
                        onClick={() => { setTab('profile'); setShowNotifications(false); }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 mt-1.5 rounded-full bg-amber-500 shrink-0" />
                          <div>
                            <p className="text-sm text-amber-300 font-medium">Select your avatar!</p>
                            <p className="text-xs text-gray-600 mt-0.5">Pick a pixel art avatar for your profile</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {notifications.length === 0 && !needsAvatar ? (
                      <p className="text-sm text-gray-600 text-center py-6">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/50 transition ${!n.read ? 'bg-gray-800/30' : ''}`}
                          onClick={async () => {
                            if (!n.read) {
                              await api(`/notifications/${n.id}`, { method: 'PATCH' });
                              loadNotifications();
                            }
                            if (n.idea_id) {
                              api<Idea>(`/ideas/${n.idea_id}`).then(setSelectedIdea);
                              setShowNotifications(false);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" />}
                            <div className={!n.read ? '' : 'ml-4'}>
                              <p className="text-sm text-gray-300">{n.message}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{formatTimeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition">
              Switch user
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('ideas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'ideas' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            Ideas
          </button>
          <button
            onClick={() => setTab('diary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'diary' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            Diary / Schedule
          </button>
          <button
            onClick={() => setTab('profile')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'profile' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            Profile
          </button>
        </div>
      </div>

      {!currentUser.avatar && tab !== 'profile' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-4">
          <button
            onClick={() => setTab('profile')}
            className="w-full flex items-center gap-3 px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition"
          >
            <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-lg shrink-0">!</span>
            <span className="text-sm text-amber-300 font-medium">You haven&apos;t picked an avatar yet, you filthy animal.</span>
            <span className="ml-auto text-xs text-amber-500/70">Pick one &rarr;</span>
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'ideas' && (
          <>
            <div className="flex justify-between items-center mb-5">
              <p className="text-gray-500 text-sm">{ideas.length} idea{ideas.length !== 1 ? 's' : ''} submitted</p>
              <button
                onClick={() => setShowNewIdea(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 text-sm font-medium transition"
              >
                + New Idea
              </button>
            </div>

            {showNewIdea && (
              <NewIdeaForm
                currentUser={currentUser}
                onSubmit={() => { setShowNewIdea(false); loadIdeas(); }}
                onCancel={() => setShowNewIdea(false)}
              />
            )}

            <div className="grid gap-3">
              {[...ideas].sort((a, b) => b.vote_count - a.vote_count).map(idea => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  members={members}
                  onSelect={() => {
                    api<Idea>(`/ideas/${idea.id}`).then(setSelectedIdea);
                  }}
                  onVote={async () => {
                    await api(`/ideas/${idea.id}/votes`, {
                      method: 'POST',
                      body: JSON.stringify({ member_id: currentUser.id }),
                    });
                    loadIdeas();
                  }}
                />
              ))}
              {ideas.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-gray-600 text-sm">No ideas yet. Be the first to add one!</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'diary' && (
          <CalendarView ideas={ideas} onSelectIdea={(id) => {
            api<Idea>(`/ideas/${id}`).then(setSelectedIdea);
          }} />
        )}

        {tab === 'profile' && (
          <ProfilePage
            currentUser={currentUser}
            members={members}
            ideas={ideas}
            onUpdate={(updated) => {
              setCurrentUser(updated);
              localStorage.setItem('ai-thursdays-user', JSON.stringify(updated));
              loadMembers();
            }}
          />
        )}
      </div>

      {selectedIdea && (
        <IdeaDetail
          idea={selectedIdea}
          currentUser={currentUser}
          members={members}
          onClose={() => setSelectedIdea(null)}
          onUpdate={() => {
            api<Idea>(`/ideas/${selectedIdea.id}`).then(setSelectedIdea);
            loadIdeas();
          }}
          onDelete={() => handleDelete(selectedIdea.id)}
        />
      )}
    </div>
  );
}

function NewIdeaForm({ currentUser, onSubmit, onCancel }: {
  currentUser: Member; onSubmit: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [hp, setHp] = useState('');
  const [showLinks, setShowLinks] = useState(false);
  const [links, setLinks] = useState<string[]>([]);

  const addLink = () => { if (links.length < 3) setLinks([...links, '']); };
  const updateLink = (i: number, val: string) => { const l = [...links]; l[i] = val; setLinks(l); };
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!title.trim() || hp) return;
    await api('/ideas', {
      method: 'POST',
      body: JSON.stringify({ title, description, category, submitted_by: currentUser.id, links: links.filter(l => l.trim()), website: hp }),
    });
    onSubmit();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
      <h3 className="font-semibold text-white mb-4">New Idea</h3>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title — what's the tool or topic?"
        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Notes — why is this interesting? Links, context..."
        rows={3}
        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition resize-none"
      />
      {!showLinks ? (
        <button
          onClick={() => { setShowLinks(true); if (links.length === 0) addLink(); }}
          className="text-sm text-gray-500 hover:text-emerald-400 transition mb-3"
        >
          + Add resources or documents
        </button>
      ) : (
        <div className="mb-3 space-y-2">
          <p className="text-xs text-gray-500">Resource links (up to 3)</p>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={link}
                onChange={e => updateLink(i, e.target.value)}
                placeholder="https://..."
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
              />
              <button onClick={() => removeLink(i)} className="text-gray-600 hover:text-red-400 transition px-2">&times;</button>
            </div>
          ))}
          {links.length < 3 && (
            <button onClick={addLink} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
              + Add another link
            </button>
          )}
        </div>
      )}
      <input
        value={hp}
        onChange={e => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
        style={{ position: 'absolute', left: '-9999px' }}
      />
      <div className="flex gap-3 items-center">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm transition">Cancel</button>
        <button
          onClick={handleSubmit}
          className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 text-sm font-medium transition"
        >
          Submit Idea
        </button>
      </div>
    </div>
  );
}

function IdeaCard({ idea, members, onSelect, onVote }: {
  idea: Idea; members: Member[]; onSelect: () => void; onVote: () => void;
}) {
  const submitter = members.find(m => m.name === idea.submitted_by_name);
  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 hover:border-gray-700 transition cursor-pointer group overflow-hidden"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-white group-hover:text-emerald-400 transition break-words min-w-0">{idea.title}</h3>
          </div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[idea.status]}`}>
              {STATUS_LABELS[idea.status]}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{idea.category}</span>
          </div>
          {idea.description && (
            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed break-words">{idea.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Avatar member={submitter || { name: idea.submitted_by_name || '?' }} size="sm" />
              <span className="text-gray-400">{idea.submitted_by_name}</span>
            </span>
            {idea.assigned_to_name && <span className="truncate max-w-[140px]">→ <strong className="text-gray-400">{idea.assigned_to_name}</strong></span>}
            {idea.comment_count > 0 && <span>{idea.comment_count} comment{idea.comment_count !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onVote(); }}
          className="flex flex-col items-center px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 hover:border-emerald-500/50 hover:bg-gray-750 transition text-sm min-w-[52px] shrink-0"
          title="Click to toggle your vote"
        >
          <svg className="w-4 h-4 text-emerald-500 mb-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3l-7 7h4v7h6v-7h4L10 3z"/></svg>
          <span className="font-semibold text-emerald-400">{idea.vote_count}</span>
        </button>
      </div>
    </div>
  );
}

function CommentReplyBox({ ideaId, parentId, currentUser, onSubmit }: {
  ideaId: number; parentId: number | null; currentUser: Member; onSubmit: () => void;
}) {
  const [text, setText] = useState('');
  const [hp, setHp] = useState('');

  const handleSubmit = async () => {
    if (!text.trim() || hp) return;
    await api(`/ideas/${ideaId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: text, member_id: currentUser.id, parent_id: parentId, website: hp }),
    });
    setText('');
    onSubmit();
  };

  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
        placeholder={parentId ? 'Write a reply...' : 'Add a comment...'}
        autoFocus={!!parentId}
        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
      />
      <input
        value={hp}
        onChange={e => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
        style={{ position: 'absolute', left: '-9999px' }}
      />
      <button
        onClick={handleSubmit}
        className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-400 transition"
      >
        {parentId ? 'Reply' : 'Post'}
      </button>
    </div>
  );
}

function CommentThread({ comment, allComments, ideaId, currentUser, members, depth, onUpdate }: {
  comment: Comment; allComments: Comment[]; ideaId: number; currentUser: Member; members: Member[]; depth: number; onUpdate: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const children = allComments.filter(c => c.parent_id === comment.id);
  const timeAgo = formatTimeAgo(comment.created_at);
  const isOwner = currentUser.id === comment.member_id;

  const handleEdit = async () => {
    if (!editText.trim()) return;
    await api(`/comments/${comment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: editText }),
    });
    setEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    await api(`/comments/${comment.id}`, { method: 'DELETE' });
    setConfirmDelete(false);
    onUpdate();
  };

  return (
    <div className={depth > 0 ? 'ml-4 pl-4 border-l-2 border-gray-800' : ''}>
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <Avatar member={{ name: comment.member_name || '', avatar: findMemberAvatar(members, comment.member_name) }} size="sm" />
          <span className="font-medium text-sm text-gray-200">{comment.member_name}</span>
          <span className="text-xs text-gray-600">{timeAgo}</span>
          {(comment as Comment & { edited_at?: string }).edited_at && (
            <span className="text-xs text-gray-700">(edited)</span>
          )}
        </div>
        {editing ? (
          <div className="ml-8 space-y-2">
            <input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEdit()}
              autoFocus
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
            />
            <div className="flex gap-2">
              <button onClick={handleEdit} className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-400 transition">Save</button>
              <button onClick={() => { setEditing(false); setEditText(comment.content); }} className="px-3 py-1 text-gray-400 text-xs hover:text-gray-200 transition">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed ml-8">{comment.content}</p>
        )}
        <div className="flex items-center gap-3 ml-8 mt-1">
          <button
            onClick={() => setShowReply(!showReply)}
            className="text-xs text-gray-500 hover:text-emerald-400 transition font-medium"
          >
            Reply
          </button>
          {isOwner && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-600 hover:text-emerald-400 transition"
              >
                Edit
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-gray-600 hover:text-red-400 transition"
                >
                  Delete
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 font-medium transition">Confirm</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-300 transition">Cancel</button>
                </span>
              )}
            </>
          )}
          {children.length > 0 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-xs text-gray-600 hover:text-gray-400 transition"
            >
              {collapsed ? `[+] ${children.length} ${children.length === 1 ? 'reply' : 'replies'}` : '[-]'}
            </button>
          )}
        </div>
        {showReply && (
          <div className="ml-8 mt-2">
            <CommentReplyBox
              ideaId={ideaId}
              parentId={comment.id}
              currentUser={currentUser}
              onSubmit={() => { setShowReply(false); onUpdate(); }}
            />
          </div>
        )}
      </div>
      {!collapsed && children.length > 0 && (
        <div>
          {children.map(child => (
            <CommentThread
              key={child.id}
              comment={child}
              allComments={allComments}
              ideaId={ideaId}
              currentUser={currentUser}
              members={members}
              depth={depth + 1}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function MultiSelect({ members, selected, onChange }: {
  members: Member[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {members.map(m => {
        const active = selected.includes(m.id);
        return (
          <button
            key={m.id}
            onClick={() => toggle(m.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
              active
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

function IdeaDetail({ idea, currentUser, members, onClose, onUpdate, onDelete }: {
  idea: Idea; currentUser: Member; members: Member[];
  onClose: () => void; onUpdate: () => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(idea.status);
  const [assignedTo, setAssignedTo] = useState<number[]>(idea.assigned_to ?? []);
  const [targetDate, setTargetDate] = useState(idea.target_date ?? '');
  const [editLinks, setEditLinks] = useState<string[]>(idea.links ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    await api(`/ideas/${idea.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        assigned_to: assignedTo,
        target_date: targetDate || null,
        links: editLinks.filter(l => l.trim()),
      }),
    });
    setEditing(false);
    onUpdate();
  };

  const topLevelComments = (idea.comments ?? []).filter(c => !c.parent_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6">
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-start gap-4">
              <Avatar member={members.find(m => m.name === idea.submitted_by_name) || { name: idea.submitted_by_name || '?' }} size="ml" />
              <div>
                <h2 className="text-xl font-semibold text-white">{idea.title}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[idea.status]}`}>
                    {STATUS_LABELS[idea.status]}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{idea.category}</span>
                  <span className="text-xs text-gray-500">by <span className="text-gray-400">{idea.submitted_by_name}</span></span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-2xl leading-none transition">&times;</button>
          </div>

          {idea.description && (
            <p className="text-gray-300 mb-3 whitespace-pre-wrap leading-relaxed">{idea.description}</p>
          )}

          {(idea.links ?? []).length > 0 && (
            <div className="mb-5 space-y-1.5">
              {(idea.links ?? []).map((link, i) => (
                <a
                  key={i}
                  href={link.startsWith('http') ? link : `https://${link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition truncate"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                  {link}
                </a>
              ))}
            </div>
          )}

          <div className="border border-gray-800 rounded-xl p-4 mb-5 bg-gray-800/50">
            {!editing ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {idea.assigned_to_name
                    ? <>Assigned to <strong className="text-gray-200">{idea.assigned_to_name}</strong>{idea.target_date ? ` — present by ${idea.target_date}` : ''}</>
                    : 'Not yet assigned'}
                </div>
                <button onClick={() => setEditing(true)} className="text-sm text-emerald-400 hover:text-emerald-300 transition">Edit</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap items-center">
                  <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Assign to (click to toggle):</p>
                  <MultiSelect members={members} selected={assignedTo} onChange={setAssignedTo} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Resource links (up to 3)</p>
                  {editLinks.map((link, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        value={link}
                        onChange={e => { const l = [...editLinks]; l[i] = e.target.value; setEditLinks(l); }}
                        placeholder="https://..."
                        className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                      />
                      <button onClick={() => setEditLinks(editLinks.filter((_, idx) => idx !== i))} className="text-gray-600 hover:text-red-400 transition px-2">&times;</button>
                    </div>
                  ))}
                  {editLinks.length < 3 && (
                    <button onClick={() => setEditLinks([...editLinks, ''])} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
                      + Add link
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition">Save</button>
                  <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-gray-400 hover:text-gray-200 text-sm transition">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {idea.votes && idea.votes.length > 0 && (
            <div className="mb-5 text-sm text-gray-500">
              Votes: <span className="text-gray-400">{idea.votes.map(v => v.member_name).join(', ')}</span>
            </div>
          )}

          <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase tracking-wide">
            {(idea.comments?.length ?? 0)} Comment{(idea.comments?.length ?? 0) !== 1 ? 's' : ''}
          </h3>

          <div className="mb-4">
            <CommentReplyBox ideaId={idea.id} parentId={null} currentUser={currentUser} onSubmit={onUpdate} />
          </div>

          <div className="divide-y divide-gray-800/50">
            {topLevelComments.map(c => (
              <CommentThread
                key={c.id}
                comment={c}
                allComments={idea.comments ?? []}
                ideaId={idea.id}
                currentUser={currentUser}
                members={members}
                depth={0}
                onUpdate={onUpdate}
              />
            ))}
            {topLevelComments.length === 0 && (
              <p className="text-sm text-gray-600 py-4">No comments yet. Start the discussion!</p>
            )}
          </div>

          {/* Delete */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-600 hover:text-red-400 transition"
              >
                Delete this idea
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-400">Are you sure?</span>
                <button
                  onClick={onDelete}
                  className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-medium hover:bg-red-500/30 transition"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 text-gray-500 text-xs hover:text-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const AVAILABLE_AVATARS = [
  'dan.svg', 'lion.svg', 'migs.svg', 'ben.svg', 'sasch.svg',
  'ninja.svg', 'alien.svg', 'pirate.svg', 'astronaut.svg', 'viking.svg',
  'cat.svg', 'skull.svg', 'phoenix.svg', 'ghost.svg', 'crown.svg',
  'doggie.svg', 'vader.svg', 'link.svg', 'doomguy.svg', 'mario.svg',
  'sonic.svg', 'masterchief.svg', 'pacman.svg', 'mushroom.svg', 'dragon.svg',
];

const AVATAR_NAMES: Record<string, string> = {
  'dan.svg': 'Dan', 'lion.svg': 'Lion', 'migs.svg': 'Migs', 'ben.svg': 'Ben', 'sasch.svg': 'Sasch',
  'ninja.svg': 'Ninja', 'alien.svg': 'Alien', 'pirate.svg': 'Pirate', 'astronaut.svg': 'Astronaut',
  'viking.svg': 'Viking', 'cat.svg': 'Cat', 'skull.svg': 'Skull', 'phoenix.svg': 'Phoenix',
  'ghost.svg': 'Ghost', 'crown.svg': 'Crown', 'doggie.svg': 'Doggie', 'vader.svg': 'Darth Vader',
  'link.svg': 'Link', 'doomguy.svg': 'Doom Guy', 'mario.svg': 'Mario', 'sonic.svg': 'Sonic',
  'masterchief.svg': 'Master Chief', 'pacman.svg': 'Pac-Man', 'mushroom.svg': 'Mushroom', 'dragon.svg': 'Dragon',
};

function ProfilePage({ currentUser, members, ideas, onUpdate }: {
  currentUser: Member; members: Member[]; ideas: Idea[];
  onUpdate: (member: Member) => void;
}) {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const myIdeas = ideas.filter(i => i.submitted_by === currentUser.id);
  const assignedIdeas = ideas.filter(i => (i.assigned_to ?? []).includes(currentUser.id));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const updated = await api<Member>(`/members/${currentUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim(), email, avatar: selectedAvatar }),
    });
    onUpdate({ ...currentUser, ...updated, name: name.trim(), email, avatar: selectedAvatar });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 mb-5">
        <div className="flex items-center gap-4 mb-6">
          <Avatar member={{ ...currentUser, avatar: selectedAvatar }} size="lg" />
          <div>
            <h2 className="text-xl font-semibold text-white">{currentUser.name}</h2>
            <p className="text-sm text-gray-500">Member since {new Date(currentUser.created_at ?? '').toLocaleDateString()}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email (for notifications)</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Pick your avatar</label>
            <div className="flex gap-3 flex-wrap">
              {AVAILABLE_AVATARS.map(av => (
                <button
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  className={`w-14 h-14 rounded-xl border-2 p-1 transition ${
                    selectedAvatar === av
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <img src={`${BASE}/avatars/${av}`} alt={av} className="w-full h-full rounded-lg" />
                </button>
              ))}
              <button
                onClick={() => setSelectedAvatar('')}
                className={`w-14 h-14 rounded-xl border-2 p-1 transition flex items-center justify-center ${
                  !selectedAvatar
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <span className="text-gray-400 text-xs">None</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-emerald-400">{myIdeas.length}</p>
          <p className="text-sm text-gray-500">Ideas submitted</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
          <p className="text-2xl font-bold text-emerald-400">{assignedIdeas.length}</p>
          <p className="text-sm text-gray-500">Assigned to you</p>
        </div>
      </div>

      {assignedIdeas.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Assignments</h3>
          <div className="space-y-2">
            {assignedIdeas.map(idea => (
              <div key={idea.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                <span className="text-sm text-white">{idea.title}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[idea.status]}`}>
                  {STATUS_LABELS[idea.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ ideas, onSelectIdea }: { ideas: Idea[]; onSelectIdea: (id: number) => void }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday = 0
    let startOffset = (firstDay.getDay() + 6) % 7;
    const days: { date: Date; inMonth: boolean }[] = [];

    // Days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), inMonth: false });
    }
    // Days in current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inMonth: true });
    }
    // Fill remaining week
    while (days.length % 7 !== 0) {
      const nextD = days.length - startOffset - lastDay.getDate() + 1;
      days.push({ date: new Date(year, month + 1, nextD), inMonth: false });
    }
    return days;
  }, [year, month]);

  const ideaByDate = useMemo(() => {
    const map: Record<string, Idea[]> = {};
    for (const idea of ideas) {
      if (idea.target_date && (idea.status === 'assigned' || idea.status === 'in-progress' || idea.status === 'completed')) {
        const key = idea.target_date;
        if (!map[key]) map[key] = [];
        map[key].push(idea);
      }
    }
    return map;
  }, [ideas]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div>
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">{MONTHS[month]} {year}</h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border border-gray-800 rounded-2xl overflow-hidden">
        {calendarDays.map(({ date, inMonth }, i) => {
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const dayIdeas = ideaByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isThursday = date.getDay() === 4;

          return (
            <div
              key={i}
              className={`min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 border-t border-l border-gray-800 first:border-l-0 overflow-hidden ${
                !inMonth ? 'bg-gray-950/50' : 'bg-gray-900/50'
              } ${i % 7 === 0 ? 'border-l-0' : ''} ${i < 7 ? 'border-t-0' : ''}`}
            >
              <div className={`text-xs mb-1 flex items-center gap-1 ${
                isToday ? 'text-emerald-400 font-bold' : !inMonth ? 'text-gray-700' : 'text-gray-400'
              }`}>
                {isToday && <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">{date.getDate()}</span>}
                {!isToday && date.getDate()}
                {isThursday && inMonth && <span className="text-emerald-600 text-[10px] ml-auto">THU</span>}
              </div>
              {dayIdeas.map(idea => (
                <div
                  key={idea.id}
                  onClick={() => onSelectIdea(idea.id)}
                  className={`text-xs px-1.5 py-1 rounded-md mb-1 truncate cursor-pointer hover:opacity-80 transition ${
                    idea.status === 'completed'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}
                  title={`${idea.title} — ${idea.assigned_to_name}`}
                >
                  {idea.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend / upcoming list */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Upcoming Presentations</h3>
        {ideas.filter(i => i.target_date && (i.status === 'assigned' || i.status === 'in-progress')).sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? '')).map(idea => (
          <div key={idea.id} onClick={() => onSelectIdea(idea.id)} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-700 transition">
            <div>
              <h4 className="font-medium text-white text-sm">{idea.title}</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {idea.assigned_to_name} — <span className="text-gray-400">{idea.target_date}</span>
              </p>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[idea.status]}`}>
              {STATUS_LABELS[idea.status]}
            </span>
          </div>
        ))}
        {ideas.filter(i => i.target_date && (i.status === 'assigned' || i.status === 'in-progress')).length === 0 && (
          <p className="text-sm text-gray-600">No upcoming presentations scheduled.</p>
        )}
      </div>
    </div>
  );
}
