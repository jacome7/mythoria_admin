'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

export default function AddCreditPackagePage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    credits: 0,
    price: '',
    popular: false,
    bestValue: false,
  });

  useEffect(() => {
    if (!loading && !session?.user) {
      router.push('/auth/signin');
    }
  }, [loading, session, router]);

  const calculateCostPerCredit = () => {
    if (formData.credits > 0 && formData.price && parseFloat(formData.price) > 0) {
      return (parseFloat(formData.price) / formData.credits).toFixed(2);
    }
    return '0.00';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/credit-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: formData.key,
          credits: formData.credits,
          price: formData.price,
          popular: formData.popular,
          bestValue: formData.bestValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create credit package');
      }

      router.push('/pricing');
    } catch (error) {
      console.error('Error creating credit package:', error);
      alert('Error creating credit package. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/pricing');
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold text-base-content">Add New Credit Package</h1>
          <p className="text-base-content/70">Create a new credit package for customers</p>
        </div>

        <div className="card bg-base-100 shadow-xl max-w-2xl">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Package Key *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="e.g., starter-pack, premium-bundle"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  required
                />
                <label className="label">
                  <span className="label-text-alt">Unique identifier for this package</span>
                </label>
              </div>

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
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading || !formData.key || !formData.credits || !formData.price}
                >
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Creating...
                    </>
                  ) : (
                    'Create Package'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
