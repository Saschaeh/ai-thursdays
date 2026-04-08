'use client';

import { useState, useEffect, useCallback } from 'react';

type Member = { id: number; name: string };
type Comment = { id: number; idea_id: number; member_id: number; member_name: string; content: string; created_at: string };
type Vote = { id: number; idea_id: number; member_id: number; member_name: string };
type Idea = {
  id: number; title: string; description: string; category: string;
  status: string; submitted_by: number; submitted_by_name: string;
  assigned_to: number | null; assigned_to_name: string | null;
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
  'new': 'bg-blue-100 text-blue-800',
  'discussed': 'bg-yellow-100 text-yellow-800',
  'assigned': 'bg-purple-100 text-purple-800',
  'in-progress': 'bg-orange-100 text-orange-800',
  'completed': 'bg-green-100 text-green-800',
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
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

  const loadIdeas = useCallback(async () => {
    const data = await api<Idea[]>('/ideas');
    setIdeas(data);
  }, []);

  useEffect(() => {
    api<Member[]>('/members').then(setMembers);
    loadIdeas();

    const saved = localStorage.getItem('ai-thursdays-user');
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [loadIdeas]);

  const handleLogin = async () => {
    if (!nameInput.trim()) return;
    const member = await api<Member>('/members', {
      method: 'POST',
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    setCurrentUser(member);
    localStorage.setItem('ai-thursdays-user', JSON.stringify(member));
    setNameInput('');
    api<Member[]>('/members').then(setMembers);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ai-thursdays-user');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
          <h1 className="text-2xl font-bold text-center mb-2">AI Thursdays</h1>
          <p className="text-gray-500 text-center mb-6 text-sm">Enter your name to get started</p>
          <div className="flex gap-2">
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Your name"
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  const assignedIdeas = ideas.filter(i => i.status === 'assigned' || i.status === 'in-progress');
  const completedIdeas = ideas.filter(i => i.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-700">AI Thursdays</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Hi, <strong>{currentUser.name}</strong></span>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">
              Switch user
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm w-fit">
          <button
            onClick={() => setTab('ideas')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'ideas' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Ideas
          </button>
          <button
            onClick={() => setTab('diary')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'diary' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Diary / Schedule
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {tab === 'ideas' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-600 text-sm">{ideas.length} idea{ideas.length !== 1 ? 's' : ''} submitted</p>
              <button
                onClick={() => setShowNewIdea(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
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
                <p className="text-center text-gray-400 py-12">No ideas yet. Be the first to add one!</p>
              )}
            </div>
          </>
        )}

        {tab === 'diary' && (
          <DiaryView assigned={assignedIdeas} completed={completedIdeas} />
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

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await api('/ideas', {
      method: 'POST',
      body: JSON.stringify({ title, description, category, submitted_by: currentUser.id }),
    });
    onSubmit();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border">
      <h3 className="font-semibold mb-3">New Idea</h3>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title — what's the tool or topic?"
        className="w-full px-3 py-2 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Notes — why is this interesting? Links, context..."
        rows={3}
        className="w-full px-3 py-2 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
      />
      <div className="flex gap-2 items-center">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
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
      className="bg-white rounded-xl shadow-sm p-4 border hover:shadow-md transition cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{idea.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[idea.status]}`}>
              {STATUS_LABELS[idea.status]}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{idea.category}</span>
          </div>
          {idea.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{idea.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span>by {idea.submitted_by_name}</span>
            {idea.assigned_to_name && <span>assigned to <strong>{idea.assigned_to_name}</strong></span>}
            {idea.comment_count > 0 && <span>{idea.comment_count} comment{idea.comment_count !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onVote(); }}
          className="flex flex-col items-center px-3 py-1 rounded-lg border hover:bg-indigo-50 transition text-sm min-w-[48px]"
          title="Click to toggle your vote"
        >
          <span className="text-lg leading-none">&#9650;</span>
          <span className="font-semibold text-indigo-600">{idea.vote_count}</span>
        </button>
      </div>
    </div>
  );
}

function IdeaDetail({ idea, currentUser, members, onClose, onUpdate }: {
  idea: Idea; currentUser: Member; members: Member[];
  onClose: () => void; onUpdate: () => void;
}) {
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(idea.status);
  const [assignedTo, setAssignedTo] = useState<number | string>(idea.assigned_to ?? '');
  const [targetDate, setTargetDate] = useState(idea.target_date ?? '');

  const handleComment = async () => {
    if (!comment.trim()) return;
    await api(`/ideas/${idea.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: comment, member_id: currentUser.id }),
    });
    setComment('');
    onUpdate();
  };

  const handleSave = async () => {
    await api(`/ideas/${idea.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        assigned_to: assignedTo || null,
        target_date: targetDate || null,
      }),
    });
    setEditing(false);
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">{idea.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[idea.status]}`}>
                  {STATUS_LABELS[idea.status]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{idea.category}</span>
                <span className="text-xs text-gray-400">by {idea.submitted_by_name}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>

          {idea.description && (
            <p className="text-gray-700 mb-4 whitespace-pre-wrap">{idea.description}</p>
          )}

          <div className="border rounded-lg p-3 mb-4 bg-gray-50">
            {!editing ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {idea.assigned_to_name
                    ? <>Assigned to <strong>{idea.assigned_to_name}</strong>{idea.target_date ? ` — present by ${idea.target_date}` : ''}</>
                    : 'Not yet assigned'}
                </div>
                <button onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:underline">Edit</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <select value={status} onChange={e => setStatus(e.target.value)} className="px-2 py-1 border rounded text-sm">
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="px-2 py-1 border rounded text-sm">
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="px-2 py-1 border rounded text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Save</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1 text-gray-500 text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {idea.votes && idea.votes.length > 0 && (
            <div className="mb-4 text-sm text-gray-500">
              Votes: {idea.votes.map(v => v.member_name).join(', ')}
            </div>
          )}

          <h3 className="font-semibold mb-2 text-sm text-gray-700">Comments</h3>
          <div className="space-y-3 mb-4">
            {idea.comments?.map(c => (
              <div key={c.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">{c.member_name}</span>
                  <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {(!idea.comments || idea.comments.length === 0) && (
              <p className="text-sm text-gray-400">No comments yet.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={handleComment}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiaryView({ assigned, completed }: { assigned: Idea[]; completed: Idea[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Active Assignments</h2>
        {assigned.length === 0 ? (
          <p className="text-gray-400 text-sm">No active assignments. Discuss ideas on Thursday and assign topics!</p>
        ) : (
          <div className="grid gap-3">
            {assigned.map(idea => (
              <div key={idea.id} className="bg-white rounded-xl shadow-sm p-4 border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{idea.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Assigned to <strong>{idea.assigned_to_name}</strong>
                      {idea.target_date && <> — present by <strong>{idea.target_date}</strong></>}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[idea.status]}`}>
                    {STATUS_LABELS[idea.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Completed</h2>
        {completed.length === 0 ? (
          <p className="text-gray-400 text-sm">No completed topics yet.</p>
        ) : (
          <div className="grid gap-3">
            {completed.map(idea => (
              <div key={idea.id} className="bg-white rounded-xl shadow-sm p-4 border opacity-80">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{idea.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Presented by <strong>{idea.assigned_to_name}</strong>
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS['completed']}`}>Completed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
