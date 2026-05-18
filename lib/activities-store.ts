"use client";

import { useEffect, useSyncExternalStore } from 'react';

import { buildApiUrl } from './api';
import { expireClientSession, getActiveClientSession, useAuthSession } from './auth/client';
import { getScopedStorageKey } from './user-storage';
import {
  normalizeActivities,
  type Activity,
  type ActivityPriority,
  type ActivityStatus,
  type ActivityType,
  type Subtask,
} from './activities-shared';

export type { Activity, ActivityPriority, ActivityStatus, ActivityType, Subtask };

const STORAGE_KEY = 'clearup_activities';
const STORE_EVENT = 'clearup-activities-updated';
let cachedRawValue: string | null = null;
let cachedActivities: Activity[] = [];
let cachedStorageKey: string | null = null;
let activeSyncKey: string | null = null;
let activeSyncPromise: Promise<Activity[]> | null = null;

function parseActivities(value: string | null) {
  if (value === cachedRawValue) {
    return cachedActivities;
  }

  cachedRawValue = value;

  if (!value) {
    cachedActivities = [];
    return cachedActivities;
  }

  try {
    cachedActivities = normalizeActivities(JSON.parse(value));
    return cachedActivities;
  } catch {
    cachedActivities = [];
    return cachedActivities;
  }
}

function resolveStorageKey(userId?: string) {
  const scopedUserId = userId ?? getActiveClientSession()?.id;

  if (!scopedUserId) {
    return STORAGE_KEY;
  }

  return getScopedStorageKey(STORAGE_KEY, scopedUserId);
}

export function readStoredActivities(userId?: string) {
  if (typeof window === 'undefined') {
    return [];
  }

  const storageKey = resolveStorageKey(userId);

  if (cachedStorageKey !== storageKey) {
    cachedRawValue = null;
    cachedActivities = [];
    cachedStorageKey = storageKey;
  }

  return parseActivities(window.localStorage.getItem(storageKey));
}

export function writeStoredActivities(activities: Activity[], userId?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = resolveStorageKey(userId);
  const nextActivities = normalizeActivities(activities);
  const nextRawValue = JSON.stringify(nextActivities);
  cachedRawValue = nextRawValue;
  cachedActivities = nextActivities;
  cachedStorageKey = storageKey;
  window.localStorage.setItem(storageKey, nextRawValue);
  window.dispatchEvent(new Event(STORE_EVENT));
}

async function persistStoredActivities(activities: Activity[]) {
  const response = await fetch(buildApiUrl('/api/activities'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activities }),
    credentials: 'include',
  });

  if (response.status === 401) {
    expireClientSession();
    throw new Error('Tu sesión expiró. Inicia sesión otra vez.');
  }

  if (!response.ok) {
    throw new Error(`No fue posible guardar actividades (${response.status}).`);
  }

  const payload = (await response.json().catch(() => null)) as { activities?: unknown } | null;
  return normalizeActivities(payload?.activities);
}

export function updateStoredActivities(
  updater: (current: Activity[]) => Activity[],
  userId?: string,
) {
  const previousActivities = readStoredActivities(userId);
  const nextActivities = normalizeActivities(updater(previousActivities));
  writeStoredActivities(nextActivities, userId);

  const activeSessionId = userId ?? getActiveClientSession()?.id;

  if (!activeSessionId) {
    return Promise.resolve(nextActivities);
  }

  return persistStoredActivities(nextActivities)
    .then((serverActivities) => {
      writeStoredActivities(serverActivities, activeSessionId);
      return serverActivities;
    })
    .catch((error) => {
      writeStoredActivities(previousActivities, activeSessionId);
      throw error;
    });
}

export function syncStoredActivities(userId?: string) {
  if (typeof window === 'undefined') {
    return Promise.resolve<Activity[]>([]);
  }

  const activeSessionId = userId ?? getActiveClientSession()?.id;

  if (!activeSessionId) {
    writeStoredActivities([], userId);
    return Promise.resolve([]);
  }

  if (activeSyncPromise && activeSyncKey === activeSessionId) {
    return activeSyncPromise;
  }

  activeSyncKey = activeSessionId;
  activeSyncPromise = fetch(buildApiUrl('/api/activities'), { cache: 'no-store', credentials: 'include' })
    .then(async (response) => {
      if (response.status === 401) {
        expireClientSession();
        writeStoredActivities([], activeSessionId);
        return [];
      }

      if (!response.ok) {
        throw new Error(`No fue posible cargar actividades (${response.status}).`);
      }

      const payload = (await response.json().catch(() => null)) as { activities?: unknown } | null;
      const activities = normalizeActivities(payload?.activities);
      writeStoredActivities(activities, activeSessionId);
      return activities;
    })
    .finally(() => {
      activeSyncKey = null;
      activeSyncPromise = null;
    });

  return activeSyncPromise;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();

  window.addEventListener('storage', handleChange);
  window.addEventListener(STORE_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(STORE_EVENT, handleChange);
  };
}

export function useStoredActivities() {
  const session = useAuthSession();
  const userId = session?.id;

  useEffect(() => {
    if (!userId) {
      writeStoredActivities([], userId);
      return;
    }

    syncStoredActivities(userId).catch((error) => {
      console.error('Error syncing activities:', error);
    });
  }, [userId]);

  return useSyncExternalStore(
    subscribe,
    () => readStoredActivities(userId),
    () => [],
  );
}
