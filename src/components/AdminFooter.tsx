'use client';

export default function AdminFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="footer footer-center p-4 bg-base-200 text-base-content">
      <aside>
        <p className="text-xs sm:text-sm md:text-base text-center">
          © {currentYear} Mythoria Admin Portal - Authorized Access Only
        </p>
      </aside>
    </footer>
  );
}
