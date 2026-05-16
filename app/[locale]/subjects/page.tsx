'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';

import { useAuthSession } from '@/lib/auth/client';
import { getScopedStorageKey } from '@/lib/user-storage';

type Evaluation = {
  id: string;
  name: string;
  weight: number;
  grade: number | '';
};

type Subject = {
  id: string;
  name: string;
  credits: number;
  goalGrade: number;
  evaluations: Evaluation[];
};

type Profile = {
  name: string;
  semester: string;
  globalGoal: string;
};

const EMPTY_SUBJECT: Subject = {
  id: '',
  name: '',
  credits: 3,
  goalGrade: 4.0,
  evaluations: [
    {
      id: 'new-eval-1',
      name: '',
      weight: 100,
      grade: '',
    },
  ],
};

const SUBJECTS_STORAGE_KEY = 'clearup_subjects';
const PROFILE_STORAGE_KEY = 'clearup_profile';

function loadSubjects(userId?: string) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storageKey = userId ? getScopedStorageKey(SUBJECTS_STORAGE_KEY, userId) : SUBJECTS_STORAGE_KEY;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Subject[]) : [];
  } catch {
    return [];
  }
}

function emptyProfile(): Profile {
  return {
    name: '',
    semester: '',
    globalGoal: '',
  };
}

function loadProfile(userId?: string) {
  if (typeof window === 'undefined') {
    return emptyProfile();
  }

  try {
    const storageKey = userId ? getScopedStorageKey(PROFILE_STORAGE_KEY, userId) : PROFILE_STORAGE_KEY;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return emptyProfile();
    }

    return JSON.parse(stored) as Profile;
  } catch {
    return emptyProfile();
  }
}

export default function SubjectsPage() {
  const t = useTranslations('Subjects');
  const tNav = useTranslations('Navigation');
  const session = useAuthSession();
  const userId = session?.id;

  const [subjects, setSubjects] = useState<Subject[]>(() => loadSubjects(userId));
  const [profile, setProfile] = useState<Profile>(() => loadProfile(userId));
  const [editing, setEditing] = useState<Subject>(EMPTY_SUBJECT);
  const formSectionRef = useRef<HTMLElement | null>(null);

  const totalCredits = useMemo(
    () => subjects.reduce((sum, subject) => sum + (Number.isFinite(subject.credits) ? subject.credits : 0), 0),
    [subjects]
  );

  const projectedAverage = useMemo(() => {
    const weightedCredits = subjects.reduce((sum, subject) => sum + subject.credits, 0);

    if (weightedCredits === 0) {
      return 0;
    }

    const weightedProjected = subjects.reduce(
      (sum, subject) => sum + calculateProjectedGrade(subject) * subject.credits,
      0
    );

    return weightedProjected / weightedCredits;
  }, [subjects]);

  function persistSubjects(nextSubjects: Subject[]) {
    setSubjects(nextSubjects);
    if (typeof window !== 'undefined') {
      const storageKey = userId ? getScopedStorageKey(SUBJECTS_STORAGE_KEY, userId) : SUBJECTS_STORAGE_KEY;
      window.localStorage.setItem(storageKey, JSON.stringify(nextSubjects));
    }
  }

  function persistProfile(nextProfile: Profile) {
    setProfile(nextProfile);
    if (typeof window !== 'undefined') {
      const storageKey = userId ? getScopedStorageKey(PROFILE_STORAGE_KEY, userId) : PROFILE_STORAGE_KEY;
      window.localStorage.setItem(storageKey, JSON.stringify(nextProfile));
    }
  }

  function handleEdit(subject?: Subject) {
    if (subject) {
      setEditing({
        ...subject,
        evaluations: subject.evaluations.length > 0 ? subject.evaluations : EMPTY_SUBJECT.evaluations,
      });
      return;
    }

    setEditing({
      ...EMPTY_SUBJECT,
      id: crypto.randomUUID(),
      evaluations: [
        {
          id: crypto.randomUUID(),
          name: '',
          weight: 100,
          grade: '',
        },
      ],
    });
  }

  function handleSave() {
    if (!editing.name.trim()) {
      return;
    }

    const normalizedEvaluations = editing.evaluations
      .map((evaluation) => ({
        ...evaluation,
        name: evaluation.name.trim(),
        weight: Number(evaluation.weight) || 0,
      }))
      .filter((evaluation) => evaluation.name && evaluation.weight > 0);

    const subjectToSave: Subject = {
      ...editing,
      evaluations:
        normalizedEvaluations.length > 0
          ? normalizedEvaluations
          : [
              {
                id: crypto.randomUUID(),
                name: t('defaults.finalExam'),
                weight: 100,
                grade: '',
              },
            ],
    };

    const exists = subjects.find((subject) => subject.id === subjectToSave.id);
    persistSubjects(
      exists
        ? subjects.map((subject) => (subject.id === subjectToSave.id ? subjectToSave : subject))
        : [...subjects, subjectToSave]
    );
    setEditing(EMPTY_SUBJECT);
  }

  function handleDelete(id: string) {
    persistSubjects(subjects.filter((subject) => subject.id !== id));
    if (editing.id === id) {
      setEditing(EMPTY_SUBJECT);
    }
  }

  function updateEvaluation(
    evaluationId: string,
    field: 'name' | 'weight' | 'grade',
    value: string
  ) {
    setEditing((current) => ({
      ...current,
      evaluations: current.evaluations.map((evaluation) =>
        evaluation.id === evaluationId
          ? {
              ...evaluation,
              [field]:
                field === 'name' ? value : value === '' ? '' : Number(value),
            }
          : evaluation
      ),
    }));
  }

  function addEvaluation() {
    setEditing((current) => ({
      ...current,
      evaluations: [
        ...current.evaluations,
        {
          id: crypto.randomUUID(),
          name: '',
          weight: 0,
          grade: '',
        },
      ],
    }));
  }

  function removeEvaluation(evaluationId: string) {
    setEditing((current) => ({
      ...current,
      evaluations:
        current.evaluations.length === 1
          ? current.evaluations
          : current.evaluations.filter((evaluation) => evaluation.id !== evaluationId),
    }));
  }

  function openSubjectForm(subject?: Subject) {
    handleEdit(subject);
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="space-y-8 pb-36 md:space-y-10 md:pb-10">
      <header className="app-hero rounded-[1.75rem] px-5 py-6 sm:rounded-[2rem] sm:px-7 sm:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="app-kicker text-xs font-bold uppercase">Academic Planning</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl md:text-5xl">{tNav('subjects')}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">{t('intro')}</p>
          </div>
          <div className="w-full rounded-[1.6rem] border border-white/60 bg-white/85 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)] dark:border-zinc-700 dark:bg-zinc-950/60 sm:p-5 md:max-w-md">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              {t('profileCard.title')}
            </p>
            <p className="truncate text-lg font-bold text-zinc-950">{profile.name || t('profileCard.defaultName')}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {t('profileCard.semester')} <span className="font-semibold">{profile.semester || t('profileCard.undefined')}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t('profileCard.goal')} <span className="font-semibold">{profile.globalGoal || t('profileCard.noGoal')}</span>
            </p>
            <div className="mt-4 rounded-2xl bg-[rgba(21,122,110,0.08)] px-4 py-3 text-xs font-medium text-[var(--brand)] dark:bg-[rgba(84,194,179,0.12)]">
              Mantén aquí tus cursos, evaluaciones y meta del semestre en un solo lugar.
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <MetricCard label={t('summary.subjects')} value={String(subjects.length)} detail={t('summary.subjectsDetail')} />
        <MetricCard label={t('summary.credits')} value={String(totalCredits)} detail={t('summary.creditsDetail')} />
        <MetricCard label={t('summary.projectedAverage')} value={projectedAverage > 0 ? projectedAverage.toFixed(2) : '0.00'} detail={t('summary.projectedAverageDetail')} />
      </section>

      <section className="app-panel-strong rounded-[1.75rem] p-5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Vista guiada</p>
            <h2 className="mt-2 text-xl font-black text-zinc-950 dark:text-zinc-100 sm:text-2xl">
              Organiza tus materias de forma simple
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Primero actualiza tu perfil académico, luego crea cada materia con sus créditos y finalmente agrega evaluaciones con peso y nota para ver tu panorama completo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openSubjectForm()}
            className="w-full rounded-full bg-[linear-gradient(135deg,#157a6e,#115e58)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(21,122,110,0.24)] transition hover:brightness-105 md:w-auto"
          >
            {t('actions.newSubject')}
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <span className="h-6 w-2 rounded-full bg-[var(--brand)]" />
              {t('listTitle')}
            </h2>
            <span className="text-xs text-zinc-500">
              {subjects.length} {t('summary.subjectsLabel')} · {totalCredits} {t('summary.creditsLabel')}
            </span>
          </div>

          {subjects.length === 0 ? (
            <div className="app-panel-strong rounded-[2rem] border border-dashed border-zinc-300 p-8 text-center">
              <h3 className="text-xl font-bold text-zinc-900">{t('empty.title')}</h3>
              <p className="mt-2 text-sm text-zinc-500">{t('empty.body')}</p>
              <button
                type="button"
                onClick={() => openSubjectForm()}
                className="mt-5 rounded-full bg-[linear-gradient(135deg,#157a6e,#115e58)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                {t('actions.newSubject')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {subjects.map((subject) => {
                const projected = calculateProjectedGrade(subject);
                const needed = calculateNeededGrade(subject);
                const completedWeight = getCompletedWeight(subject);
                const remainingWeight = Math.max(100 - completedWeight, 0);

                return (
                  <article key={subject.id} className="app-panel-strong rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900">{subject.name}</h3>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">
                          {subject.credits} {t('summary.creditsLabel')} · {t('simulatorMeta.goal')} {subject.goalGrade.toFixed(1)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openSubjectForm(subject)}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)] dark:border-zinc-700 dark:text-zinc-200"
                        >
                          {t('actions.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(subject.id)}
                          className="rounded-full border border-red-100 px-3 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
                        >
                          {t('actions.delete')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[rgba(21,122,110,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)] dark:bg-[rgba(84,194,179,0.12)]">
                        {subject.evaluations.length} evaluaciones
                      </span>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-200">
                        {completedWeight.toFixed(0)}% completado
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      <MiniCard label={t('simulatorMeta.current')} value={calculateCurrentGrade(subject).toFixed(2)} />
                      <MiniCard label={t('simulatorMeta.projected')} value={projected.toFixed(2)} />
                      <MiniCard
                        label={t('simulatorMeta.needed')}
                        value={needed === null ? t('simulatorMeta.completed') : needed > 5 ? t('simulatorMeta.unreachable') : needed.toFixed(2)}
                      />
                    </div>

                    <div className="mt-5 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/70">
                      <div className="mb-2 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-300">
                        <span>{t('simulatorMeta.weightCompleted')}</span>
                        <span>{completedWeight.toFixed(0)}% / 100%</span>
                      </div>
                      <div className="h-3 rounded-full bg-white dark:bg-zinc-800">
                        <div
                          className="h-3 rounded-full bg-[linear-gradient(135deg,#157a6e,#115e58)]"
                          style={{ width: `${Math.min(completedWeight, 100)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-300">
                        {t('simulatorMeta.remaining')} {remainingWeight.toFixed(0)}%
                      </p>
                    </div>

                    <div className="mt-5 space-y-2">
                      {subject.evaluations.map((evaluation) => (
                        <div key={evaluation.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-900/70">
                          <span className="font-medium text-zinc-700 dark:text-zinc-100">{evaluation.name}</span>
                          <span className="text-zinc-500 dark:text-zinc-300">
                            {evaluation.weight}% · {evaluation.grade === '' ? t('simulatorMeta.pendingGrade') : Number(evaluation.grade).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="app-panel-strong rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <span className="h-6 w-2 rounded-full bg-emerald-500" />
              {t('profileSection')}
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-300">
              Completa estos datos para tener un contexto académico más claro dentro de tus materias.
            </p>

            <div className="mt-4 grid gap-3">
              <input
                type="text"
                placeholder={t('profilePlaceholders.name')}
                value={profile.name}
                onChange={(event) => persistProfile({ ...profile, name: event.target.value })}
                className="app-input text-sm"
              />
              <input
                type="text"
                placeholder={t('profilePlaceholders.semester')}
                value={profile.semester}
                onChange={(event) => persistProfile({ ...profile, semester: event.target.value })}
                className="app-input text-sm"
              />
              <textarea
                placeholder={t('profilePlaceholders.goal')}
                value={profile.globalGoal}
                onChange={(event) => persistProfile({ ...profile, globalGoal: event.target.value })}
                className="app-input min-h-[110px] resize-none text-sm"
              />
            </div>
          </section>

          <section ref={formSectionRef} className="app-panel-strong rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{editing.id ? t('form.editTitle') : t('form.createTitle')}</h2>
                <p className="mt-1 text-sm leading-7 text-zinc-500 dark:text-zinc-300">{t('form.description')}</p>
              </div>
              <button
                type="button"
                onClick={() => openSubjectForm()}
                className="rounded-full bg-[linear-gradient(135deg,#157a6e,#115e58)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-105"
              >
                {t('actions.newSubject')}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <input
                type="text"
                placeholder={t('form.subjectName')}
                value={editing.name}
                onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))}
                className="app-input text-sm"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={editing.credits}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, credits: Number(event.target.value) || 0 }))
                  }
                  className="app-input text-sm"
                  placeholder={t('form.credits')}
                />
                <input
                  type="number"
                  min={0}
                  max={5}
                  step="0.1"
                  value={editing.goalGrade}
                  onChange={(event) =>
                    setEditing((current) => ({ ...current, goalGrade: Number(event.target.value) || 0 }))
                  }
                  className="app-input text-sm"
                  placeholder={t('form.goalGrade')}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-300">{t('simulator')}</h3>
                <button
                  type="button"
                  onClick={addEvaluation}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)] dark:border-zinc-700 dark:text-zinc-200"
                >
                  {t('actions.addEvaluation')}
                </button>
              </div>

              {editing.evaluations.map((evaluation) => (
                <div key={evaluation.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <div className="space-y-3">
                    <label className="block space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-300">
                        {t('form.evaluationName')}
                      </span>
                      <input
                        type="text"
                        placeholder="Ej. Parcial 1"
                        value={evaluation.name}
                        onChange={(event) => updateEvaluation(evaluation.id, 'name', event.target.value)}
                        className="app-input text-sm"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <label className="block space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-300">
                          {t('form.weight')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={evaluation.weight}
                          onChange={(event) => updateEvaluation(evaluation.id, 'weight', event.target.value)}
                          className="app-input text-sm"
                          placeholder={t('form.weight')}
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-300">
                          {t('form.grade')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step="0.1"
                          value={evaluation.grade}
                          onChange={(event) => updateEvaluation(evaluation.id, 'grade', event.target.value)}
                          className="app-input text-sm"
                          placeholder={t('form.grade')}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeEvaluation(evaluation.id)}
                        className="rounded-lg border border-red-100 px-4 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
                      >
                        {t('actions.remove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {editing.id && (
                <button
                  type="button"
                  onClick={() => setEditing(EMPTY_SUBJECT)}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-xs text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {t('actions.cancel')}
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!editing.name.trim()}
                className="rounded-full bg-[linear-gradient(135deg,#157a6e,#115e58)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-40"
              >
                {editing.id && subjects.find((subject) => subject.id === editing.id)
                  ? t('actions.saveChanges')
                  : t('actions.saveSubject')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function calculateCurrentGrade(subject: Subject) {
  return subject.evaluations.reduce((total, evaluation) => {
    if (evaluation.grade === '') {
      return total;
    }

    return total + (Number(evaluation.grade) * evaluation.weight) / 100;
  }, 0);
}

function getCompletedWeight(subject: Subject) {
  return subject.evaluations.reduce((total, evaluation) => {
    if (evaluation.grade === '') {
      return total;
    }

    return total + evaluation.weight;
  }, 0);
}

function calculateProjectedGrade(subject: Subject) {
  const completedContribution = calculateCurrentGrade(subject);
  const missingEvaluations = subject.evaluations.filter((evaluation) => evaluation.grade === '');
  const remainingWeight = missingEvaluations.reduce((total, evaluation) => total + evaluation.weight, 0);

  if (remainingWeight === 0) {
    return completedContribution;
  }

  const projectedMissing = missingEvaluations.reduce((total, evaluation) => total + (subject.goalGrade * evaluation.weight) / 100, 0);
  return completedContribution + projectedMissing;
}

function calculateNeededGrade(subject: Subject) {
  const completedContribution = calculateCurrentGrade(subject);
  const remainingWeight = subject.evaluations
    .filter((evaluation) => evaluation.grade === '')
    .reduce((total, evaluation) => total + evaluation.weight, 0);

  if (remainingWeight === 0) {
    return null;
  }

  return ((subject.goalGrade - completedContribution) * 100) / remainingWeight;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="app-panel-strong rounded-[1.8rem] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-300">{label}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-300">{detail}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/70">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-300">{label}</p>
      <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
