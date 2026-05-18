"use client";

import { createContext, useContext, useEffect } from 'react';

import { FRONTEND_SESSION_COOKIE } from './shared';
import type { AuthSession } from './shared';

const AuthSessionContext = createContext<AuthSession | null>(null);

let activeClientSession: AuthSession | null = null;

function buildCookieOptions(maxAge: number) {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function AuthSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AuthSession | null;
}) {
  useEffect(() => {
    activeClientSession = session;

    return () => {
      activeClientSession = null;
    };
  }, [session]);

  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}

export function getActiveClientSession() {
  return activeClientSession;
}

export function persistClientSession(session: AuthSession) {
  activeClientSession = session;
  document.cookie = `${FRONTEND_SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}; ${buildCookieOptions(60 * 60 * 24 * 7)}`;
}

export function clearClientSession() {
  activeClientSession = null;
  document.cookie = `${FRONTEND_SESSION_COOKIE}=; ${buildCookieOptions(0)}`;
}

export function expireClientSession() {
  clearClientSession();

  if (typeof window === 'undefined') {
    return;
  }

  const [, locale] = window.location.pathname.split('/');
  const nextLocale = locale === 'en' ? 'en' : 'es';
  window.location.replace(`/${nextLocale}/sign-in`);
}
