import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ALLOWED_DOMAINS } from '@/config/auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use JWT strategy instead of database for now to avoid initialization issues
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          hd: "mythoria.pt", // optimize for mythoria.pt domain
        },
      },
    }),
  ],
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    async signIn({ account, profile }) {
      // Only allow Google OAuth
      if (account?.provider !== "google") {
        return false;
      }

      // Check if email is verified
      if (!profile?.email_verified) {
        console.log("Sign-in rejected: Email not verified");
        return false;
      }

      // Check if email ends with allowed domains
      const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
        profile.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        console.log(`Sign-in rejected: Domain not allowed for ${profile.email}`);
        return false;
      }

      console.log(`Sign-in approved for ${profile.email}`);
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
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  pages: {
    error: "/auth/error", // custom error page
    signIn: "/auth/signin", // custom sign-in page
  },
  events: {
    async signIn({ user, account }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
    },
    async signOut(message) {
      console.log(`User signed out:`, message);
    },
  },
});
