import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [body, { id }] = await Promise.all([request.json(), params]);
  const { content, member_id } = body;
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }
  const result = db.prepare(
    'INSERT INTO comments (idea_id, member_id, content) VALUES (?, ?, ?)'
  ).run(id, member_id, content.trim());

  const comment = db.prepare(`
    SELECT c.*, m.name as member_name
    FROM comments c
    JOIN members m ON c.member_id = m.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json(comment);
}
