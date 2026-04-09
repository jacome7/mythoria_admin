import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getHostedDomain, isAllowedEmailDomain } from '@/config/auth';

const GOOGLE_HOSTED_DOMAIN = getHostedDomain();

function maskEmail(email?: string | null): string {
  if (!email) return 'unknown';
  const [localPart = '', domain = ''] = email.split('@');
  const visibleLocal = localPart.slice(0, 2);
  const maskedLocal = `${visibleLocal}${'*'.repeat(Math.max(localPart.length - visibleLocal.length, 0))}`;
  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use JWT strategy instead of database for now to avoid initialization issues
  session: {
    strategy: 'jwt',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
          ...(GOOGLE_HOSTED_DOMAIN ? { hd: GOOGLE_HOSTED_DOMAIN } : {}),
        },
      },
    }),
  ],
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async signIn({ account, profile }) {
      // Only allow Google OAuth
      if (account?.provider !== 'google') {
        return false;
      }

      // Check if email is verified
      if (!profile?.email_verified) {
        console.warn('Sign-in rejected: email not verified');
        return false;
      }

      // Check if email belongs to an allowed domain
      const email = profile.email?.toLowerCase();
      const isAllowedDomain = isAllowedEmailDomain(email);

      if (!isAllowedDomain) {
        console.warn(`Sign-in rejected: domain not allowed for ${maskEmail(profile.email)}`);
        return false;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Sign-in approved for ${maskEmail(profile.email)}`);
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      // Persist user info in JWT token
      if (account && profile) {
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.picture;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user = session.user ?? {};
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    error: '/auth/error', // custom error page
    signIn: '/auth/signin', // custom sign-in page
  },
  events: {
    async signIn({ user, account }) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`User signed in: ${maskEmail(user.email)} via ${account?.provider}`);
      }
    },
    async signOut() {
      if (process.env.NODE_ENV !== 'production') {
        console.log('User signed out');
      }
    },
  },
});