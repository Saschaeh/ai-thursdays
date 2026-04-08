import { NextResponse } from 'next/server';
import db from '@/lib/db';

export function GET() {
  const ideas = db.prepare(`
    SELECT
      i.*,
      m1.name as submitted_by_name,
      m2.name as assigned_to_name,
      (SELECT COUNT(*) FROM votes WHERE idea_id = i.id) as vote_count,
      (SELECT COUNT(*) FROM comments WHERE idea_id = i.id) as comment_count
    FROM ideas i
    LEFT JOIN members m1 ON i.submitted_by = m1.id
    LEFT JOIN members m2 ON i.assigned_to = m2.id
    ORDER BY i.created_at DESC
  `).all();
  return NextResponse.json(ideas);
}

export function POST(request: Request) {
  return request.json().then((body) => {
    const { title, description, category, submitted_by } = body;
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const result = db.prepare(
      'INSERT INTO ideas (title, description, category, submitted_by) VALUES (?, ?, ?, ?)'
    ).run(title.trim(), description || '', category || 'General', submitted_by);

    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(idea);
  });
}
