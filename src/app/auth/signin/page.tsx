"use client";

import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const isNonProd = process.env.NODE_ENV !== 'production';
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
  let adminPort = '3001';
  try {
    const u = new URL(adminUrl);
    adminPort = u.port || (u.protocol === 'https:' ? '443' : '80');
  } catch {
    adminPort = '3001';
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { 
        callbackUrl: "/",
        redirect: true,
      });
    } catch (error) {
      console.error("Sign-in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl">
        <div className="card-body">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              Mythoria Admin
            </h1>
            <p className="text-base-content/70">
              Administration Portal
            </p>
          </div>

          <div className="space-y-4">
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="text-sm">
                Access restricted to @mythoria.pt and @caravanconcierge.com
              </span>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="btn btn-outline btn-primary w-full gap-2"
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <FcGoogle className="text-xl" />
              )}
              {isLoading ? "Signing in..." : "Sign in with Google"}
            </button>
          </div>

          <div className="divider">Authorized Access Only</div>

          <div className="text-center">
            <p className="text-sm text-base-content/60">
              This portal is restricted to Mythoria team members.
            </p>
            {isNonProd && (
              <p className="text-xs text-base-content/50 mt-2">
                Dev Environment: Port {adminPort}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
