'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useCallback, useEffect } from 'react';

export default function AdminHeader() {
  const { data: session } = useSession();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleDropdownToggle = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (mobileMenuOpen && !target.closest('.dropdown')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);

  return (
    <header className="navbar bg-base-100 shadow-md">
      <div className="navbar-start">
        {/* Mobile menu dropdown */}
        <div className="dropdown lg:hidden relative">
          <button 
            type="button"
            className="btn btn-ghost"
            onClick={toggleMobileMenu}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          {mobileMenuOpen && (
            <ul className="menu p-2 shadow bg-base-100 rounded-box w-52 absolute top-full left-0 mt-1 z-50 border border-gray-200">
              {/* Mobile Dashboard */}
              <li>
                <Link href="/" onClick={closeDropdown}>Dashboard</Link>
              </li>
              
              {/* Mobile Server Status */}
              <li>
                <Link href="/server-status" onClick={closeDropdown}>Server Status</Link>
              </li>
              
              {/* Mobile Tickets */}
              <li>
                <Link href="/tickets" onClick={closeDropdown}>Tickets</Link>
              </li>
              
              {/* Mobile Workflows */}
              <li>
                <Link href="/workflows" onClick={closeDropdown}>Workflows</Link>
              </li>
              
              {/* Mobile Management Submenu */}
              <li>
                <details>
                  <summary>Management</summary>
                  <ul className="p-2 bg-base-100">
                    <li><Link href="/managers" onClick={closeDropdown}>Managers</Link></li>
                    <li><Link href="/users" onClick={closeDropdown}>Users</Link></li>
                    <li><Link href="/stories" onClick={closeDropdown}>Stories</Link></li>
                    <li><Link href="/notifications" onClick={closeDropdown}>Notifications</Link></li>
                  </ul>
                </details>
              </li>
              
              {/* Mobile Financials Submenu */}
              <li>
                <details>
                  <summary>Financials</summary>
                  <ul className="p-2 bg-base-100">
                    <li><Link href="/revenue" onClick={closeDropdown}>Revenue</Link></li>
                    <li><Link href="/ai-usage" onClick={closeDropdown}>AI Usage</Link></li>
                    <li><Link href="/pricing" onClick={closeDropdown}>Pricing</Link></li>
                    <li><Link href="/services" onClick={closeDropdown}>Services</Link></li>
                  </ul>
                </details>
              </li>
            </ul>
          )}
        </div>

        <Link href="/" className="btn btn-ghost normal-case text-xl px-2 py-1">
          <Image 
            src="/Mythoria-logo-white-transparent-256x168.png" 
            alt="Mythoria Logo" 
            width={52} 
            height={34} 
            className="max-w-none w-10 h-6 sm:w-12 sm:h-8 md:w-[52px] md:h-[34px]"
          />
        </Link>
      </div>

      <div className="navbar-center hidden lg:flex">
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
              <li><Link href="/revenue" onClick={closeDropdown}>Revenue</Link></li>
              <li><Link href="/ai-usage" onClick={closeDropdown}>AI Usage</Link></li>
              <li><Link href="/pricing" onClick={closeDropdown}>Pricing</Link></li>
              <li><Link href="/services" onClick={closeDropdown}>Services</Link></li>
            </ul>
          </li>
        </ul>
      </div>

      <div className="navbar-end">
        {session?.user && (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-8 sm:w-10 rounded-full">
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt="User Avatar"
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center text-primary-content text-sm sm:text-base">
                    {session.user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            </div>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-48 sm:w-52">
              <li>
                <div className="justify-between">
                  <span className="text-sm sm:text-base truncate">{session.user.name}</span>
                </div>
              </li>
              <li>
                <div className="justify-between">
                  <span className="text-xs sm:text-sm opacity-70 truncate">{session.user.email}</span>
                </div>
              </li>
              <li><hr /></li>
              <li>
                <button onClick={() => signOut({ callbackUrl: '/' })} className="text-sm sm:text-base">
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
