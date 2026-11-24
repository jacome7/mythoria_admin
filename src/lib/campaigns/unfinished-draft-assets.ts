import type { CampaignAssetInput } from '@/lib/schemas/campaigns';

const copy: Record<
  string,
  { subject: string; headline: string; body: string; cta: string; unsubscribe: string }
> = {
  'en-US': {
    subject: 'Your story draft is still here',
    headline: 'Pick up where your story left off',
    body: 'You have an unfinished story waiting in your library. When you feel like it, you can return and keep shaping it.',
    cta: 'Return to my stories',
    unsubscribe: 'Unsubscribe',
  },
  'pt-PT': {
    subject: 'O teu rascunho continua à tua espera',
    headline: 'Continua a história quando te apetecer',
    body: 'Tens uma história por acabar na tua biblioteca. Quando quiseres, podes voltar e continuar a dar-lhe forma.',
    cta: 'Voltar às minhas histórias',
    unsubscribe: 'Cancelar subscrição',
  },
  'es-ES': {
    subject: 'Tu borrador sigue aquí',
    headline: 'Retoma tu historia cuando quieras',
    body: 'Tienes una historia sin terminar en tu biblioteca. Cuando te apetezca, puedes volver y seguir dándole forma.',
    cta: 'Volver a mis historias',
    unsubscribe: 'Cancelar suscripción',
  },
  'fr-FR': {
    subject: 'Votre brouillon vous attend',
    headline: 'Reprenez votre histoire quand vous le souhaitez',
    body: 'Une histoire inachevée vous attend dans votre bibliothèque. Vous pourrez la reprendre quand vous en aurez envie.',
    cta: 'Retrouver mes histoires',
    unsubscribe: 'Se désabonner',
  },
  'de-DE': {
    subject: 'Dein Entwurf ist noch da',
    headline: 'Setz deine Geschichte fort, wenn du magst',
    body: 'In deiner Bibliothek wartet eine unvollendete Geschichte. Wenn es dir passt, kannst du sie weitergestalten.',
    cta: 'Zu meinen Geschichten',
    unsubscribe: 'Abmelden',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildUnfinishedDraftReminderAssets(): CampaignAssetInput[] {
  return Object.entries(copy).map(([language, content]) => ({
    language,
    subject: content.subject,
    htmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#25332d"><p>{{firstName}},</p><h1 style="font-size:24px">${escapeHtml(content.headline)}</h1><p>${escapeHtml(content.body)}</p><p><a href="{{unfinishedStoryLink}}" style="display:inline-block;padding:12px 18px;background:#285e4b;color:#fff;text-decoration:none;border-radius:6px">${escapeHtml(content.cta)}</a></p><p style="font-size:12px;color:#66736d"><a href="{{unsubscribeLink}}">${escapeHtml(content.unsubscribe)}</a></p><p style="font-size:12px;color:#66736d">{{physicalAddress}}</p></div>`,
    textBody: `{{firstName}},\n\n${content.headline}\n\n${content.body}\n\n${content.cta}: {{unfinishedStoryLink}}\n\n${content.unsubscribe}: {{unsubscribeLink}}\n{{physicalAddress}}`,
  }));
}
