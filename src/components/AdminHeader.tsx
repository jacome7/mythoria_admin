'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useCallback, useEffect } from 'react';

export default function AdminHeader() {
  const { data: session } = useSession();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDropdownToggle = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
  };

  const handleMouseEnter = useCallback((dropdown: string) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActiveDropdown(dropdown);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Add a delay before closing to allow moving to submenu
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150); // 150ms delay
  }, []);

  const handleSubmenuMouseEnter = useCallback(() => {
    // Cancel the close timeout when entering submenu
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleSubmenuMouseLeave = useCallback(() => {
    // Close immediately when leaving submenu
    setActiveDropdown(null);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
          {/* Dashboard - Standalone */}
          <li>
            <Link href="/" onClick={closeDropdown}>Dashboard</Link>
          </li>

          {/* Server Status - Standalone */}
          <li>
            <Link href="/server-status" onClick={closeDropdown}>Server Status</Link>
          </li>

          {/* Tickets - Standalone */}
          <li>
            <Link href="/tickets" onClick={closeDropdown}>Tickets</Link>
          </li>

          {/* Workflows - Standalone */}
          <li>
            <Link href="/workflows" onClick={closeDropdown}>Workflows</Link>
          </li>

          {/* Management Dropdown */}
          <li 
            className="dropdown"
            onMouseEnter={() => handleMouseEnter('management')}
            onMouseLeave={handleMouseLeave}
          >
            <div 
              tabIndex={0} 
              role="button" 
              className="btn btn-ghost"
              onClick={() => handleDropdownToggle('management')}
            >
              Management
              <svg className="fill-current w-4 h-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
            <ul 
              tabIndex={0} 
              className={`dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 ${
                activeDropdown === 'management' ? 'block' : 'hidden'
              }`}
              onMouseEnter={handleSubmenuMouseEnter}
              onMouseLeave={handleSubmenuMouseLeave}
            >
              <li><Link href="/managers" onClick={closeDropdown}>Managers</Link></li>
              <li><Link href="/users" onClick={closeDropdown}>Users</Link></li>
              <li><Link href="/stories" onClick={closeDropdown}>Stories</Link></li>
              <li><Link href="/notifications" onClick={closeDropdown}>Notifications</Link></li>
            </ul>
          </li>

          {/* Financials Dropdown */}
          <li 
            className="dropdown"
            onMouseEnter={() => handleMouseEnter('financials')}
            onMouseLeave={handleMouseLeave}
          >
            <div 
              tabIndex={0} 
              role="button" 
              className="btn btn-ghost"
              onClick={() => handleDropdownToggle('financials')}
            >
              Financials
              <svg className="fill-current w-4 h-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
            <ul 
              tabIndex={0} 
              className={`dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 ${
                activeDropdown === 'financials' ? 'block' : 'hidden'
              }`}
              onMouseEnter={handleSubmenuMouseEnter}
              onMouseLeave={handleSubmenuMouseLeave}
            >
              <li><Link href="/pricing" onClick={closeDropdown}>Pricing</Link></li>
              <li><Link href="/revenue" onClick={closeDropdown}>Revenue</Link></li>
              <li><Link href="/ai-usage" onClick={closeDropdown}>AI Usage</Link></li>
              <li><Link href="/services" onClick={closeDropdown}>Services</Link></li>
            </ul>
          </li>
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
