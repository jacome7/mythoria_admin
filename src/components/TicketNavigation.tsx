import Link from 'next/link';

export const ticketNavigationItems = [
  { href: '/tickets', label: 'Customer tickets' },
  { href: '/tickets/print-orders', label: 'Print orders' },
  { href: '/tickets/print-settings', label: 'Print settings' },
] as const;

export function TicketNavigation({
  current,
}: {
  current: (typeof ticketNavigationItems)[number]['href'];
}) {
  return (
    <nav aria-label="Tickets" className="flex flex-wrap gap-1">
      {ticketNavigationItems.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`btn btn-sm ${href === current ? 'btn-active' : 'btn-ghost'}`}
          aria-current={href === current ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
