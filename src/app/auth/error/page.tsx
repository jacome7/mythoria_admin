'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MdError, MdHome } from 'react-icons/md';
import { Suspense } from 'react';
import { ALLOWED_DOMAINS } from '@/config/auth';

const errorMessages = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'Access denied. You do not have permission to sign in.',
  Verification: 'The verification token has expired or has already been used.',
  Default: 'An error occurred during authentication.',
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') as keyof typeof errorMessages;

  const message = errorMessages[error] || errorMessages.Default;

  const isDomainError = error === 'AccessDenied';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl">
        <div className="card-body text-center">
          <div className="flex justify-center mb-4">
            <div className="avatar">
              <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center">
                <MdError className="text-4xl text-error" />
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-error mb-2">Authentication Error</h1>

          <p className="text-base-content/70 mb-4">{message}</p>

          {isDomainError && (
            <div className="alert alert-warning mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div className="text-sm">
                <p className="font-medium">Domain Restriction</p>
                <p>Only {ALLOWED_DOMAINS.join(' and ')} email addresses are allowed.</p>
              </div>
            </div>
          )}

          <div className="card-actions justify-center gap-2">
            <Link href="/auth/signin" className="btn btn-primary">
              Try Again
            </Link>
            <Link href="/" className="btn btn-outline gap-2">
              <MdHome />
              Home
            </Link>
          </div>

          <div className="divider">Help</div>

          <div className="text-xs text-base-content/50">
            <p>If you believe this is an error, please contact your administrator.</p>
            <p className="mt-1">Make sure your email is verified with Google.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
          <div className="card w-full max-w-md bg-base-100 shadow-2xl">
            <div className="card-body text-center">
              <div className="loading loading-spinner loading-lg"></div>
              <p>Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
