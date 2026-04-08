import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idea = db.prepare(`
    SELECT i.*,
      m1.name as submitted_by_name,
      m2.name as assigned_to_name,
      (SELECT COUNT(*) FROM votes WHERE idea_id = i.id) as vote_count
    FROM ideas i
    LEFT JOIN members m1 ON i.submitted_by = m1.id
    LEFT JOIN members m2 ON i.assigned_to = m2.id
    WHERE i.id = ?
  `).get(id);

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const comments = db.prepare(`
    SELECT c.*, m.name as member_name
    FROM comments c
    JOIN members m ON c.member_id = m.id
    WHERE c.idea_id = ?
    ORDER BY c.created_at ASC
  `).all(id);

  const votes = db.prepare(`
    SELECT v.*, m.name as member_name
    FROM votes v
    JOIN members m ON v.member_id = m.id
    WHERE v.idea_id = ?
  `).all(id);

  return NextResponse.json({ ...idea, comments, votes });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [body, { id }] = await Promise.all([request.json(), params]);
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const key of ['title', 'description', 'category', 'status', 'assigned_to', 'target_date']) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE ideas SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
