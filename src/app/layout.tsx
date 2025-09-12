import './globals.css';
import type { Metadata } from 'next';
import AuthProvider from '@/components/auth-provider';
import LayoutWrapper from '@/components/layout-wrapper';

export const metadata: Metadata = {
  title: 'Mythoria Admin Portal',
  description: 'Administrative portal for Mythoria platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="mythoria">
      <body className="antialiased">
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
