import { getTranslations } from 'next-intl/server';

import { ProfileSettings } from './profile-settings';
import type { AppIconName } from '../app-icon';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Profile' });
  const tNav = await getTranslations({ locale, namespace: 'Navigation' });

  const quickLinks: { name: string; href: string; icon: AppIconName }[] = [
    { name: 'Recordatorios', href: 'reminders', icon: 'reminders' },
    { name: 'Inbox', href: 'inbox', icon: 'inbox' },
    { name: 'Asistente IA', href: 'ai-assistant', icon: 'ai-assistant' },
  ];

  return (
    <ProfileSettings
      locale={locale}
      copy={{
        badge: t('badge'),
        title: t('title'),
        subtitle: t('subtitle'),
        accountTitle: t('accountTitle'),
        accountBody: t('accountBody'),
        accountSince: t('accountSince'),
        formTitle: t('formTitle'),
        formBody: t('formBody'),
        nameLabel: t('fields.name'),
        emailLabel: t('fields.email'),
        passwordLabel: t('fields.password'),
        passwordHelp: t('passwordHelp'),
        save: t('actions.save'),
        saving: t('actions.saving'),
        success: t('success'),
        signOut: tNav('signOut'),
        switchLanguage: locale === 'es' ? 'Switch to English' : 'Cambiar a español',
        toolsTitle: tNav('tools'),
        quickLinks,
        placeholders: {
          name: t('placeholders.name'),
          email: t('placeholders.email'),
          password: t('placeholders.password'),
        },
      }}
    />
  );
}
