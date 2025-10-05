# Mythoria Admin Portal - Authentication System

## Overview

The Mythoria Admin Portal uses **NextAuth.js v5 (Auth.js)** with Google OAuth 2.0 for secure authentication. Access is restricted to specific email domains to ensure only authorized personnel can access administrative functions.

## Authentication Architecture

### Authentication Flow

```
1. User visits admin portal
2. Redirected to Google OAuth consent screen
3. User authenticates with Google
4. Google returns user profile and email
5. Server validates email domain
6. Server checks email verification status
7. JWT token generated and session established
8. User gains access to admin interface
```

### Domain Restrictions

Access is limited to the following email domains:

- `@mythoria.pt` - Primary domain
- `@caravanconcierge.com` - Secondary domain

### Security Features

- **Server-side domain validation** - Cannot be bypassed by client manipulation
- **Email verification requirement** - Only verified Google accounts allowed
- **JWT session management** - Secure session handling
- **HTTPS enforcement** - All authentication traffic encrypted

## Implementation Details

### 1. NextAuth.js Configuration

#### Main Configuration (`auth.ts`)

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Hint to use mythoria.pt domain
          hd: 'mythoria.pt',
          prompt: 'select_account',
        },
      },
    }),
  ],

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow Google provider
      if (account?.provider !== 'google') {
        return false;
      }

      // Check email verification
      if (!profile?.email_verified) {
        return false;
      }

      // Validate email domain
      const email = profile.email;
      const allowedDomains = ['mythoria.pt', 'caravanconcierge.com'];
      const domain = email?.split('@')[1];

      if (!domain || !allowedDomains.includes(domain)) {
        return false;
      }

      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Persist user information in JWT
      if (account && profile) {
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.picture;
        token.domain = profile.email?.split('@')[1];
      }
      return token;
    },

    async session({ session, token }) {
      // Expose user information to client
      if (token) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.domain = token.domain as string;
      }
      return session;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  secret: process.env.AUTH_SECRET,
});
```

#### API Route (`src/app/api/auth/[...nextauth]/route.ts`)

```typescript
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

### 2. Custom Authentication Pages

#### Sign In Page (`src/app/auth/signin/page.tsx`)

```typescript
'use client';

import { signIn, getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function SignInPage() {
  const [providers, setProviders] = useState<any>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders();
      setProviders(res);
    };
    fetchProviders();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center mb-4">
            Mythoria Admin Portal
          </h2>

          <p className="text-center text-base-content/70 mb-6">
            Sign in with your authorized account
          </p>

          {providers && (
            <div className="space-y-4">
              {Object.values(providers).map((provider: any) => (
                <button
                  key={provider.name}
                  onClick={() => signIn(provider.id)}
                  className="btn btn-primary w-full"
                >
                  Sign in with {provider.name}
                </button>
              ))}
            </div>
          )}

          <div className="text-sm text-base-content/60 text-center mt-4">
            <p>Access restricted to:</p>
            <p>@mythoria.pt and @caravanconcierge.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### Error Page (`src/app/auth/error/page.tsx`)

```typescript
'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const errorMessages = {
  Signin: 'Try signing in with a different account.',
  OAuthSignin: 'Try signing in with a different account.',
  OAuthCallback: 'Try signing in with a different account.',
  OAuthCreateAccount: 'Try signing in with a different account.',
  EmailCreateAccount: 'Try signing in with a different account.',
  Callback: 'Try signing in with a different account.',
  OAuthAccountNotLinked: 'To confirm your identity, sign in with the same account you used originally.',
  EmailSignin: 'Check your email address.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  default: 'Unable to sign in.'
};

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') as keyof typeof errorMessages;

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center text-error mb-4">
            Authentication Error
          </h2>

          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessages[error] || errorMessages.default}</span>
          </div>

          <div className="text-sm text-base-content/70 mb-6">
            <p>Possible reasons:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your email domain is not authorized</li>
              <li>Your Google account email is not verified</li>
              <li>You need to use a @mythoria.pt or @caravanconcierge.com email</li>
            </ul>
          </div>

          <div className="card-actions justify-center">
            <Link href="/auth/signin" className="btn btn-primary">
              Try Again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3. Middleware Protection

#### Route Protection (`middleware.ts`)

```typescript
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/error'];

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 4. Session Management

#### Server Components

```typescript
// Get session in server components
import { auth } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div>
      <h1>Welcome, {session.user?.name}</h1>
      <p>Domain: {session.user?.domain}</p>
    </div>
  );
}
```

#### Client Components

```typescript
// Use session in client components
'use client';

import { useSession } from 'next-auth/react';

export default function UserProfile() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className="loading loading-spinner"></div>;
  }

  if (status === 'unauthenticated') {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <h2>{session?.user?.name}</h2>
      <p>{session?.user?.email}</p>
    </div>
  );
}
```

### 5. API Route Protection

#### Protected API Routes

```typescript
// Protect API routes
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify domain (additional security)
  const userDomain = session.user?.email?.split('@')[1];
  const allowedDomains = ['mythoria.pt', 'caravanconcierge.com'];

  if (!userDomain || !allowedDomains.includes(userDomain)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // API logic here
  return Response.json({ message: 'Success' });
}
```

## Environment Configuration

### Required Environment Variables

#### Development (`.env.local`)

```bash
# NextAuth Configuration
AUTH_SECRET=your-super-secret-auth-secret
NEXTAUTH_URL=http://localhost:3001

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Node Environment
NODE_ENV=development
```

#### Production (Cloud Run)

```bash
# NextAuth Configuration
AUTH_SECRET=production-secret-key
NEXTAUTH_URL=https://your-admin-domain.com

# Google OAuth Credentials
GOOGLE_CLIENT_ID=production-google-client-id
GOOGLE_CLIENT_SECRET=production-google-client-secret

# Node Environment
NODE_ENV=production
```

### Google OAuth Setup

#### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Click **Create Credentials** > **OAuth 2.0 Client ID**
4. Select **Web application**
5. Add authorized redirect URIs:
   - Development: `http://localhost:3001/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`

#### 2. Configure OAuth Consent Screen

1. Go to **OAuth consent screen**
2. Set **User Type** to **Internal** (for organization use)
3. Fill in application information:
   - Application name: "Mythoria Admin Portal"
   - User support email: Your admin email
   - Authorized domains: `mythoria.pt`, `caravanconcierge.com`
4. Add scopes: `email`, `profile`, `openid`

## Security Considerations

### 1. Domain Validation

- **Server-side validation** - Domain checking happens on the server
- **Cannot be bypassed** - Client cannot modify domain validation
- **Multiple domains supported** - Easy to add new authorized domains

### 2. Email Verification

- **Google verification required** - Only verified Google accounts accepted
- **Prevents spoofing** - Unverified emails cannot access admin panel
- **Automatic validation** - Handled by Google OAuth flow

### 3. Session Security

- **JWT tokens** - Secure session management
- **Configurable expiration** - Sessions expire after 24 hours
- **HTTPS enforcement** - All authentication traffic encrypted
- **Secret rotation** - AUTH_SECRET can be rotated for security

### 4. Additional Security Measures

```typescript
// Rate limiting for auth endpoints
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  await rateLimit(request, { max: 5, windowMs: 60000 }); // 5 attempts per minute

  // Authentication logic
}

// IP allowlisting (optional)
const allowedIPs = ['192.168.1.0/24', '10.0.0.0/8'];
const clientIP = request.headers.get('x-forwarded-for');

if (!isIPAllowed(clientIP, allowedIPs)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

## Troubleshooting

### Common Authentication Issues

#### 1. OAuth Redirect Mismatch

```bash
# Error: redirect_uri_mismatch
# Solution: Verify redirect URIs in Google Console match exactly
# Development: http://localhost:3001/api/auth/callback/google
# Production: https://your-domain.com/api/auth/callback/google
```

#### 2. Domain Restriction Not Working

```typescript
// Check domain validation logic
const email = profile.email;
const domain = email?.split('@')[1];
console.log('User domain:', domain);
console.log('Allowed domains:', allowedDomains);
```

#### 3. Session Not Persisting

```bash
# Check AUTH_SECRET is set
echo $AUTH_SECRET

# Verify NEXTAUTH_URL matches current domain
echo $NEXTAUTH_URL
```

#### 4. Email Verification Issues

```typescript
// Check email verification status
console.log('Email verified:', profile?.email_verified);

// Verify profile data
console.log('Profile data:', profile);
```

### Debug Mode

#### Enable NextAuth Debug Mode

```bash
# Add to .env.local for development
NEXTAUTH_DEBUG=true

# Restart development server
npm run dev
```

#### Debug Session Data

```typescript
// Debug session in components
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();
console.log('Session status:', status);
console.log('Session data:', session);
```

## Testing Authentication

### 1. Manual Testing Checklist

- [ ] Sign in with authorized @mythoria.pt email
- [ ] Sign in with authorized @caravanconcierge.com email
- [ ] Attempt sign in with unauthorized domain (should fail)
- [ ] Attempt sign in with unverified Google account (should fail)
- [ ] Test session persistence across page reloads
- [ ] Test session expiration (after 24 hours)
- [ ] Test sign out functionality

### 2. Automated Testing

```typescript
// Test domain validation
describe('Domain Validation', () => {
  it('should accept mythoria.pt emails', () => {
    const email = 'admin@mythoria.pt';
    expect(isEmailDomainAllowed(email)).toBe(true);
  });

  it('should reject unauthorized domains', () => {
    const email = 'user@gmail.com';
    expect(isEmailDomainAllowed(email)).toBe(false);
  });
});
```

---

**Authentication Guide Version**: 1.0.0  
**Last Updated**: June 29, 2025  
**Service**: Mythoria Admin Portal v0.1.0+
