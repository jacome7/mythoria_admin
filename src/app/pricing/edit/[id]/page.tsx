'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface CreditPackage {
  id: string;
  credits: number;
  price: string;
  popular: boolean;
  bestValue: boolean;
  icon: string;
  key: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function EditCreditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const resolvedParams = use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [creditPackage, setCreditPackage] = useState<CreditPackage | null>(null);
  const [formData, setFormData] = useState({
    credits: 0,
    price: '',
    popular: false,
    bestValue: false,
  });

  const fetchCreditPackage = useCallback(async () => {
    try {
      const response = await fetch(`/api/credit-packages/${resolvedParams.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch credit package');
      }

      const pkg = await response.json();
      setCreditPackage(pkg);
      setFormData({
        credits: pkg.credits,
        price: pkg.price,
        popular: pkg.popular,
        bestValue: pkg.bestValue,
      });
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching credit package:', error);
      router.push('/pricing');
    }
  }, [resolvedParams.id, router]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchCreditPackage();
    }
  }, [loading, session, fetchCreditPackage]);

  const calculateCostPerCredit = () => {
    if (formData.credits > 0 && formData.price && parseFloat(formData.price) > 0) {
      return (parseFloat(formData.price) / formData.credits).toFixed(2);
    }
    return '0.00';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/credit-packages/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: formData.credits,
          price: formData.price,
          popular: formData.popular,
          bestValue: formData.bestValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update credit package');
      }

      router.push('/pricing');
    } catch (error) {
      console.error('Error updating credit package:', error);
      alert('Error updating credit package. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this credit package? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/credit-packages/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete credit package');
      }

      router.push('/pricing');
    } catch (error) {
      console.error('Error deleting credit package:', error);
      alert('Error deleting credit package. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    router.push('/pricing');
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  if (!creditPackage) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto p-6">
          <div className="alert alert-error">
            <span>Credit package not found</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <button 
              onClick={handleCancel}
              className="btn btn-ghost btn-sm"
            >
              ← Back to Credit Packages
            </button>
          </div>
          <h1 className="text-3xl font-bold text-base-content">Edit Credit Package</h1>
          <p className="text-base-content/70">
            Package Key: <span className="font-mono">{creditPackage.key}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Edit Form */}
          <div className="lg:col-span-2">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Package Details</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Credits *</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered"
                        placeholder="5"
                        min="1"
                        value={formData.credits || ''}
                        onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Price (€) *</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="input input-bordered"
                        placeholder="9.99"
                        min="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Cost per Credit Display */}
                  <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div>
                      <h3 className="font-bold">Cost per Credit</h3>
                      <div className="text-xs">€{calculateCostPerCredit()} per credit</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="cursor-pointer label">
                        <span className="label-text font-semibold">Popular Package</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-secondary"
                          checked={formData.popular}
                          onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                        />
                      </label>
                      <label className="label">
                        <span className="label-text-alt">Mark this package as popular to highlight it</span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="cursor-pointer label">
                        <span className="label-text font-semibold">Best Value Package</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-accent"
                          checked={formData.bestValue}
                          onChange={(e) => setFormData({ ...formData, bestValue: e.target.checked })}
                        />
                      </label>
                      <label className="label">
                        <span className="label-text-alt">Mark this package as the best value option</span>
                      </label>
                    </div>
                  </div>

                  <div className="card-actions justify-end pt-4">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSaving || !formData.credits || !formData.price}
                    >
                      {isSaving ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Package Status & Actions */}
          <div className="space-y-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">Package Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Active</span>
                    <span className={`badge ${creditPackage.isActive ? 'badge-success' : 'badge-error'}`}>
                      {creditPackage.isActive ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Popular</span>
                    <span className={`badge ${formData.popular ? 'badge-secondary' : 'badge-outline'}`}>
                      {formData.popular ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Best Value</span>
                    <span className={`badge ${formData.bestValue ? 'badge-accent' : 'badge-outline'}`}>
                      {formData.bestValue ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg text-error">Danger Zone</h3>
                <p className="text-sm opacity-70 mb-4">
                  Deleting this package will permanently remove it from the system. This action cannot be undone.
                </p>
                <button
                  className="btn btn-error btn-sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Deleting...
                    </>
                  ) : (
                    'Delete Package'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
