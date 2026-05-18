"use client";

import { useState, useTransition } from 'react';
import Link from 'next/link';

import { buildApiUrl } from '@/lib/api';
import { persistClientSession } from '@/lib/auth/client';
import type { AuthSession } from '@/lib/auth/shared';

type AuthCopy = {
  badge: string;
  title: string;
  subtitle: string;
  signInTab: string;
  signUpTab: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  signInAction: string;
  signUpAction: string;
  switchToSignIn: string;
  switchToSignUp: string;
  helper: string;
  demoTitle: string;
  demoBody: string;
};

export function AuthForm({ locale, copy }: { locale: string; copy: AuthCopy }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const submitLabel = mode === 'sign-in' ? copy.signInAction : copy.signUpAction;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    startTransition(async () => {
      const response = await fetch(buildApiUrl(`/api/auth/${mode}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; user?: AuthSession } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'No fue posible completar la solicitud.');
        return;
      }

      if (payload?.user) {
        persistClientSession(payload.user);

        const frontSessionResponse = await fetch('/api/front-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: payload.user }),
          credentials: 'include',
        });

        if (!frontSessionResponse.ok) {
          setError('No fue posible iniciar la sesión del workspace.');
          return;
        }
      }

      window.location.replace(`/${locale}/dashboard`);
    });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f6fbfb_0%,#fbfefe_48%,#edf7f7_100%)] px-8 py-12 text-zinc-900 lg:px-14 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(21,122,110,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_28%)]" />
        <div className="relative mx-auto flex h-full max-w-xl flex-col justify-between">
          <div className="space-y-6">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand)] shadow-[0_14px_30px_rgba(14,42,51,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
            >
              <span aria-hidden="true">←</span>
              Volver al inicio
            </Link>

            <span className="inline-flex rounded-full border border-[rgba(21,122,110,0.18)] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand)] shadow-[0_10px_24px_rgba(21,122,110,0.08)]">
              {copy.badge}
            </span>
            <div className="space-y-4">
              <h1 className="max-w-lg text-5xl font-black tracking-tight text-zinc-950">{copy.title}</h1>
              <p className="max-w-xl text-base leading-7 text-zinc-600">{copy.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[2rem] border border-white/90 bg-white/85 p-5 shadow-[0_22px_48px_rgba(14,42,51,0.08)]">
              <div className="rounded-[1.4rem] bg-[linear-gradient(135deg,#def7f2,#f5fdfe)] p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#157a6e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8be4d8]" />
                </div>
                <div className="mt-4 space-y-3">
                  <div className="h-16 rounded-[1.2rem] bg-white/90" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-12 rounded-2xl bg-white/80" />
                    <div className="h-12 rounded-2xl bg-white/80" />
                    <div className="h-12 rounded-2xl bg-white/80" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,#f7fbfb,#eef8f8)] p-6 shadow-[0_22px_48px_rgba(14,42,51,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand)]">{copy.demoTitle}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{copy.demoBody}</p>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            © 2026 Web designers group1
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[linear-gradient(180deg,#fbfefe,#eef7f7)] px-6 py-10 lg:px-10">
        <div className="w-full max-w-md rounded-[2.2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.92)] p-8 shadow-[0_28px_70px_rgba(14,42,51,0.08)] backdrop-blur">
          <div className="grid grid-cols-2 rounded-2xl bg-[rgba(21,122,110,0.08)] p-1 text-sm font-semibold text-[var(--muted)]">
            <button
              type="button"
              onClick={() => setMode('sign-in')}
              className={`rounded-xl px-4 py-3 transition ${mode === 'sign-in' ? 'bg-white text-zinc-950 shadow-sm' : ''}`}
            >
              {copy.signInTab}
            </button>
            <button
              type="button"
              onClick={() => setMode('sign-up')}
              className={`rounded-xl px-4 py-3 transition ${mode === 'sign-up' ? 'bg-white text-zinc-950 shadow-sm' : ''}`}
            >
              {copy.signUpTab}
            </button>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {mode === 'sign-up' ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">{copy.nameLabel}</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={copy.namePlaceholder}
                  className="app-input"
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">{copy.emailLabel}</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.emailPlaceholder}
                className="app-input"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">{copy.passwordLabel}</span>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={copy.passwordPlaceholder}
                className="app-input"
              />
            </label>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#157a6e,#115e58)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(21,122,110,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? '...' : submitLabel}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[var(--muted)]">
            {mode === 'sign-in' ? copy.switchToSignUp : copy.switchToSignIn}
          </p>
          <p className="mt-2 text-center text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{copy.helper}</p>
        </div>
      </section>
    </div>
  );
}
