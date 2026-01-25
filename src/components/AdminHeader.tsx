'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useCallback, useEffect } from 'react';

export default function AdminHeader() {
  const { data: session } = useSession();

  // Desktop dropdown hover/click state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile: overlay drawer + submenus
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMgmtOpen, setMobileMgmtOpen] = useState(false);
  const [mobileFinOpen, setMobileFinOpen] = useState(false);

  const handleDropdownToggle = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const closeDropdown = () => setActiveDropdown(null);

  const handleMouseEnter = useCallback(
    (dropdown: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setActiveDropdown(dropdown);
    },
    [setActiveDropdown],
  );

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
  }, []);

  const handleSubmenuMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleSubmenuMouseLeave = useCallback(() => setActiveDropdown(null), []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setMobileMgmtOpen(false);
    setMobileFinOpen(false);
  };

  return (
    <div>
      <header className="navbar bg-base-100 shadow-md">
        <div className="navbar-start gap-2">
          {/* Hamburger for mobile */}
          <button
            type="button"
            aria-label="Open menu"
            className="btn btn-ghost lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <Link href="/" className="btn btn-ghost normal-case text-xl px-2 py-1">
            <Image src="/just_lettering.png" alt="Mythoria Logo" width={150} height={49} />
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            <li>
              <Link href="/" onClick={closeDropdown}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/server-status" onClick={closeDropdown}>
                Server Status
              </Link>
            </li>
            <li>
              <Link href="/tickets" onClick={closeDropdown}>
                Tickets
              </Link>
            </li>
            <li>
              <Link href="/workflows" onClick={closeDropdown}>
                Workflows
              </Link>
            </li>
            <li>
              <Link href="/blog" onClick={closeDropdown}>
                Blog
              </Link>
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
                <svg
                  className="fill-current w-4 h-4 ml-1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
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
                <li>
                  <Link href="/managers" onClick={closeDropdown}>
                    Managers
                  </Link>
                </li>
                <li>
                  <Link href="/users" onClick={closeDropdown}>
                    Users
                  </Link>
                </li>
                <li>
                  <Link href="/partners" onClick={closeDropdown}>
                    Partners
                  </Link>
                </li>
                <li>
                  <Link href="/leads" onClick={closeDropdown}>
                    Leads
                  </Link>
                </li>
                <li>
                  <Link href="/email-marketing" onClick={closeDropdown}>
                    Email Marketing
                  </Link>
                </li>
                <li>
                  <Link href="/stories" onClick={closeDropdown}>
                    Stories
                  </Link>
                </li>
                <li>
                  <Link href="/notifications" onClick={closeDropdown}>
                    Notifications
                  </Link>
                </li>
                <li>
                  <Link href="/faq" onClick={closeDropdown}>
                    FAQs
                  </Link>
                </li>
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
                <svg
                  className="fill-current w-4 h-4 ml-1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
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
                <li>
                  <Link href="/revenue" onClick={closeDropdown}>
                    Revenue
                  </Link>
                </li>
                <li>
                  <Link href="/ai-usage" onClick={closeDropdown}>
                    AI Usage
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" onClick={closeDropdown}>
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/promotion-codes" onClick={closeDropdown}>
                    Promotion Codes
                  </Link>
                </li>
                <li>
                  <Link href="/services" onClick={closeDropdown}>
                    Services
                  </Link>
                </li>
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
              <ul
                tabIndex={0}
                className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-48 sm:w-52"
              >
                <li>
                  <div className="justify-between">
                    <span className="text-sm sm:text-base truncate">{session.user.name}</span>
                  </div>
                </li>
                <li>
                  <div className="justify-between">
                    <span className="text-xs sm:text-sm opacity-70 truncate">
                      {session.user.email}
                    </span>
                  </div>
                </li>
                <li>
                  <hr />
                </li>
                <li>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-sm sm:text-base"
                  >
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* Mobile overlay and panel */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-80 bg-base-200 z-50 lg:hidden p-4 overflow-y-auto">
            <ul className="menu gap-1">
              <li>
                <Link href="/" onClick={closeDrawer}>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/server-status" onClick={closeDrawer}>
                  Server Status
                </Link>
              </li>
              <li>
                <Link href="/tickets" onClick={closeDrawer}>
                  Tickets
                </Link>
              </li>
              <li>
                <Link href="/workflows" onClick={closeDrawer}>
                  Workflows
                </Link>
              </li>
              <li>
                <Link href="/blog" onClick={closeDrawer}>
                  Blog
                </Link>
              </li>
              <li>
                <button className="justify-between" onClick={() => setMobileMgmtOpen((v) => !v)}>
                  <span>Management</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${mobileMgmtOpen ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5.293 7.293L10 12l4.707-4.707-1.414-1.414L10 9.172 6.707 5.879z" />
                  </svg>
                </button>
                {mobileMgmtOpen && (
                  <ul className="pl-4">
                    <li>
                      <Link href="/managers" onClick={closeDrawer}>
                        Managers
                      </Link>
                    </li>
                    <li>
                      <Link href="/users" onClick={closeDrawer}>
                        Users
                      </Link>
                    </li>
                    <li>
                      <Link href="/partners" onClick={closeDrawer}>
                        Partners
                      </Link>
                    </li>
                    <li>
                      <Link href="/leads" onClick={closeDrawer}>
                        Leads
                      </Link>
                    </li>
                    <li>
                      <Link href="/email-marketing" onClick={closeDrawer}>
                        Email Marketing
                      </Link>
                    </li>
                    <li>
                      <Link href="/stories" onClick={closeDrawer}>
                        Stories
                      </Link>
                    </li>
                    <li>
                      <Link href="/notifications" onClick={closeDrawer}>
                        Notifications
                      </Link>
                    </li>
                    <li>
                      <Link href="/faq" onClick={closeDrawer}>
                        FAQs
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <button className="justify-between" onClick={() => setMobileFinOpen((v) => !v)}>
                  <span>Financials</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${mobileFinOpen ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5.293 7.293L10 12l4.707-4.707-1.414-1.414L10 9.172 6.707 5.879z" />
                  </svg>
                </button>
                {mobileFinOpen && (
                  <ul className="pl-4">
                    <li>
                      <Link href="/revenue" onClick={closeDrawer}>
                        Revenue
                      </Link>
                    </li>
                    <li>
                      <Link href="/ai-usage" onClick={closeDrawer}>
                        AI Usage
                      </Link>
                    </li>
                    <li>
                      <Link href="/pricing" onClick={closeDrawer}>
                        Pricing
                      </Link>
                    </li>
                    <li>
                      <Link href="/promotion-codes" onClick={closeDrawer}>
                        Promotion Codes
                      </Link>
                    </li>
                    <li>
                      <Link href="/services" onClick={closeDrawer}>
                        Services
                      </Link>
                    </li>
                  </ul>
                )}
              </li>

              {session?.user && (
                <li className="mt-2 border-t pt-2">
                  <button
                    onClick={() => {
                      closeDrawer();
                      signOut({ callbackUrl: '/' });
                    }}
                  >
                    Logout
                  </button>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
