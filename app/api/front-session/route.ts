import { NextResponse } from 'next/server';

import { FRONTEND_SESSION_COOKIE, type AuthSession } from '@/lib/auth/shared';

function isValidSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<AuthSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.name === 'string' &&
    typeof session.email === 'string'
  );
}

function buildCookieValue(session: AuthSession) {
  return JSON.stringify({
    id: session.id,
    name: session.name,
    email: session.email,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { user?: unknown } | null;

  if (!isValidSession(body?.user)) {
    return NextResponse.json({ error: 'Invalid session payload.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(FRONTEND_SESSION_COOKIE, buildCookieValue(body.user), {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FRONTEND_SESSION_COOKIE, '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    maxAge: 0,
    path: '/',
  });

  return response;
}
