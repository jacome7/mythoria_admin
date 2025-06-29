'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';

export default function AdminHeader() {
  const { data: session } = useSession();

  return (
    <header className="navbar bg-base-100 shadow-md">
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost normal-case text-xl px-2 py-1">
          <Image 
            src="/Mythoria-logo-white-transparent-256x168.png" 
            alt="Mythoria Logo" 
            width={52} 
            height={34} 
          />
        </Link>
      </div>

      <div className="navbar-center">
        <ul className="menu menu-horizontal px-1">
          <li><Link href="/">Dashboard</Link></li>
          <li><Link href="/users">Users</Link></li>
          <li><Link href="/leads">Leads</Link></li>
          <li><Link href="/stories">Stories</Link></li>
          <li><Link href="/print-requests">Print Requests</Link></li>
          <li><Link href="/payments">Payments</Link></li>
          <li><Link href="/pricing">Pricing</Link></li>
          <li><Link href="/server-status">Server Status</Link></li>
        </ul>
      </div>

      <div className="navbar-end">
        {session?.user && (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt="User Avatar"
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-content">
                    {session.user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            </div>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li>
                <div className="justify-between">
                  <span>{session.user.name}</span>
                </div>
              </li>
              <li>
                <div className="justify-between">
                  <span className="text-sm opacity-70">{session.user.email}</span>
                </div>
              </li>
              <li><hr /></li>
              <li>
                <button onClick={() => signOut({ callbackUrl: '/' })}>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
