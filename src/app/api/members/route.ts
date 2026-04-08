import { NextResponse } from 'next/server';
import db from '@/lib/db';

export function GET() {
  const members = db.prepare('SELECT * FROM members ORDER BY name').all();
  return NextResponse.json(members);
}

export function POST(request: Request) {
  return request.json().then((body) => {
    const { name } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    try {
      const result = db.prepare('INSERT INTO members (name) VALUES (?)').run(name.trim());
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
      return NextResponse.json(member);
    } catch {
      const existing = db.prepare('SELECT * FROM members WHERE name = ?').get(name.trim());
      return NextResponse.json(existing);
    }
  });
}
