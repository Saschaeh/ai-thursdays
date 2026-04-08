import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [body, { id }] = await Promise.all([request.json(), params]);
  const { member_id } = body;
  try {
    db.prepare('INSERT INTO votes (idea_id, member_id) VALUES (?, ?)').run(id, member_id);
    return NextResponse.json({ voted: true });
  } catch {
    db.prepare('DELETE FROM votes WHERE idea_id = ? AND member_id = ?').run(id, member_id);
    return NextResponse.json({ voted: false });
  }
}
