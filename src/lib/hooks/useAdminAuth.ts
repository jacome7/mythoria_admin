'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ALLOWED_DOMAINS } from '@/config/auth';

export const useAdminAuth = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasUser = Boolean(session?.user);
  const userEmail = session?.user?.email;
  const isAllowedDomain =
    typeof userEmail === 'string' && userEmail.length > 0
      ? ALLOWED_DOMAINS.some((domain) => userEmail.endsWith(domain))
      : false;

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (hasUser && !isAllowedDomain) {
      router.push('/auth/error');
    }
  }, [status, hasUser, isAllowedDomain, router]);

  const derivedLoading = status === 'loading' || (hasUser && !isAllowedDomain);

  return { session, loading: derivedLoading };
};

export default useAdminAuth;
