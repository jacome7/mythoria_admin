import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ReferralAdmin from '@/components/referrals/ReferralAdmin';
import { ReferralAdminError, requireAdminPermission } from '@/lib/referrals/permissions';
export const dynamic = 'force-dynamic';
export default async function ReferralAdminPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  let actor;
  try {
    actor = await requireAdminPermission('referrals:view');
  } catch (error) {
    if (!(error instanceof ReferralAdminError)) throw error;
    if (error.status === 401) redirect('/auth/signin?callbackUrl=%2Freferrals');
    if (error.status !== 403) throw error;
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Referral platform</h1>
        <div role="alert" className="alert alert-warning">
          <div>
            <h2 className="font-semibold">Referral access required</h2>
            <p>
              Your account does not have permission to view referrals. Ask your administrator to
              assign a referral role to the email address you use to sign in.
            </p>
          </div>
        </div>
        <Link href="/" className="btn btn-ghost mt-4">
          Back to dashboard
        </Link>
      </div>
    );
  }
  const path = (await params).path || [];
  let view = path[0] || 'overview';
  let id: string | undefined;
  if (view === 'owners' && path[1]) {
    if (path[1] === 'new') view = 'new';
    else id = path[1];
  }
  if (
    !['overview', 'owners', 'new', 'commissions', 'settlements', 'reconciliation'].includes(view) ||
    path.length > 2
  )
    notFound();
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Referral platform</h1>
      <ReferralAdmin view={view} id={id} permissions={actor.permissions} />
    </div>
  );
}
