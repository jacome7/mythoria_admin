export function hasTrustedAdminOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return true;

  // The Node request URL can use an internal origin behind Cloud Run.
  const configuredUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  return origin === new URL(configuredUrl || request.url).origin;
}
