'use client';

import { usePathname } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const hideHeaderFooter = pathname.startsWith('/auth');

  return (
    <>
      {!hideHeaderFooter && <AdminHeader />}
      {children}
      {!hideHeaderFooter && <AdminFooter />}
    </>
  );
}
