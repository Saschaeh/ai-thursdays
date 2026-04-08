'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

type Member = { id: number; name: string };
type Comment = { id: number; idea_id: number; parent_id: number | null; member_id: number; member_name: string; content: string; created_at: string };
type Vote = { id: number; idea_id: number; member_id: number; member_name: string };
type Idea = {
  id: number; title: string; description: string; category: string;
  status: string; submitted_by: number; submitted_by_name: string;
  assigned_to: number[]; assigned_to_name: string | null; assigned_to_names: string[];
  target_date: string | null; vote_count: number; comment_count: number;
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
  const [tab, setTab] = useState<'ideas' | 'diary'>('ideas');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [showNewMember, setShowNewMember] = useState(false);
  const [hp, setHp] = useState('');

  const loadIdeas = useCallback(async () => {
    const data = await api<Idea[]>('/ideas');
    setIdeas(data);
  }, []);

  const loadMembers = useCallback(async () => {
    const data = await api<Member[]>('/members');
    setMembers(data);
  }, []);

  useEffect(() => {
    loadMembers();
    loadIdeas();
  }, [loadIdeas, loadMembers]);

  const selectUser = (member: Member) => {
    setCurrentUser(member);
    localStorage.setItem('ai-thursdays-user', JSON.stringify(member));
  };

  const handleNewMember = async () => {
    if (!nameInput.trim() || hp) return;
    const member = await api<Member>('/members', {
      method: 'POST',
      body: JSON.stringify({ name: nameInput.trim(), website: hp }),
    });
    selectUser(member);
    setNameInput('');
    setShowNewMember(false);
    loadMembers();
  };

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
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 mb-4">
              <span className="text-white text-lg font-bold">AT</span>
            </div>
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
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white hover:border-emerald-500/50 hover:bg-gray-800/80 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-semibold">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
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
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewMember()}
                  placeholder="Your name"
                  autoFocus
                  className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
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
                  className="px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-400 transition"
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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500">
              <span className="text-white text-xs font-bold">AT</span>
            </div>
            <h1 className="text-lg font-semibold text-white tracking-tight">AI Thursdays</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Hi, <strong className="text-gray-200">{currentUser.name}</strong></span>
            <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition">
              Switch user
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 mt-6">
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
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
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
              {ideas.map(idea => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
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
          <CalendarView ideas={ideas} />
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

  const handleSubmit = async () => {
    if (!title.trim() || hp) return;
    await api('/ideas', {
      method: 'POST',
      body: JSON.stringify({ title, description, category, submitted_by: currentUser.id, website: hp }),
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

function IdeaCard({ idea, onSelect, onVote }: {
  idea: Idea; onSelect: () => void; onVote: () => void;
}) {
  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-white truncate group-hover:text-emerald-400 transition">{idea.title}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[idea.status]}`}>
              {STATUS_LABELS[idea.status]}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{idea.category}</span>
          </div>
          {idea.description && (
            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{idea.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span>by <span className="text-gray-400">{idea.submitted_by_name}</span></span>
            {idea.assigned_to_name && <span>assigned to <strong className="text-gray-400">{idea.assigned_to_name}</strong></span>}
            {idea.comment_count > 0 && <span>{idea.comment_count} comment{idea.comment_count !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onVote(); }}
          className="flex flex-col items-center px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 hover:border-emerald-500/50 hover:bg-gray-750 transition text-sm min-w-[52px]"
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

function CommentThread({ comment, allComments, ideaId, currentUser, depth, onUpdate }: {
  comment: Comment; allComments: Comment[]; ideaId: number; currentUser: Member; depth: number; onUpdate: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const children = allComments.filter(c => c.parent_id === comment.id);
  const timeAgo = formatTimeAgo(comment.created_at);

  return (
    <div className={depth > 0 ? 'ml-4 pl-4 border-l-2 border-gray-800' : ''}>
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-semibold shrink-0">
            {comment.member_name?.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-sm text-gray-200">{comment.member_name}</span>
          <span className="text-xs text-gray-600">{timeAgo}</span>
        </div>
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed ml-8">{comment.content}</p>
        <div className="flex items-center gap-3 ml-8 mt-1">
          <button
            onClick={() => setShowReply(!showReply)}
            className="text-xs text-gray-500 hover:text-emerald-400 transition font-medium"
          >
            Reply
          </button>
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    await api(`/ideas/${idea.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        assigned_to: assignedTo,
        target_date: targetDate || null,
      }),
    });
    setEditing(false);
    onUpdate();
  };

  const topLevelComments = (idea.comments ?? []).filter(c => !c.parent_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-xl font-semibold text-white">{idea.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[idea.status]}`}>
                  {STATUS_LABELS[idea.status]}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{idea.category}</span>
                <span className="text-xs text-gray-500">by <span className="text-gray-400">{idea.submitted_by_name}</span></span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-2xl leading-none transition">&times;</button>
          </div>

          {idea.description && (
            <p className="text-gray-300 mb-5 whitespace-pre-wrap leading-relaxed">{idea.description}</p>
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

function CalendarView({ ideas }: { ideas: Idea[] }) {
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
              className={`min-h-[100px] p-2 border-t border-l border-gray-800 first:border-l-0 ${
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
                  className={`text-xs px-1.5 py-1 rounded-md mb-1 truncate ${
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
          <div key={idea.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
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
