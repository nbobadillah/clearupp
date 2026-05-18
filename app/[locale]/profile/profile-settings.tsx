"use client";

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { buildApiUrl } from '@/lib/api';
import { clearClientSession, persistClientSession, useAuthSession } from '@/lib/auth/client';
import type { AuthSession } from '@/lib/auth/shared';
import { AppIcon, type AppIconName } from '../app-icon';

type ProfileCopy = {
  badge: string;
  title: string;
  subtitle: string;
  accountTitle: string;
  accountBody: string;
  accountSince: string;
  formTitle: string;
  formBody: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  passwordHelp: string;
  save: string;
  saving: string;
  success: string;
  signOut: string;
  switchLanguage: string;
  toolsTitle: string;
  quickLinks: { name: string; href: string; icon: AppIconName }[];
  placeholders: {
    name: string;
    email: string;
    password: string;
  };
};

export function ProfileSettings({ copy, locale }: { copy: ProfileCopy; locale: string }) {
  const session = useAuthSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [name, setName] = useState(session?.name ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const response = await fetch(buildApiUrl('/api/auth/profile'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; user?: AuthSession } | null;

    if (!response.ok) {
      setFeedback({
        type: 'error',
        message: payload?.error ?? 'No fue posible actualizar tu perfil.',
      });
      return;
    }

    setPassword('');
    if (payload?.user) {
      persistClientSession(payload.user);
    }
    setFeedback({ type: 'success', message: copy.success });
    startTransition(() => {
      router.refresh();
    });
  }

  function handleSignOut() {
    startSignOutTransition(async () => {
      await fetch(buildApiUrl('/api/auth/sign-out'), { method: 'POST', credentials: 'include' });
      clearClientSession();
      router.replace(`/${locale}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 py-6 sm:space-y-8 sm:py-8">
      <header className="app-hero rounded-[1.75rem] px-5 py-6 sm:rounded-[2rem] sm:px-7 sm:py-8">
        <p className="app-kicker text-xs font-bold uppercase">{copy.badge}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-4xl md:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">{copy.subtitle}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-panel-strong rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#157a6e,#115e58)] text-2xl font-black text-white shadow-[0_16px_34px_rgba(21,122,110,0.22)]">
              {(session?.name ?? 'C').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{copy.accountTitle}</p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-100">{session?.name ?? 'ClearUp'}</h2>
              <p className="text-sm text-[var(--muted)]">{session?.email ?? 'demo@clearup.app'}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(21,122,110,0.08),rgba(255,255,255,0.92))] p-5 dark:bg-[linear-gradient(135deg,rgba(84,194,179,0.08),rgba(10,22,28,0.92))]">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.accountBody}</p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {copy.accountSince} {new Date().getFullYear()}
            </p>
          </div>

          <div className="mt-5 space-y-4 lg:hidden">
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/85 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">{copy.toolsTitle}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {copy.quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={`/${locale}/${item.href}`}
                    className="inline-flex items-center gap-3 rounded-[1.2rem] border border-[var(--line)] bg-[rgba(243,247,247,0.82)] px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-white"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(21,122,110,0.1)] text-[var(--brand)]">
                      <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <span>{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex items-center justify-center rounded-[1.3rem] border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningOut ? '...' : copy.signOut}
              </button>
              <Link
                href={locale === 'es' ? '/en/profile' : '/es/profile'}
                className="inline-flex items-center justify-center rounded-[1.3rem] border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-zinc-900 transition hover:bg-zinc-50"
              >
                {copy.switchLanguage}
              </Link>
            </div>
          </div>
        </section>

        <section className="app-panel-strong rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-6">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{copy.formTitle}</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-zinc-100">{copy.formBody}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.nameLabel}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.placeholders.name}
                className="app-input"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.emailLabel}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.placeholders.email}
                className="app-input"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.passwordLabel}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={copy.placeholders.password}
                className="app-input"
              />
              <p className="text-xs text-[var(--muted)]">{copy.passwordHelp}</p>
            </label>

            {feedback && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  feedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'
                }`}
              >
                {feedback.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[linear-gradient(135deg,#157a6e,#115e58)] px-8 py-3 font-bold text-white shadow-[0_16px_34px_rgba(21,122,110,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? copy.saving : copy.save}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
