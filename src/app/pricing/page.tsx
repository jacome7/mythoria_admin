'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';
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



export default function PricingPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchCreditPackages();
    }
  }, [loading, session]);

  const fetchCreditPackages = async () => {
    try {
      const response = await fetch('/api/credit-packages');
      if (!response.ok) {
        throw new Error('Failed to fetch credit packages');
      }
      
      const data = await response.json();
      setCreditPackages(data.creditPackages || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching credit packages:', error);
      setIsLoading(false);
    }
  };

  const togglePackageStatus = async (packageId: string) => {
    try {
      const response = await fetch(`/api/credit-packages/${packageId}/toggle`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle package status');
      }
      
      // Refresh the data
      await fetchCreditPackages();
    } catch (error) {
      console.error('Error toggling package status:', error);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <AdminHeader />
        <main className="container mx-auto p-6">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
        <AdminFooter />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <AdminHeader />
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-base-content mb-2">Credit Package Management</h1>
          <p className="text-base-content/70">Manage credit packages (sorted by price)</p>
        </div>

        {/* Credit Packages */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Credit Packages</h2>
            <button 
              className="btn btn-primary"
              onClick={() => router.push('/pricing/add')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Package
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {creditPackages.map((pkg) => (
              <div key={pkg.id} className={`card bg-base-100 shadow-xl ${!pkg.isActive ? 'opacity-60' : ''}`}>
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <h3 className="card-title">{pkg.credits} Credits</h3>
                    </div>
                    <div className="form-control">
                      <input 
                        type="checkbox" 
                        className="toggle toggle-primary" 
                        checked={pkg.isActive}
                        onChange={() => togglePackageStatus(pkg.id)}
                      />
                    </div>
                  </div>
                  
                  <div className="my-4">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold">€{parseFloat(pkg.price).toFixed(2)}</span>
                    </div>
                    <div className="text-sm opacity-70">{pkg.credits} story credits</div>
                    <div className="mt-2 flex gap-2">
                      {pkg.popular && (
                        <div className="badge badge-secondary">Popular</div>
                      )}
                      {pkg.bestValue && (
                        <div className="badge badge-accent">Best Value</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm opacity-70">
                      <div>Package Key: <span className="font-mono">{pkg.key}</span></div>
                      <div>Cost per Credit: €{(parseFloat(pkg.price) / pkg.credits).toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="card-actions">
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => router.push(`/pricing/edit/${pkg.id}`)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  );
}
