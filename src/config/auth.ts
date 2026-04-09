const normalizeDomain = (domain: string) => domain.trim().toLowerCase().replace(/^@+/, '');

export const ALLOWED_DOMAINS = ['@mythoria.pt', '@caravanconcierge.com'];
export const ALLOWED_EMAIL_SUFFIXES = ALLOWED_DOMAINS.map(normalizeDomain);

export const isAllowedEmailDomain = (email?: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return ALLOWED_EMAIL_SUFFIXES.some((domain) => normalizedEmail.endsWith(`@${domain}`));
};

export const getHostedDomain = () => ALLOWED_EMAIL_SUFFIXES[0] ?? undefined;