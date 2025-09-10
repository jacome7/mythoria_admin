'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const allowedDomains = ['@mythoria.pt', '@caravanconcierge.com'];

export const useAdminAuth = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      const isAllowedDomain = allowedDomains.some((domain) =>
        session.user?.email?.endsWith(domain),
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }
    }

    setLoading(false);
  }, [status, session, router]);

  return { session, loading: loading || status === 'loading' };
};

export default useAdminAuth;
