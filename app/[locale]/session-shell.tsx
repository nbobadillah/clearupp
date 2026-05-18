"use client";

import { useEffect, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { buildApiUrl } from '@/lib/api';
import { clearClientSession } from '@/lib/auth/client';
import type { AuthSession } from '@/lib/auth/shared';

import { AppIcon, type AppIconName } from './app-icon';
import { ThemeToggle } from './theme-toggle';

type MenuItem = {
  name: string;
  href: string;
  icon: AppIconName;
};

type SessionShellCopy = {
  tools: string;
  switchLanguage: string;
  signOut: string;
  guest: string;
};

const PRIVATE_ROUTES = new Set([
  'dashboard',
  'tasks',
  'planner',
  'subjects',
  'focus',
  'habits',
  'analytics',
  'reminders',
  'inbox',
  'ai-assistant',
  'calendar',
  'profile',
]);

export function SessionShell({
  children,
  locale,
  session,
  menuItems,
  additionalItems,
  copy,
}: {
  children: React.ReactNode;
  locale: string;
  session: AuthSession | null;
  menuItems: MenuItem[];
  additionalItems: MenuItem[];
  copy: SessionShellCopy;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isAuthPage = pathname === `/${locale}/sign-in`;
  const currentSection = pathname.replace(`/${locale}/`, '').split('/')[0];
  const isPrivateRoute = PRIVATE_ROUTES.has(currentSection);

  useEffect(() => {
    if (!session && isPrivateRoute) {
      router.replace(`/${locale}/sign-in`);
      return;
    }

    if (session && isAuthPage) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [isAuthPage, isPrivateRoute, locale, router, session]);

  async function handleSignOut() {
    startTransition(async () => {
      await fetch(buildApiUrl('/api/auth/sign-out'), { method: 'POST', credentials: 'include' });
      clearClientSession();
      router.replace(`/${locale}`);
      router.refresh();
    });
  }

  if ((isPrivateRoute && !session) || (isAuthPage && session)) {
    return null;
  }

  if (isAuthPage || !session) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  const allItems = [...menuItems, ...additionalItems];
  const currentItem = allItems.find((item) => item.href === currentSection);
  const mobilePrimaryItems = [
    ...menuItems.slice(0, 4),
    additionalItems.find((item) => item.href === 'profile'),
  ].filter(Boolean) as MenuItem[];

  return (
    <div className="flex min-h-screen w-full min-h-0 flex-col lg:flex-row">
      <nav className="hidden app-panel m-4 w-76 flex-col gap-7 rounded-[2.2rem] px-6 py-7 text-zinc-900 lg:flex">
        <div className="space-y-5">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-3 rounded-2xl outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#157a6e,#115e58)] text-xl font-black text-white shadow-[0_14px_34px_rgba(21,122,110,0.24)]">
              C
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--brand)]">ClearUp</h1>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">Student OS</p>
            </div>
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = currentSection === item.href;

            return (
              <Link
                key={item.href}
                href={`/${locale}/${item.href}`}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3.5 font-medium transition ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#157a6e,#115e58)] text-white shadow-[0_16px_32px_rgba(21,122,110,0.22)]'
                    : 'text-[var(--muted)] hover:bg-white/80 hover:text-[var(--brand)]'
                }`}
              >
                <span
                  className={`flex h-9 min-w-9 items-center justify-center rounded-xl border transition ${
                    isActive
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-[var(--line)] bg-white/85 text-zinc-700 group-hover:border-[var(--glow)] group-hover:text-[var(--brand)]'
                  } ${isActive ? 'scale-105' : 'group-hover:scale-105'}`}
                >
                  <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{item.name}</span>
                <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white/80' : 'bg-transparent group-hover:bg-[var(--glow)]'}`} />
              </Link>
            );
          })}
        </div>

        <div className="border-t border-zinc-200/70 pt-4">
          <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{copy.tools}</p>
          <div className="flex flex-col gap-2">
            {additionalItems.map((item) => {
              const isActive = currentSection === item.href;

              return (
                <Link
                  key={item.href}
                  href={`/${locale}/${item.href}`}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[rgba(21,122,110,0.1)] text-[var(--brand)] ring-1 ring-[rgba(21,122,110,0.12)]'
                      : 'text-[var(--muted)] hover:bg-white/80 hover:text-[var(--brand)]'
                  }`}
                >
                  <span
                    className={`flex h-9 min-w-9 items-center justify-center rounded-xl border transition ${
                      isActive
                        ? 'border-[rgba(21,122,110,0.2)] bg-white/85 text-[var(--brand)]'
                        : 'border-[var(--line)] bg-white/85 text-zinc-700 group-hover:border-[var(--glow)] group-hover:text-[var(--brand)]'
                    }`}
                  >
                    <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <ThemeToggle />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isPending}
            className="block w-full rounded-2xl border border-[var(--line)] bg-white/80 p-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copy.signOut}
          </button>

          <Link
            href={locale === 'es' ? '/en' : '/es'}
            className="block rounded-2xl border border-[var(--line)] bg-white/80 p-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-[var(--foreground)] transition hover:bg-white"
          >
            {copy.switchLanguage}
          </Link>

          <div className="text-center text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">By group 1</div>
        </div>
      </nav>

      <div className="sticky top-0 z-30 border-b border-[var(--line)] bg-[rgba(243,247,247,0.94)] px-3 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/${locale}/dashboard`}
            className="flex min-w-0 items-center gap-3 rounded-[1.6rem] bg-white/85 px-3 py-2.5 shadow-[0_10px_24px_rgba(14,42,51,0.06)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#157a6e,#115e58)] text-sm font-black text-white">
              C
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight text-[var(--brand)]">ClearUp</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">Student OS</p>
            </div>
          </Link>

          <Link
            href={`/${locale}/profile`}
            className="flex min-w-0 items-center gap-2 rounded-[1.6rem] border border-[var(--line)] bg-white/85 px-3 py-2.5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#157a6e,#115e58)] text-sm font-bold text-white">
              {(session?.name ?? 'C').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">{session?.name ?? 'ClearUp'}</p>
              <p className="hidden truncate text-xs text-[var(--muted)] sm:block">{session?.email ?? 'Workspace ready'}</p>
            </div>
          </Link>
        </div>
      </div>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-2 pb-28 pt-2 md:px-4 lg:p-4 xl:p-7">
        <div className="app-panel rounded-[1.6rem] px-4 py-4 sm:rounded-[2.2rem] sm:px-5 sm:py-5 md:px-7 md:py-6">
          <header className="mb-5 flex flex-col gap-3 border-b border-zinc-200/70 pb-4 md:mb-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workspace</p>
              <h2 className="mt-1 text-[1.9rem] font-black tracking-tight text-zinc-950 sm:text-3xl">
                {currentItem?.name ?? 'ClearUp'}
              </h2>
            </div>
            <Link
              href={`/${locale}/profile`}
              className="hidden items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 md:flex"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#157a6e,#115e58)] text-sm font-bold text-white">
                {(session?.name ?? 'C').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-950">{session?.name ?? 'ClearUp'}</p>
                <p className="text-xs text-[var(--muted)]">{session?.email ?? 'Workspace ready'}</p>
              </div>
            </Link>
          </header>
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[rgba(243,247,247,0.96)] px-3 py-2.5 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-2">
          {mobilePrimaryItems.map((item) => {
            const isActive = currentSection === item.href;

            return (
              <Link
                key={item.href}
                href={`/${locale}/${item.href}`}
                className={`flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[1.4rem] px-2 py-2 text-[10px] font-semibold transition ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#157a6e,#115e58)] text-white shadow-[0_12px_24px_rgba(21,122,110,0.16)]'
                    : 'bg-white/80 text-[var(--muted)]'
                }`}
              >
                <AppIcon name={item.icon} className="h-[17px] w-[17px]" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
