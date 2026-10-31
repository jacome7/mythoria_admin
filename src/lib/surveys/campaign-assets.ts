/**
 * Default survey campaign email assets (PRD §7.1) in the five supported locales.
 *
 * These assets are copied into `marketing_campaign_assets` when Admin creates the survey
 * campaigns; Marketing can edit them afterwards. They are rendered by notification-engine with
 * Handlebars, so all dynamic values are template variables:
 *
 * `surveyLink`, `surveyDeadline`, `surveyMinutes`, `rewardDeadline`, `privacyLink`,
 * `unsubscribeLink`, `physicalAddress` and (optional) `firstName`.
 *
 * Every email (invite and reminder, per cohort) highlights the thank-you gift in a card above
 * the call-to-action. The gift wording is cohort-specific: C1 (no story yet) can only claim it
 * after publishing a first story, so that condition is stated up front.
 *
 * Plain-text bodies use triple-stash (`{{{var}}}`) so URLs and localized dates are never
 * HTML-escaped; the HTML body uses regular escaping.
 */

export type SurveyCampaignKind = 'invite' | 'reminder';
export type SurveyCohortKey = 'C1' | 'C2' | 'C3';
export const SURVEY_ASSET_LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;
export type SurveyAssetLocale = (typeof SURVEY_ASSET_LOCALES)[number];

export interface SurveyCampaignAsset {
  subject: string;
  htmlBody: string;
  textBody: string;
}

/** Copy for one email. `**bold**` markers are rendered as highlighted text in HTML and stripped in text. */
interface EmailCopy {
  subject: string;
  preheader: string;
  /** Paragraphs shown before the gift card and the call-to-action button. */
  before: string[];
  cta: string;
  /** Paragraphs shown after the call-to-action button. */
  after: string[];
}

interface LocaleCopy {
  /** Greeting word ("Hi", "Olá", ...). */
  hello: string;
  invite: Record<SurveyCohortKey, EmailCopy>;
  /** Reminder text shared by all cohorts; the gift card below it is cohort-specific. */
  reminder: EmailCopy;
  gift: {
    title: string;
    /** Cohort-specific gift card body; `**bold**` markers become <strong>. */
    body: Record<SurveyCohortKey, string>;
  };
  /** Sentence stating the actual survey deadline; contains `{{surveyDeadline}}`. */
  deadlineNote: string;
  signoff: string;
  footer: {
    why: string;
    contact: string;
    privacy: string;
    unsubscribe: string;
    rewardTitle: string;
    rewardTerms: string;
    /** Contains `{{rewardDeadline}}`; only rendered when a reward deadline is set. */
    rewardDeadline: string;
  };
}

const SUPPORT_EMAIL = 'support@mythoria.pt';
const LOGO_URL =
  'https://storage.googleapis.com/mythoria-generated-stories/logo/Logo_transparent_background_1024x683.png';
const SITE_URL = 'https://mythoria.pt';

const COPY: Record<SurveyAssetLocale, LocaleCopy> = {
  'en-US': {
    hello: 'Hi',
    invite: {
      C1: {
        subject: 'Every story needs a first page (and a gift)',
        preheader: 'Tell us what got in the way. Your first story earns a free PDF or audiobook.',
        before: [
          'You opened the book, but the first page is still blank. No judgment: every great story has a slow start.',
          "We'd love to know what got in the way, so starting is easier for you (and everyone after you). It takes about {{surveyMinutes}} minutes.",
        ],
        cta: 'Tell us what happened',
        after: ['Honest answers help us most: the good, the bad and the "meh".'],
      },
      C2: {
        subject: 'How did your story end? Tell us, pick a gift',
        preheader:
          'A few quick questions about your first story, and a free PDF or audiobook as thanks.',
        before: [
          "You've written your first Mythoria story. Chapter one: done.",
          "Now we're curious how it went: what you loved, what fell flat, and what would bring you back for a sequel. It takes about {{surveyMinutes}} minutes.",
        ],
        cta: 'Share how it went',
        after: ['Honest answers help us most: the good, the bad and the "meh".'],
      },
      C3: {
        subject: "Help write Mythoria's next chapter, gift inside",
        preheader: 'Help shape what comes next, and pick a free PDF or audiobook as thanks.',
        before: [
          "You've created stories with Mythoria and backed us along the way. Thank you, truly.",
          "Now we'd love your help writing our next chapter: what made Mythoria worth it for you, and what we should make better. It takes about {{surveyMinutes}} minutes.",
        ],
        cta: 'Help write the next chapter',
        after: [
          'Your answers go straight to the people building Mythoria. Good, bad or "meh", we want to hear it.',
        ],
      },
    },
    reminder: {
      subject: 'Final chapter: your gift closes soon',
      preheader: 'Your free PDF or audiobook is one short survey away.',
      before: [
        'Plot twist: our survey is still open, but not for long.',
        "Already started? Your answers are saved, so you can pick up right where you left off. Haven't started yet? It takes about {{surveyMinutes}} minutes.",
      ],
      cta: 'Open my survey',
      after: ['Honest answers help us most: the good, the bad and the "meh".'],
    },
    gift: {
      title: 'Your thank-you gift',
      body: {
        C1: 'Finish the survey and, once you publish your first story, pick a free **print-ready PDF** or **narrated audiobook** of it. On us, no credits needed.',
        C2: 'Finish the survey and pick a free **print-ready PDF** or **narrated audiobook** of your story. On us, no credits needed.',
        C3: 'Finish the survey and pick a free **print-ready PDF** or **narrated audiobook** of one of your published stories. On us, no credits needed.',
      },
    },
    deadlineNote: 'The survey is open until {{surveyDeadline}}.',
    signoff: 'The Mythoria Team',
    footer: {
      why: "You're receiving this email because you have a Mythoria account.",
      contact: 'Questions? Write to',
      privacy: 'Privacy policy',
      unsubscribe: 'Unsubscribe or change email preferences',
      rewardTitle: 'About the gift',
      rewardTerms:
        "One gift per person. After you complete the survey, you can choose one free print-ready PDF or one audiobook of an eligible published story in your Mythoria account. The gift doesn't depend on what you answer.",
      rewardDeadline: 'Please claim it by {{rewardDeadline}}.',
    },
  },

  'pt-PT': {
    hello: 'Olá',
    invite: {
      C1: {
        subject: 'Cada história precisa de uma primeira página (e de uma oferta)',
        preheader:
          'Conte-nos o que se atravessou no caminho. A sua primeira história ganha um PDF ou audiolivro grátis.',
        before: [
          'Abriu o livro, mas a primeira página continua em branco. Sem problema: muitas grandes histórias têm um início lento.',
          'Gostávamos de saber o que se atravessou no caminho, para tornar o começo mais fácil para si (e para todos os que vierem depois). Demora cerca de {{surveyMinutes}} minutos.',
        ],
        cta: 'Contar o que aconteceu',
        after: ['Respostas sinceras são as que mais nos ajudam: o bom, o mau e o "assim-assim".'],
      },
      C2: {
        subject: 'Como acabou a sua história? Conte-nos e escolha uma oferta',
        preheader:
          'Umas perguntas rápidas sobre a sua primeira história e um PDF ou audiolivro grátis como agradecimento.',
        before: [
          'Já escreveu a sua primeira história na Mythoria. Capítulo um: concluído.',
          'Agora estamos curiosos para saber como correu: o que adorou, o que ficou aquém e o que lhe daria vontade de voltar para uma sequela. Demora cerca de {{surveyMinutes}} minutos.',
        ],
        cta: 'Contar como correu',
        after: ['Respostas sinceras são as que mais nos ajudam: o bom, o mau e o "assim-assim".'],
      },
      C3: {
        subject: 'Ajude a escrever o próximo capítulo da Mythoria (com oferta)',
        preheader:
          'Ajude a moldar o que vem a seguir e escolha um PDF ou audiolivro grátis como agradecimento.',
        before: [
          'Criou histórias com a Mythoria e apoiou-nos pelo caminho. Obrigado, a sério.',
          'Agora gostávamos da sua ajuda para escrever o nosso próximo capítulo: o que fez a Mythoria valer a pena para si e o que devemos melhorar. Demora cerca de {{surveyMinutes}} minutos.',
        ],
        cta: 'Escrever o próximo capítulo',
        after: [
          'As suas respostas chegam diretamente a quem constrói a Mythoria. Bom, mau ou "assim-assim", queremos ouvir.',
        ],
      },
    },
    reminder: {
      subject: 'Último capítulo: a sua oferta termina em breve',
      preheader: 'O seu PDF ou audiolivro grátis está à distância de um inquérito curto.',
      before: [
        'Reviravolta na história: o nosso inquérito ainda está aberto, mas não por muito tempo.',
        'Já começou? As suas respostas ficaram guardadas, por isso pode continuar exatamente onde parou. Ainda não começou? Demora cerca de {{surveyMinutes}} minutos.',
      ],
      cta: 'Abrir o meu inquérito',
      after: ['Respostas sinceras são as que mais nos ajudam: o bom, o mau e o "assim-assim".'],
    },
    gift: {
      title: 'A sua oferta de agradecimento',
      body: {
        C1: 'Conclua o inquérito e, assim que publicar a sua primeira história, escolha para ela um **PDF pronto a imprimir** ou um **audiolivro narrado**, grátis. Oferta nossa, sem gastar créditos.',
        C2: 'Conclua o inquérito e escolha um **PDF pronto a imprimir** ou um **audiolivro narrado** da sua história, grátis. Oferta nossa, sem gastar créditos.',
        C3: 'Conclua o inquérito e escolha um **PDF pronto a imprimir** ou um **audiolivro narrado** de uma das suas histórias publicadas, grátis. Oferta nossa, sem gastar créditos.',
      },
    },
    deadlineNote: 'O inquérito está aberto até {{surveyDeadline}}.',
    signoff: 'A Equipa Mythoria',
    footer: {
      why: 'Está a receber este email porque tem uma conta na Mythoria.',
      contact: 'Dúvidas? Escreva para',
      privacy: 'Política de privacidade',
      unsubscribe: 'Cancelar subscrição ou alterar preferências de email',
      rewardTitle: 'Sobre a oferta',
      rewardTerms:
        'Uma oferta por pessoa. Depois de concluir o inquérito, pode escolher um PDF pronto a imprimir ou um audiolivro grátis de uma história publicada e elegível da sua conta Mythoria. A oferta não depende das suas respostas.',
      rewardDeadline: 'Reclame-a até {{rewardDeadline}}.',
    },
  },

  'es-ES': {
    hello: 'Hola',
    invite: {
      C1: {
        subject: 'Toda historia necesita una primera página (y un regalo)',
        preheader:
          'Cuéntanos qué se interpuso en el camino. Tu primera historia gana un PDF o audiolibro gratis.',
        before: [
          'Abriste el libro, pero la primera página sigue en blanco. Sin problema: muchas grandes historias empiezan despacio.',
          'Nos encantaría saber qué se interpuso en el camino, para que empezar sea más fácil para ti (y para quien venga después). Te llevará unos {{surveyMinutes}} minutos.',
        ],
        cta: 'Contar qué pasó',
        after: [
          'Las respuestas sinceras son las que más nos ayudan: lo bueno, lo malo y lo "regular".',
        ],
      },
      C2: {
        subject: '¿Cómo terminó tu historia? Cuéntanos y elige un regalo',
        preheader:
          'Unas preguntas rápidas sobre tu primera historia y un PDF o audiolibro gratis como agradecimiento.',
        before: [
          'Ya has escrito tu primera historia en Mythoria. Capítulo uno: hecho.',
          'Ahora tenemos curiosidad por saber cómo fue: qué te encantó, qué se quedó corto y qué te haría volver para una secuela. Te llevará unos {{surveyMinutes}} minutos.',
        ],
        cta: 'Contar cómo fue',
        after: [
          'Las respuestas sinceras son las que más nos ayudan: lo bueno, lo malo y lo "regular".',
        ],
      },
      C3: {
        subject: 'Ayúdanos a escribir el próximo capítulo de Mythoria (con regalo)',
        preheader:
          'Ayúdanos a dar forma a lo que viene y elige un PDF o audiolibro gratis como agradecimiento.',
        before: [
          'Has creado historias con Mythoria y nos has apoyado por el camino. Gracias, de verdad.',
          'Ahora nos encantaría que nos ayudaras a escribir nuestro próximo capítulo: qué hizo que Mythoria mereciera la pena para ti y qué deberíamos mejorar. Te llevará unos {{surveyMinutes}} minutos.',
        ],
        cta: 'Escribir el próximo capítulo',
        after: [
          'Tus respuestas llegan directamente a quienes construyen Mythoria. Bueno, malo o "regular", queremos oírlo.',
        ],
      },
    },
    reminder: {
      subject: 'Último capítulo: tu regalo cierra pronto',
      preheader: 'Tu PDF o audiolibro gratis está a una encuesta corta de distancia.',
      before: [
        'Giro de guion: nuestra encuesta sigue abierta, pero no por mucho tiempo.',
        '¿Ya empezaste? Tus respuestas están guardadas, así que puedes seguir justo donde lo dejaste. ¿Aún no? Te llevará unos {{surveyMinutes}} minutos.',
      ],
      cta: 'Abrir mi encuesta',
      after: [
        'Las respuestas sinceras son las que más nos ayudan: lo bueno, lo malo y lo "regular".',
      ],
    },
    gift: {
      title: 'Tu regalo de agradecimiento',
      body: {
        C1: 'Completa la encuesta y, en cuanto publiques tu primera historia, elige para ella un **PDF listo para imprimir** o un **audiolibro narrado** gratis. Invita la casa, sin gastar créditos.',
        C2: 'Completa la encuesta y elige un **PDF listo para imprimir** o un **audiolibro narrado** gratis de tu historia. Invita la casa, sin gastar créditos.',
        C3: 'Completa la encuesta y elige un **PDF listo para imprimir** o un **audiolibro narrado** gratis de una de tus historias publicadas. Invita la casa, sin gastar créditos.',
      },
    },
    deadlineNote: 'La encuesta está abierta hasta el {{surveyDeadline}}.',
    signoff: 'El equipo de Mythoria',
    footer: {
      why: 'Recibes este correo porque tienes una cuenta en Mythoria.',
      contact: '¿Dudas? Escríbenos a',
      privacy: 'Política de privacidad',
      unsubscribe: 'Darte de baja o cambiar tus preferencias de correo',
      rewardTitle: 'Sobre el regalo',
      rewardTerms:
        'Un regalo por persona. Al completar la encuesta, puedes elegir un PDF listo para imprimir o un audiolibro gratis de una historia publicada de tu cuenta de Mythoria que cumpla los requisitos. El regalo no depende de tus respuestas.',
      rewardDeadline: 'Reclámalo antes del {{rewardDeadline}}.',
    },
  },

  'fr-FR': {
    hello: 'Bonjour',
    invite: {
      C1: {
        subject: 'Toute histoire commence par une première page (et un cadeau)',
        preheader:
          "Dites-nous ce qui s'est mis en travers du chemin. Votre première histoire vous vaut un PDF ou un livre audio offert.",
        before: [
          'Vous avez ouvert le livre, mais la première page est encore blanche. Pas de souci : les plus belles histoires commencent parfois lentement.',
          "Nous aimerions savoir ce qui s'est mis en travers du chemin, pour rendre les débuts plus simples pour vous (et pour tous ceux qui suivront). Cela prend environ {{surveyMinutes}} minutes.",
        ],
        cta: "Raconter ce qui s'est passé",
        after: ['Les réponses sincères nous aident le plus : le bon, le moins bon et le « bof ».'],
      },
      C2: {
        subject: "Comment s'est terminée votre histoire ? Racontez-nous, choisissez un cadeau",
        preheader:
          'Quelques questions rapides sur votre première histoire, et un PDF ou un livre audio offert en remerciement.',
        before: [
          'Vous avez écrit votre première histoire Mythoria. Chapitre un : terminé.',
          "Nous sommes curieux de savoir comment ça s'est passé : ce que vous avez adoré, ce qui est tombé à plat, et ce qui vous donnerait envie de revenir pour une suite. Cela prend environ {{surveyMinutes}} minutes.",
        ],
        cta: 'Partager mon ressenti',
        after: ['Les réponses sincères nous aident le plus : le bon, le moins bon et le « bof ».'],
      },
      C3: {
        subject: 'Aidez-nous à écrire le prochain chapitre de Mythoria (cadeau à la clé)',
        preheader:
          'Aidez-nous à imaginer la suite et choisissez un PDF ou un livre audio offert en remerciement.',
        before: [
          'Vous avez créé des histoires avec Mythoria et nous avez soutenus en chemin. Merci, sincèrement.',
          'Nous aimerions maintenant votre aide pour écrire notre prochain chapitre : ce qui a fait que Mythoria en valait la peine pour vous, et ce que nous devrions améliorer. Cela prend environ {{surveyMinutes}} minutes.',
        ],
        cta: 'Écrire le prochain chapitre',
        after: [
          "Vos réponses arrivent directement à l'équipe qui construit Mythoria. Bon, moins bon ou « bof », nous voulons tout savoir.",
        ],
      },
    },
    reminder: {
      subject: 'Dernier chapitre : votre cadeau, plus pour longtemps',
      preheader: "Votre PDF ou livre audio offert n'est qu'à un court questionnaire.",
      before: [
        'Rebondissement : notre questionnaire est encore ouvert, mais plus pour longtemps.',
        'Déjà commencé ? Vos réponses sont enregistrées : vous pouvez reprendre exactement là où vous en étiez. Pas encore commencé ? Cela prend environ {{surveyMinutes}} minutes.',
      ],
      cta: 'Ouvrir mon questionnaire',
      after: ['Les réponses sincères nous aident le plus : le bon, le moins bon et le « bof ».'],
    },
    gift: {
      title: 'Votre cadeau de remerciement',
      body: {
        C1: "Terminez le questionnaire et, dès que vous aurez publié votre première histoire, choisissez pour elle un **PDF prêt à imprimer** ou un **livre audio narré** offert. C'est cadeau, sans dépenser de crédits.",
        C2: "Terminez le questionnaire et choisissez un **PDF prêt à imprimer** ou un **livre audio narré** offert pour votre histoire. C'est cadeau, sans dépenser de crédits.",
        C3: "Terminez le questionnaire et choisissez un **PDF prêt à imprimer** ou un **livre audio narré** offert pour l'une de vos histoires publiées. C'est cadeau, sans dépenser de crédits.",
      },
    },
    deadlineNote: "Le questionnaire est ouvert jusqu'au {{surveyDeadline}}.",
    signoff: "L'équipe Mythoria",
    footer: {
      why: 'Vous recevez cet e-mail car vous avez un compte Mythoria.',
      contact: 'Une question ? Écrivez à',
      privacy: 'Politique de confidentialité',
      unsubscribe: 'Se désabonner ou modifier ses préférences e-mail',
      rewardTitle: 'À propos du cadeau',
      rewardTerms:
        'Un cadeau par personne. Une fois le questionnaire terminé, vous pouvez choisir un PDF prêt à imprimer ou un livre audio offert pour une histoire publiée et éligible de votre compte Mythoria. Le cadeau ne dépend pas de vos réponses.',
      rewardDeadline: 'À réclamer avant le {{rewardDeadline}}.',
    },
  },

  'de-DE': {
    hello: 'Hallo',
    invite: {
      C1: {
        subject: 'Jede Geschichte braucht eine erste Seite (und ein Geschenk)',
        preheader:
          'Sag uns, was dazwischengekommen ist. Für deine erste Geschichte gibt es ein kostenloses PDF oder Hörbuch.',
        before: [
          'Du hast das Buch aufgeschlagen, aber die erste Seite ist noch leer. Kein Problem: Viele große Geschichten fangen langsam an.',
          'Wir würden gern wissen, was dir dazwischengekommen ist, damit der Start für dich (und alle nach dir) leichter wird. Das dauert etwa {{surveyMinutes}} Minuten.',
        ],
        cta: 'Erzähl uns, was los war',
        after: [
          'Ehrliche Antworten helfen uns am meisten: das Gute, das Schlechte und das „Na ja“.',
        ],
      },
      C2: {
        subject: 'Wie ist deine Geschichte ausgegangen? Erzähl’s uns, wähl ein Geschenk',
        preheader:
          'Ein paar schnelle Fragen zu deiner ersten Geschichte und als Dankeschön ein kostenloses PDF oder Hörbuch.',
        before: [
          'Du hast deine erste Mythoria-Geschichte geschrieben. Kapitel eins: erledigt.',
          'Jetzt sind wir neugierig, wie es war: was du geliebt hast, was nicht gezündet hat und was dich für eine Fortsetzung zurückbringen würde. Das dauert etwa {{surveyMinutes}} Minuten.',
        ],
        cta: 'Erzähl uns, wie es war',
        after: [
          'Ehrliche Antworten helfen uns am meisten: das Gute, das Schlechte und das „Na ja“.',
        ],
      },
      C3: {
        subject: 'Schreib das nächste Mythoria-Kapitel mit (mit Geschenk)',
        preheader:
          'Gestalte mit, was als Nächstes kommt, und wähl als Dankeschön ein kostenloses PDF oder Hörbuch.',
        before: [
          'Du hast Geschichten mit Mythoria erschaffen und uns dabei unterstützt. Danke, wirklich.',
          'Jetzt hätten wir gern deine Hilfe beim nächsten Kapitel: was Mythoria für dich lohnenswert gemacht hat und was wir besser machen sollten. Das dauert etwa {{surveyMinutes}} Minuten.',
        ],
        cta: 'Das nächste Kapitel mitschreiben',
        after: [
          'Deine Antworten landen direkt bei den Leuten, die Mythoria bauen. Gut, schlecht oder „na ja“: Wir wollen es hören.',
        ],
      },
    },
    reminder: {
      subject: 'Letztes Kapitel: Dein Geschenk wartet nicht mehr lange',
      preheader: 'Dein kostenloses PDF oder Hörbuch ist nur eine kurze Umfrage entfernt.',
      before: [
        'Plot-Twist: Unsere Umfrage ist noch offen, aber nicht mehr lange.',
        'Schon angefangen? Deine Antworten sind gespeichert, du machst einfach da weiter, wo du aufgehört hast. Noch nicht angefangen? Das dauert etwa {{surveyMinutes}} Minuten.',
      ],
      cta: 'Zu meiner Umfrage',
      after: ['Ehrliche Antworten helfen uns am meisten: das Gute, das Schlechte und das „Na ja“.'],
    },
    gift: {
      title: 'Dein Dankeschön',
      body: {
        C1: 'Schließ die Umfrage ab und wähl, sobald du deine erste Geschichte veröffentlicht hast, ein kostenloses **druckfertiges PDF** oder **gesprochenes Hörbuch** davon. Geht auf uns, ganz ohne Credits.',
        C2: 'Schließ die Umfrage ab und wähl ein kostenloses **druckfertiges PDF** oder **gesprochenes Hörbuch** deiner Geschichte. Geht auf uns, ganz ohne Credits.',
        C3: 'Schließ die Umfrage ab und wähl ein kostenloses **druckfertiges PDF** oder **gesprochenes Hörbuch** einer deiner veröffentlichten Geschichten. Geht auf uns, ganz ohne Credits.',
      },
    },
    deadlineNote: 'Die Umfrage ist bis zum {{surveyDeadline}} geöffnet.',
    signoff: 'Dein Mythoria-Team',
    footer: {
      why: 'Du erhältst diese E-Mail, weil du ein Mythoria-Konto hast.',
      contact: 'Fragen? Schreib an',
      privacy: 'Datenschutzerklärung',
      unsubscribe: 'Abmelden oder E-Mail-Einstellungen ändern',
      rewardTitle: 'Zum Geschenk',
      rewardTerms:
        'Ein Geschenk pro Person. Nach Abschluss der Umfrage kannst du ein kostenloses druckfertiges PDF oder ein Hörbuch einer berechtigten, veröffentlichten Geschichte aus deinem Mythoria-Konto wählen. Das Geschenk hängt nicht von deinen Antworten ab.',
      rewardDeadline: 'Bitte löse es bis zum {{rewardDeadline}} ein.',
    },
  },
};

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

const FONT_BODY = 'Arial, sans-serif';
const FONT_TITLE = "Georgia, 'Times New Roman', serif";
const COLOR_TEXT = '#233244';
const COLOR_BRAND = '#0e3f63';
const COLOR_MUTED = '#637084';
const COLOR_BORDER = '#d9e1ee';
const COLOR_GIFT_BG = '#fff8e1';
const COLOR_GIFT_BORDER = '#f1d58a';

/** Escape only characters that are significant in HTML; leaves `{{ }}` and quotes untouched. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `**bold**` → highlighted inline text (body paragraphs). */
function toHtmlInline(value: string): string {
  return escapeHtml(value).replace(
    /\*\*(.+?)\*\*/g,
    `<span style='background-color: #fff1bf; color: #143b57; font-weight: 700;'>$1</span>`,
  );
}

/** `**bold**` → plain <strong> (inside the gift card, which already has a tinted background). */
function toHtmlStrong(value: string): string {
  return escapeHtml(value).replace(
    /\*\*(.+?)\*\*/g,
    `<strong style='color: ${COLOR_BRAND};'>$1</strong>`,
  );
}

function toText(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, '$1');
}

/** Converts `{{var}}` to `{{{var}}}` so plain-text output is never HTML-escaped. */
function toRawHandlebars(value: string): string {
  return value.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g, '{{{$1}}}');
}

function greetingTemplate(hello: string): string {
  return `{{#if firstName}}${hello} {{firstName}},{{else}}${hello},{{/if}}`;
}

function paragraphHtml(text: string, marginTop = 14): string {
  return `<p style='margin: ${marginTop}px 0 0 0; font-family: ${FONT_BODY}; font-size: 16px; line-height: 1.7; color: ${COLOR_TEXT};'>${toHtmlInline(text)}</p>`;
}

function renderHtml(
  locale: SurveyAssetLocale,
  copy: LocaleCopy,
  email: EmailCopy,
  giftBody: string,
): string {
  const { footer } = copy;
  const lang = locale.split('-')[0];
  const before = email.before.map((p) => paragraphHtml(p)).join('\n                ');
  const after = [...email.after, copy.deadlineNote]
    .map((p) => paragraphHtml(p))
    .join('\n                ');

  return `<!DOCTYPE html>
<html lang='${lang}' xmlns:v='urn:schemas-microsoft-com:vml' xmlns:o='urn:schemas-microsoft-com:office:office'>
  <head>
    <meta charset='utf-8' />
    <meta name='x-apple-disable-message-reformatting' />
    <meta http-equiv='x-ua-compatible' content='ie=edge' />
    <meta name='viewport' content='width=device-width, initial-scale=1' />
    <meta name='format-detection' content='telephone=no, date=no, address=no, email=no' />
    <title>${escapeHtml(email.subject)}</title>
    <style>
      body, table, td, p, a { margin: 0; padding: 0; }
      table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
      @media only screen and (min-width: 601px) {
        .desktop-pad { padding-left: 40px !important; padding-right: 40px !important; }
      }
    </style>
  </head>
  <body style='width: 100%; background-color: #f3f5f9; word-break: break-word;'>
    <div style='display: none; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px;'>${escapeHtml(email.preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='width: 100%; background-color: #f3f5f9;'>
      <tr>
        <td align='center' style='padding: 20px 12px;'>
          <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${COLOR_BORDER};'>
            <tr>
              <td align='center' class='desktop-pad' style='padding: 28px 16px 8px 16px;'>
                <a href='${SITE_URL}' target='_blank'>
                  <img src='${LOGO_URL}' width='180' alt='Mythoria' style='width: 180px; max-width: 100%;' />
                </a>
              </td>
            </tr>
            <tr>
              <td class='desktop-pad' style='padding: 16px 16px 0 16px;'>
                <h1 style="margin: 0; font-family: ${FONT_TITLE}; font-size: 26px; line-height: 1.25; color: ${COLOR_BRAND}; font-weight: 700;">${greetingTemplate(copy.hello)}</h1>
                ${before}
              </td>
            </tr>
            <tr>
              <td class='desktop-pad' style='padding: 22px 16px 0 16px;'>
                <table role='presentation' width='100%' cellpadding='0' cellspacing='0' data-gift-card='true' style='width: 100%; background-color: ${COLOR_GIFT_BG}; border: 1px solid ${COLOR_GIFT_BORDER}; border-radius: 8px;'>
                  <tr>
                    <td style='padding: 16px 18px;'>
                      <p style="margin: 0; font-family: ${FONT_TITLE}; font-size: 19px; line-height: 1.3; color: ${COLOR_BRAND}; font-weight: 700;">${escapeHtml(copy.gift.title)}</p>
                      <p style='margin: 6px 0 0 0; font-family: ${FONT_BODY}; font-size: 15px; line-height: 1.6; color: ${COLOR_TEXT};'>${toHtmlStrong(giftBody)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class='desktop-pad' align='center' style='padding: 22px 16px 8px 16px;'>
                <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{surveyLink}}" style="height: 48px; v-text-anchor: middle; width: 300px;" arcsize="8%" stroke="f" fillcolor="${COLOR_BRAND}">
                    <w:anchorlock />
                    <center style="font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; color: #ffffff;">${escapeHtml(email.cta)}</center>
                  </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a href='{{surveyLink}}' target='_blank' style='display: inline-block; background-color: ${COLOR_BRAND}; color: #ffffff; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 6px;'>${escapeHtml(email.cta)}</a>
                <!--<![endif]-->
              </td>
            </tr>
            <tr>
              <td class='desktop-pad' style='padding: 8px 16px 0 16px;'>
                ${after}
                <p style='margin: 20px 0 0 0; font-family: ${FONT_BODY}; font-size: 16px; line-height: 1.7; color: ${COLOR_TEXT};'><strong>${escapeHtml(copy.signoff)}</strong></p>
              </td>
            </tr>
            <tr>
              <td class='desktop-pad' style='padding: 24px 16px 28px 16px;'>
                <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='width: 100%; border-top: 1px solid ${COLOR_BORDER};'>
                  <tr>
                    <td style='padding-top: 16px;'>
                      <p style='margin: 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 1.6; color: ${COLOR_MUTED};'><strong>${escapeHtml(footer.rewardTitle)}.</strong> ${escapeHtml(footer.rewardTerms)}{{#if rewardDeadline}} ${escapeHtml(footer.rewardDeadline)}{{/if}}</p>
                      <p style='margin: 12px 0 0 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 1.6; color: ${COLOR_MUTED};'>${escapeHtml(footer.why)} ${escapeHtml(footer.contact)} <a href='mailto:${SUPPORT_EMAIL}' style='color: ${COLOR_BRAND}; text-decoration: underline;'>${SUPPORT_EMAIL}</a>.</p>
                      <p style='margin: 6px 0 0 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 1.6; color: ${COLOR_MUTED};'><a href='{{privacyLink}}' style='color: ${COLOR_BRAND}; text-decoration: underline;'>${escapeHtml(footer.privacy)}</a> &middot; <a href='{{unsubscribeLink}}' style='color: ${COLOR_BRAND}; text-decoration: underline;'>${escapeHtml(footer.unsubscribe)}</a></p>
                      <p style='margin: 6px 0 0 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 1.6; color: ${COLOR_MUTED};'><a href='${SITE_URL}' style='color: ${COLOR_BRAND}; text-decoration: underline;'>Mythoria</a> &middot; {{physicalAddress}}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function renderText(copy: LocaleCopy, email: EmailCopy, giftBody: string): string {
  const { footer } = copy;
  const lines: string[] = [
    greetingTemplate(copy.hello),
    '',
    ...email.before.flatMap((p) => [toRawHandlebars(toText(p)), '']),
    `* ${copy.gift.title} *`,
    toRawHandlebars(toText(giftBody)),
    '',
    `${email.cta}: {{{surveyLink}}}`,
    '',
    ...email.after.flatMap((p) => [toRawHandlebars(toText(p)), '']),
    toRawHandlebars(copy.deadlineNote),
    '',
    copy.signoff,
    '',
    '--',
    `${footer.rewardTitle}. ${footer.rewardTerms}{{#if rewardDeadline}} ${toRawHandlebars(footer.rewardDeadline)}{{/if}}`,
    '',
    `${footer.why} ${footer.contact} ${SUPPORT_EMAIL}.`,
    `${footer.privacy}: {{{privacyLink}}}`,
    `${footer.unsubscribe}: {{{unsubscribeLink}}}`,
    `Mythoria - {{{physicalAddress}}}`,
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Returns the default subject / HTML / plain-text assets for a survey campaign email.
 * Invites have cohort-specific copy; reminders share their text across cohorts but carry the
 * cohort-specific gift card (C1 can only claim the gift after publishing a first story).
 */
export function getSurveyCampaignAsset(
  kind: SurveyCampaignKind,
  cohort: SurveyCohortKey,
  locale: SurveyAssetLocale,
): SurveyCampaignAsset {
  const copy = COPY[locale];
  if (!copy) {
    throw new Error(`Unsupported survey asset locale: ${String(locale)}`);
  }
  let email: EmailCopy | undefined;
  if (kind === 'reminder') {
    email = copy.reminder;
  } else if (kind === 'invite') {
    email = copy.invite[cohort];
  }
  const giftBody = copy.gift.body[cohort];
  if (!email || !giftBody) {
    throw new Error(`Unsupported survey asset: ${String(kind)} / ${String(cohort)}`);
  }

  return {
    subject: email.subject,
    htmlBody: renderHtml(locale, copy, email, giftBody),
    textBody: renderText(copy, email, giftBody),
  };
}
