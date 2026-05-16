"use client";

import { useMemo, useState } from 'react';
import {
  type Activity,
  type ActivityPriority,
  type ActivityStatus,
  type ActivityType,
  updateStoredActivities,
  useStoredActivities,
} from '@/lib/activities-store';
import { useAuthSession } from '@/lib/auth/client';

type EscalationLevel = 'low' | 'medium' | 'high' | 'critical';

type FormState = {
  title: string;
  course: string;
  type: ActivityType;
  dueDate: string;
  priority: ActivityPriority;
  status: ActivityStatus;
  reminder: string;
  progress: number;
  subtasks: string;
};

export type TasksCopy = {
  title: string;
  subtitle: string;
  newActivity: string;
  editActivity: string;
  formDescription: string;
  saveActivity: string;
  updateActivity: string;
  resetForm: string;
  fields: Record<'title' | 'course' | 'type' | 'dueDate' | 'priority' | 'status' | 'reminder' | 'subtasks' | 'progress', string>;
  placeholders: Record<'title' | 'course' | 'subtasks', string>;
  types: Record<ActivityType, string>;
  priorities: Record<ActivityPriority, string>;
  statuses: Record<ActivityStatus, string>;
  summary: Record<'total' | 'dueSoon' | 'highPriority' | 'completed', string>;
  actions: Record<'edit' | 'delete' | 'toggleStatus' | 'clearReminder' | 'addReminder' | 'resolveAlert', string>;
  labels: Record<'progressCompleted' | 'subtasksCompleted' | 'reminderNone' | 'reminderAt' | 'dueLabel' | 'emptyTitle' | 'activitiesList' | 'smartReminders' | 'escalationPanel' | 'alertsReady' | 'noAlerts' | 'riskLevel' | 'suggestedAction' | 'smartRule' | 'noActivities' | 'basicInfo' | 'planningInfo' | 'subtasksInfo' | 'emptyHint' | 'listEyebrow' | 'guideTitle' | 'chooseType' | 'choosePriority' | 'chooseStatus' | 'previewTitle' | 'previewEmpty' | 'autoProgressHelp', string>;
  escalation: Record<EscalationLevel, string>;
  smartMessages: Record<'criticalDeadline' | 'highPriorityStalled' | 'reminderMissing' | 'lowProgress' | 'onTrack' | 'criticalAction' | 'highAction' | 'reminderAction' | 'progressAction', string>;
};

type SmartAlert = {
  activityId: number;
  title: string;
  level: EscalationLevel;
  message: string;
  action: string;
};

const emptyForm: FormState = {
  title: '',
  course: '',
  type: 'assignment',
  dueDate: '',
  priority: 'medium',
  status: 'pending',
  reminder: '',
  progress: 0,
  subtasks: '',
};

const statusOrder: ActivityStatus[] = ['pending', 'inProgress', 'completed'];

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function TasksManager({ copy }: { copy: TasksCopy }) {
  const activities = useStoredActivities();
  const session = useAuthSession();
  const today = useMemo(() => getToday(), []);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const summary = useMemo(() => {
    const dueSoon = activities.filter((activity) => {
      const dueDate = new Date(`${activity.dueDate}T00:00:00`);
      const diff = dueDate.getTime() - today.getTime();
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
    }).length;

    return {
      total: activities.length,
      dueSoon,
      highPriority: activities.filter((activity) => activity.priority === 'high').length,
      completed: activities.filter((activity) => activity.status === 'completed').length,
    };
  }, [activities, today]);

  const smartAlerts = useMemo(() => {
    return activities
      .filter((activity) => activity.status !== 'completed')
      .map((activity) => buildSmartAlert(activity, copy, getActivityProgress(activity), today))
      .filter(isSmartAlert)
      .sort((left, right) => escalationScore(right.level) - escalationScore(left.level));
  }, [activities, copy, today]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function parseSubtasks(subtasksValue: string, baseId: number) {
    return subtasksValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((title, index) => ({
        id: baseId + index + 1,
        title,
        done: false,
      }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTitle = form.title.trim();
    if (!normalizedTitle) {
      return;
    }

    setIsSaving(true);
    setSubmitError(null);

    try {
      await updateStoredActivities(
        (current) => {
          if (editingId !== null) {
            return current.map((activity) =>
              activity.id === editingId
                ? {
                    ...activity,
                    title: normalizedTitle,
                    course: form.course.trim(),
                    type: form.type,
                    dueDate: form.dueDate,
                    priority: form.priority,
                    status: form.status,
                    reminder: form.reminder,
                    progress:
                      form.subtasks.trim().length > 0
                        ? 0
                        : activity.progress,
                    subtasks:
                      form.subtasks.trim().length > 0
                        ? parseSubtasks(form.subtasks, editingId * 100)
                        : activity.subtasks,
                  }
                : activity
            );
          }

          const nextId = current.length === 0 ? 1 : Math.max(...current.map((activity) => activity.id)) + 1;

          return [
            {
              id: nextId,
              title: normalizedTitle,
              course: form.course.trim(),
              type: form.type,
              dueDate: form.dueDate,
              priority: form.priority,
              status: form.status,
              reminder: form.reminder,
              progress: 0,
              subtasks: parseSubtasks(form.subtasks, nextId * 100),
            },
            ...current,
          ];
        },
        session?.id
      );

      resetForm();
    } catch (error) {
      console.error('Error saving activity:', error);
      setSubmitError(error instanceof Error ? error.message : 'No fue posible guardar la actividad.');
    }
    finally {
      setIsSaving(false);
    }
  }

  function handleEdit(activity: Activity) {
    setEditingId(activity.id);
    setForm({
      title: activity.title,
      course: activity.course,
      type: activity.type,
      dueDate: activity.dueDate,
      priority: activity.priority,
      status: activity.status,
      reminder: activity.reminder,
      progress: activity.progress,
      subtasks: activity.subtasks.map((subtask) => subtask.title).join(', '),
    });
  }

  function toggleSubtask(activityId: number, subtaskId: number) {
    updateStoredActivities((current) =>
      current.map((activity) => {
        if (activity.id !== activityId) {
          return activity;
        }

        const subtasks = activity.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
        );

        return {
          ...activity,
          subtasks,
          progress: calculateProgressFromSubtasks(subtasks, activity.progress),
        };
      })
    );
  }

  function cycleStatus(activityId: number) {
    updateStoredActivities((current) =>
      current.map((activity) => {
        if (activity.id !== activityId) {
          return activity;
        }

        const currentIndex = statusOrder.indexOf(activity.status);
        return {
          ...activity,
          status: statusOrder[(currentIndex + 1) % statusOrder.length],
        };
      })
    );
  }

  function toggleReminder(activityId: number) {
    updateStoredActivities((current) =>
      current.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              reminder: activity.reminder ? '' : `${activity.dueDate}T08:00`,
            }
          : activity
      )
    );
  }

  function deleteActivity(activityId: number) {
    updateStoredActivities((current) => current.filter((activity) => activity.id !== activityId));

    if (editingId === activityId) {
      resetForm();
    }
  }

  function applySmartAction(activityId: number) {
    updateStoredActivities((current) =>
      current.map((activity) => {
        if (activity.id !== activityId) {
          return activity;
        }

        const daysLeft = getDaysLeft(activity.dueDate, today);

        if (daysLeft <= 2) {
          return {
            ...activity,
            reminder: activity.reminder || `${activity.dueDate}T07:00`,
            status: 'inProgress',
            priority: 'high',
          };
        }

        if (!activity.reminder) {
          return {
            ...activity,
            reminder: `${activity.dueDate}T08:00`,
          };
        }

        return {
          ...activity,
          status: activity.status === 'pending' ? 'inProgress' : activity.status,
          progress: activity.subtasks.length === 0 ? Math.max(activity.progress, 40) : getActivityProgress(activity),
        };
      })
    );
  }

  return (
    <div className="space-y-8">
      <header className="app-hero rounded-[2rem] px-7 py-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="app-kicker text-xs font-bold uppercase">Task Studio</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-zinc-600">
              {copy.subtitle}
            </p>
          </div>
          <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_18px_40px_rgba(14,42,51,0.06)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand)]">
              {summary.completed}/{summary.total}
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-600">{copy.summary.completed}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={copy.summary.total} value={summary.total} accent="bg-sky-100 text-sky-700" />
        <SummaryCard label={copy.summary.dueSoon} value={summary.dueSoon} accent="bg-amber-100 text-amber-700" />
        <SummaryCard label={copy.summary.highPriority} value={summary.highPriority} accent="bg-rose-100 text-rose-700" />
        <SummaryCard label={copy.summary.completed} value={summary.completed} accent="bg-emerald-100 text-emerald-700" />
      </section>

      <section className="rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#ffffff,#fff1f2)] p-6 shadow-[0_20px_48px_rgba(245,158,11,0.08)] dark:border-amber-900/50 dark:bg-[linear-gradient(135deg,#1a2328,#101a1f,#172126)] dark:shadow-[0_20px_48px_rgba(0,0,0,0.24)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
              {copy.labels.smartReminders}
            </p>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{copy.labels.escalationPanel}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {smartAlerts.length > 0 ? `${smartAlerts.length} ${copy.labels.alertsReady}` : copy.labels.noAlerts}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {smartAlerts.length > 0 ? (
            smartAlerts.map((alert) => (
              <div key={alert.activityId} className="rounded-[1.7rem] border border-white bg-white/95 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900/95 dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{alert.title}</h3>
                  <EscalationBadge label={copy.escalation[alert.level]} level={alert.level} />
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{alert.message}</p>
                <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                    {copy.labels.suggestedAction}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{alert.action}</p>
                </div>
                <button
                  type="button"
                  onClick={() => applySmartAction(alert.activityId)}
                  className="mt-4 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                >
                  {copy.actions.resolveAlert}
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-[1.7rem] border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              {copy.smartMessages.onTrack}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="app-panel-strong overflow-hidden rounded-[2rem]">
          <div className="bg-[linear-gradient(135deg,#f7fcfb,#eef8f6)] px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand)]">
                  {editingId === null ? copy.newActivity : copy.editActivity}
                </p>
                <h2 className="text-3xl font-black tracking-tight text-zinc-950">
                  {editingId === null ? copy.saveActivity : copy.updateActivity}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-zinc-600">{copy.formDescription}</p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--brand)] shadow-sm sm:flex">
                <span className="text-2xl font-black">+</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div className="rounded-[1.7rem] border border-[rgba(21,122,110,0.16)] bg-[linear-gradient(135deg,#f8fdfc,#eef8f6)] p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[var(--brand)]">{copy.labels.guideTitle}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <GuideStep number="1" title={copy.labels.basicInfo} />
                <GuideStep number="2" title={copy.labels.planningInfo} />
                <GuideStep number="3" title={copy.labels.subtasksInfo} />
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/70 p-5">
              <SectionTitle eyebrow="01" title={copy.labels.basicInfo} />
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Field>
              <label className="text-sm font-medium text-zinc-700">{copy.fields.title}</label>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={copy.placeholders.title}
                className="app-input mt-2"
              />
                </Field>

                <Field>
              <label className="text-sm font-medium text-zinc-700">{copy.fields.course}</label>
              <input
                value={form.course}
                onChange={(event) => setForm({ ...form, course: event.target.value })}
                placeholder={copy.placeholders.course}
                className="app-input mt-2"
              />
                </Field>

                <Field>
                  <ChoiceGroup
                    label={copy.labels.chooseType}
                    value={form.type}
                    options={[
                      { value: 'assignment', label: copy.types.assignment },
                      { value: 'exam', label: copy.types.exam },
                      { value: 'project', label: copy.types.project },
                    ]}
                    onChange={(value) => setForm({ ...form, type: value as ActivityType })}
                  />
                </Field>

                <Field>
              <label className="text-sm font-medium text-zinc-700">{copy.fields.dueDate}</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                className="app-input mt-2"
              />
                </Field>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/70 p-5">
              <SectionTitle eyebrow="02" title={copy.labels.planningInfo} />
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Field>
                  <ChoiceGroup
                    label={copy.labels.choosePriority}
                    value={form.priority}
                    options={[
                      { value: 'high', label: copy.priorities.high },
                      { value: 'medium', label: copy.priorities.medium },
                      { value: 'low', label: copy.priorities.low },
                    ]}
                    onChange={(value) => setForm({ ...form, priority: value as ActivityPriority })}
                  />
                </Field>

                <Field>
                  <ChoiceGroup
                    label={copy.labels.chooseStatus}
                    value={form.status}
                    options={[
                      { value: 'pending', label: copy.statuses.pending },
                      { value: 'inProgress', label: copy.statuses.inProgress },
                      { value: 'completed', label: copy.statuses.completed },
                    ]}
                    onChange={(value) => setForm({ ...form, status: value as ActivityStatus })}
                  />
                </Field>

                <Field>
              <label className="text-sm font-medium text-zinc-700">{copy.fields.reminder}</label>
              <input
                type="datetime-local"
                value={form.reminder}
                onChange={(event) => setForm({ ...form, reminder: event.target.value })}
                className="app-input mt-2"
              />
                </Field>

                <Field>
                  <label className="text-sm font-medium text-zinc-700">
                {copy.fields.progress} <span className="text-zinc-400">(auto)</span>
              </label>
                  <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                    <p className="text-sm leading-6 text-zinc-600">
                      {copy.labels.autoProgressHelp}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-zinc-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#157a6e,#38bdf8)]" style={{ width: '0%' }} />
                    </div>
                  </div>
                </Field>
              </div>
            </div>

            <ActivityPreview
              title={copy.labels.previewTitle}
              emptyTitle={copy.labels.previewEmpty}
              form={form}
              copy={copy}
            />

            <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/70 p-5">
              <SectionTitle eyebrow="03" title={copy.labels.subtasksInfo} />
              <Field>
            <label className="text-sm font-medium text-zinc-700">{copy.fields.subtasks}</label>
            <textarea
              value={form.subtasks}
              onChange={(event) => setForm({ ...form, subtasks: event.target.value })}
              placeholder={copy.placeholders.subtasks}
              className="app-input mt-2 min-h-28"
            />
              </Field>
            </div>

            {submitError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
                className="rounded-2xl bg-[linear-gradient(135deg,#157a6e,#115e58)] px-6 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(21,122,110,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
            >
              {isSaving
                ? 'Guardando...'
                : editingId === null
                  ? copy.saveActivity
                  : copy.updateActivity}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              {copy.resetForm}
            </button>
            </div>
          </div>
        </form>

        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-[1.6rem] border border-[var(--line)] bg-white/72 px-5 py-4 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--brand)]">{copy.labels.listEyebrow}</p>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900">{copy.labels.activitiesList}</h2>
            </div>
            <span className="rounded-2xl bg-[rgba(21,122,110,0.1)] px-4 py-2 text-sm font-black text-[var(--brand)]">
              {activities.length}
            </span>
          </div>

          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(21,122,110,0.22)] bg-[linear-gradient(135deg,#ffffff,#f3fbf9)] p-10 text-center shadow-[0_18px_45px_rgba(14,42,51,0.05)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[rgba(21,122,110,0.1)] text-3xl font-black text-[var(--brand)]">
                  ✓
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tight text-zinc-900">{copy.labels.emptyTitle}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{copy.labels.noActivities}</p>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[var(--muted)]">
                  {copy.labels.emptyHint}
                </p>
              </div>
            ) : (
              activities.map((activity) => {
              const completedSubtasks = activity.subtasks.filter((subtask) => subtask.done).length;
              const activityProgress = getActivityProgress(activity);
              const typeLabel = copy.types[activity.type];
              const priorityLabel = copy.priorities[activity.priority];
              const statusLabel = copy.statuses[activity.status];
              const escalation = getEscalation(activity, today);

              return (
                <article key={activity.id} className="app-panel-strong rounded-[2rem] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge>{typeLabel}</Badge>
                        <Badge tone={activity.priority}>{priorityLabel}</Badge>
                        <Badge tone={activity.status}>{statusLabel}</Badge>
                        <EscalationBadge label={copy.escalation[escalation]} level={escalation} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-zinc-900">
                          {activity.title || copy.labels.emptyTitle}
                        </h3>
                        <p className="text-sm text-zinc-500">{activity.course}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(activity)}
                        className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                      >
                        {copy.actions.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteActivity(activity.id)}
                        className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        {copy.actions.delete}
                      </button>
                      <button
                        type="button"
                        onClick={() => cycleStatus(activity.id)}
                        className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
                      >
                        {copy.actions.toggleStatus}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <InfoCard
                      label={copy.labels.dueLabel}
                      value={activity.dueDate || copy.labels.reminderNone}
                    />
                    <InfoCard
                      label={copy.labels.reminderAt}
                      value={activity.reminder || copy.labels.reminderNone}
                    />
                    <InfoCard
                      label={copy.labels.progressCompleted}
                      value={`${activityProgress}%`}
                    />
                    <InfoCard
                      label={copy.labels.riskLevel}
                      value={copy.escalation[escalation]}
                    />
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                      {copy.labels.smartRule}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-zinc-800">
                      {buildActivityRule(activity, copy, activityProgress, today)}
                    </p>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm text-zinc-500">
                      <span>{copy.fields.progress}</span>
                      <span>{activityProgress}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-zinc-100">
                      <div
                        className="h-3 rounded-full bg-sky-500 transition-all"
                        style={{ width: `${activityProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-800">
                        {copy.labels.subtasksCompleted}: {completedSubtasks}/{activity.subtasks.length}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleReminder(activity.id)}
                        className="text-sm font-semibold text-sky-700 transition hover:text-sky-900"
                      >
                        {activity.reminder ? copy.actions.clearReminder : copy.actions.addReminder}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {activity.subtasks.map((subtask) => (
                        <button
                          key={subtask.id}
                          type="button"
                          onClick={() => toggleSubtask(activity.id, subtask.id)}
                          className="flex w-full items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-left transition hover:bg-zinc-100"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              subtask.done
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-zinc-300 bg-white'
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${subtask.done ? 'bg-white' : 'bg-transparent'}`} />
                          </span>
                          <span className={subtask.done ? 'text-zinc-400 line-through' : 'text-zinc-700'}>
                            {subtask.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              );
              })
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="app-panel-strong rounded-[1.8rem] p-5">
      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${accent}`}>
        {label}
      </div>
      <p className="mt-4 text-4xl font-black tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function GuideStep({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.2rem] bg-white/75 px-4 py-3 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(21,122,110,0.1)] text-sm font-black text-[var(--brand)]">
        {number}
      </span>
      <span className="text-sm font-black tracking-tight text-zinc-800">{title}</span>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(21,122,110,0.1)] text-xs font-black text-[var(--brand)]">
        {eyebrow}
      </span>
      <h3 className="text-lg font-black tracking-tight text-zinc-900">{title}</h3>
    </div>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-3 py-3 text-sm font-black transition ${
                isSelected
                  ? 'border-[rgba(21,122,110,0.35)] bg-[rgba(21,122,110,0.1)] text-[var(--brand)] shadow-[0_10px_24px_rgba(21,122,110,0.08)]'
                  : 'border-[var(--line)] bg-white/80 text-zinc-600 hover:border-[rgba(21,122,110,0.24)] hover:bg-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityPreview({
  title,
  emptyTitle,
  form,
  copy,
}: {
  title: string;
  emptyTitle: string;
  form: FormState;
  copy: TasksCopy;
}) {
  const previewTitle = form.title.trim() || emptyTitle;
  const subtasks = form.subtasks
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const previewProgress = 0;

  return (
    <div className="rounded-[1.7rem] border border-[rgba(21,122,110,0.18)] bg-[linear-gradient(135deg,#103038,#115e58)] p-5 text-white shadow-[0_18px_44px_rgba(17,94,88,0.16)]">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9fe5da]">{title}</p>
      <div className="mt-4 rounded-[1.4rem] bg-white/10 p-4 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black tracking-tight">{previewTitle}</h3>
            <p className="mt-1 text-sm text-white/70">{form.course || copy.fields.course}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#115e58]">
            {previewProgress}%
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">{copy.types[form.type]}</span>
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">{copy.priorities[form.priority]}</span>
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">{copy.statuses[form.status]}</span>
        </div>

        <div className="mt-5 h-2 rounded-full bg-white/16">
          <div className="h-2 rounded-full bg-[#9fe5da] transition-all" style={{ width: `${previewProgress}%` }} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <InfoPill label={copy.labels.dueLabel} value={form.dueDate || copy.labels.reminderNone} />
          <InfoPill label={copy.labels.reminderAt} value={form.reminder || copy.labels.reminderNone} />
        </div>

        {subtasks.length > 0 ? (
          <div className="mt-4 space-y-2">
            {subtasks.map((subtask) => (
              <div key={subtask} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/84">
                <span className="h-2 w-2 rounded-full bg-[#9fe5da]" />
                {subtask}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/54">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: ActivityPriority | ActivityStatus;
}) {
  const className =
    tone === 'high'
      ? 'bg-rose-100 text-rose-700'
      : tone === 'medium'
        ? 'bg-amber-100 text-amber-700'
        : tone === 'low'
          ? 'bg-emerald-100 text-emerald-700'
          : tone === 'pending'
            ? 'bg-zinc-100 text-zinc-700'
            : tone === 'inProgress'
              ? 'bg-sky-100 text-sky-700'
              : tone === 'completed'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-violet-100 text-violet-700';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-800">{value}</p>
    </div>
  );
}

function getDaysLeft(dueDate: string, today: Date) {
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getActivityProgress(activity: Activity) {
  return calculateProgressFromSubtasks(activity.subtasks, activity.progress);
}

function calculateProgressFromSubtasks(subtasks: Activity['subtasks'], fallbackProgress: number) {
  if (subtasks.length === 0) {
    return fallbackProgress;
  }

  const completedSubtasks = subtasks.filter((subtask) => subtask.done).length;
  return Math.round((completedSubtasks / subtasks.length) * 100);
}

function getEscalation(activity: Activity, today: Date): EscalationLevel {
  const daysLeft = getDaysLeft(activity.dueDate, today);
  const progress = getActivityProgress(activity);

  if (daysLeft <= 1 && activity.status !== 'completed') {
    return 'critical';
  }

  if ((activity.priority === 'high' && progress < 40) || daysLeft <= 3) {
    return 'high';
  }

  if (!activity.reminder || progress < 60) {
    return 'medium';
  }

  return 'low';
}

function escalationScore(level: EscalationLevel) {
  return level === 'critical' ? 4 : level === 'high' ? 3 : level === 'medium' ? 2 : 1;
}

function buildSmartAlert(activity: Activity, copy: TasksCopy, progress: number, today: Date): SmartAlert | null {
  const daysLeft = getDaysLeft(activity.dueDate, today);

  if (daysLeft <= 1) {
    return {
      activityId: activity.id,
      title: activity.title,
      level: 'critical',
      message: copy.smartMessages.criticalDeadline,
      action: copy.smartMessages.criticalAction,
    } satisfies SmartAlert;
  }

  if (activity.priority === 'high' && progress < 40) {
    return {
      activityId: activity.id,
      title: activity.title,
      level: 'high',
      message: copy.smartMessages.highPriorityStalled,
      action: copy.smartMessages.highAction,
    } satisfies SmartAlert;
  }

  if (!activity.reminder) {
    return {
      activityId: activity.id,
      title: activity.title,
      level: 'medium',
      message: copy.smartMessages.reminderMissing,
      action: copy.smartMessages.reminderAction,
    } satisfies SmartAlert;
  }

  if (progress < 60 && daysLeft <= 7) {
    return {
      activityId: activity.id,
      title: activity.title,
      level: 'medium',
      message: copy.smartMessages.lowProgress,
      action: copy.smartMessages.progressAction,
    } satisfies SmartAlert;
  }

  return null;
}

function isSmartAlert(alert: SmartAlert | null): alert is SmartAlert {
  return alert !== null;
}

function buildActivityRule(activity: Activity, copy: TasksCopy, progress: number, today: Date) {
  const daysLeft = getDaysLeft(activity.dueDate, today);

  if (daysLeft <= 1) {
    return copy.smartMessages.criticalDeadline;
  }

  if (activity.priority === 'high' && progress < 40) {
    return copy.smartMessages.highPriorityStalled;
  }

  if (!activity.reminder) {
    return copy.smartMessages.reminderMissing;
  }

  if (progress < 60) {
    return copy.smartMessages.lowProgress;
  }

  return copy.smartMessages.onTrack;
}

function EscalationBadge({ label, level }: { label: string; level: EscalationLevel }) {
  const className =
    level === 'critical'
      ? 'bg-rose-600 text-white'
      : level === 'high'
        ? 'bg-orange-100 text-orange-700'
        : level === 'medium'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}
