'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AdminHeader from '../../../components/AdminHeader';
import AdminFooter from '../../../components/AdminFooter';

interface User {
  authorId: string;
  displayName: string;
  email: string;
  mobilePhone: string | null;
  fiscalNumber: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  preferredLocale: string;
  creditBalance: number;
}

interface CreditHistoryEntry {
  id: string;
  amount: number;
  creditEventType: string;
  createdAt: string;
  storyId: string | null;
  purchaseId: string | null;
  balanceAfter: number;
}

export default function UserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [isAssignCreditsModalOpen, setIsAssignCreditsModalOpen] = useState(false);
  const [creditHistory, setCreditHistory] = useState<CreditHistoryEntry[]>([]);
  const [isCreditHistoryLoading, setIsCreditHistoryLoading] = useState(false);
  const [isAssigningCredits, setIsAssigningCredits] = useState(false);
  
  // Form state for assigning credits
  const [assignAmount, setAssignAmount] = useState<number>(1);
  const [assignEventType, setAssignEventType] = useState<'refund' | 'voucher' | 'promotion'>('voucher');

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/users/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 404) {
        router.push('/users');
      } else {
        console.error('Failed to fetch user');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      // Check if user has the required email domain
      const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
      const isAllowedDomain = allowedDomains.some(domain => 
        session.user?.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }

      // Fetch user data
      fetchUser();
    }
  }, [status, session, router, userId, fetchUser]);

  const fetchCreditHistory = async () => {
    try {
      setIsCreditHistoryLoading(true);
      const response = await fetch(`/api/admin/users/${userId}/credits`);
      if (response.ok) {
        const data = await response.json();
        setCreditHistory(data.creditHistory);
        // Update user's credit balance with the latest data
        if (user) {
          setUser({ ...user, creditBalance: data.currentBalance });
        }
      }
    } catch (error) {
      console.error('Error fetching credit history:', error);
    } finally {
      setIsCreditHistoryLoading(false);
    }
  };

  const handleOpenCreditsModal = () => {
    setIsCreditsModalOpen(true);
    fetchCreditHistory();
  };

  const handleAssignCredits = async () => {
    try {
      setIsAssigningCredits(true);
      const response = await fetch(`/api/admin/users/${userId}/assign-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: assignAmount,
          eventType: assignEventType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update user's credit balance
        if (user) {
          setUser({ ...user, creditBalance: result.newBalance });
        }
        // Close modal and reset form
        setIsAssignCreditsModalOpen(false);
        setAssignAmount(1);
        setAssignEventType('voucher');
        // Show success message (you could add a toast notification here)
        alert(result.message);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error assigning credits:', error);
      alert('Error assigning credits');
    } finally {
      setIsAssigningCredits(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEventType = (eventType: string) => {
    const eventTypes: { [key: string]: string } = {
      'initialCredit': 'Initial Credit',
      'creditPurchase': 'Credit Purchase',
      'eBookGeneration': 'eBook Generation',
      'audioBookGeneration': 'Audiobook Generation',
      'printOrder': 'Print Order',
      'refund': 'Refund',
      'voucher': 'Voucher',
      'promotion': 'Promotion',
      'textEdit': 'Text Edit',
      'imageEdit': 'Image Edit'
    };
    return eventTypes[eventType] || eventType;
  };

  const getAmountColor = (amount: number) => {
    return amount > 0 ? 'text-green-600' : 'text-red-600';
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-base-100">
        <AdminHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base-100">
        <AdminHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">User not found</h1>
            <Link href="/users" className="btn btn-primary">
              Back to Users
            </Link>
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <AdminHeader />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="breadcrumbs text-sm">
              <ul>
                <li><Link href="/users">Users</Link></li>
                <li>{user.displayName}</li>
              </ul>
            </div>
            <h1 className="text-3xl font-bold">{user.displayName}</h1>
          </div>
          <Link href="/users" className="btn btn-outline">
            Back to Users
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Information */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">User Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">Display Name:</label>
                  <p>{user.displayName}</p>
                </div>
                <div>
                  <label className="font-semibold">Email:</label>
                  <p>{user.email}</p>
                </div>
                <div>
                  <label className="font-semibold">Mobile Phone:</label>
                  <p>{user.mobilePhone || <span className="text-gray-400">Not provided</span>}</p>
                </div>
                <div>
                  <label className="font-semibold">Fiscal Number:</label>
                  <p>{user.fiscalNumber || <span className="text-gray-400">Not provided</span>}</p>
                </div>
                <div>
                  <label className="font-semibold">Preferred Locale:</label>
                  <p>{user.preferredLocale}</p>
                </div>
                <div>
                  <label className="font-semibold">Created At:</label>
                  <p>{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <label className="font-semibold">Last Login:</label>
                  <p>{user.lastLoginAt ? formatDate(user.lastLoginAt) : <span className="text-gray-400">Never</span>}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Credits Information */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Credits</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Current Balance:</span>
                  <button 
                    className="btn btn-outline btn-secondary"
                    onClick={handleOpenCreditsModal}
                  >
                    {user.creditBalance} Credits
                  </button>
                </div>
                
                <div className="card-actions justify-end">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setIsAssignCreditsModalOpen(true)}
                  >
                    Assign Credits
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Credit History Modal */}
      {isCreditsModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">Credit History</h3>

            {isCreditHistoryLoading ? (
              <div className="flex justify-center items-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="table table-zebra w-full">
                    <thead className="sticky top-0 bg-base-100 z-10">
                      <tr>
                        <th>Date</th>
                        <th>Event Type</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditHistory.map((entry) => (
                        <tr key={entry.id}>
                          <td className="text-sm">
                            {formatDate(entry.createdAt)}
                          </td>
                          <td>{formatEventType(entry.creditEventType)}</td>
                          <td className={`text-right font-mono ${getAmountColor(entry.amount)}`}>
                            {entry.amount > 0 ? '+' : ''}{entry.amount}
                          </td>
                          <td className="text-right font-mono font-semibold">
                            {entry.balanceAfter}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 p-4 bg-base-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Current Balance</span>
                    <span className="text-xl font-bold text-primary">{user.creditBalance} Credits</span>
                  </div>
                </div>
              </>
            )}
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsCreditsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Credits Modal */}
      {isAssignCreditsModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Assign Credits</h3>
            
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text">Amount (1-200 credits)</span>
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={assignAmount}
                onChange={(e) => setAssignAmount(parseInt(e.target.value) || 1)}
                className="input input-bordered w-full"
                placeholder="Enter amount"
              />
            </div>

            <div className="form-control w-full mb-6">
              <label className="label">
                <span className="label-text">Event Type</span>
              </label>
              <select
                value={assignEventType}
                onChange={(e) => setAssignEventType(e.target.value as 'refund' | 'voucher' | 'promotion')}
                className="select select-bordered w-full"
              >
                <option value="voucher">Voucher</option>
                <option value="refund">Refund</option>
                <option value="promotion">Promotion</option>
              </select>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsAssignCreditsModalOpen(false)}
                disabled={isAssigningCredits}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAssignCredits}
                disabled={isAssigningCredits || assignAmount < 1 || assignAmount > 200}
              >
                {isAssigningCredits ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Assign Credits'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminFooter />
    </div>
  );
}
