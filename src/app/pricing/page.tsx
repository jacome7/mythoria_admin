'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  credits: number;
  features: string[];
  isActive: boolean;
  discountPercentage?: number;
  sortOrder: number;
}

interface CouponCode {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
}

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [couponCodes, setCouponCodes] = useState<CouponCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tiers' | 'coupons'>('tiers');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user) {
      const allowedDomains = ["@mythoria.pt", "@caravanconcierge.com"];
      const isAllowedDomain = allowedDomains.some(domain => 
        session.user?.email?.endsWith(domain)
      );

      if (!isAllowedDomain) {
        router.push('/auth/error');
        return;
      }

      fetchPricingData();
    }
  }, [status, session, router]);

  const fetchPricingData = async () => {
    try {
      // Mock data for now - replace with actual API calls
      const mockTiers: PricingTier[] = [
        {
          id: '1',
          name: 'Starter Pack',
          description: 'Perfect for trying out Mythoria',
          price: 9.99,
          currency: 'EUR',
          credits: 5,
          features: ['5 Story Credits', 'Basic Templates', 'Email Support'],
          isActive: true,
          sortOrder: 1
        },
        {
          id: '2',
          name: 'Creator Pack',
          description: 'Best value for regular storytellers',
          price: 24.99,
          currency: 'EUR',
          credits: 15,
          features: ['15 Story Credits', 'All Templates', 'Priority Support', '10% Bonus Credits'],
          isActive: true,
          discountPercentage: 15,
          sortOrder: 2
        },
        {
          id: '3',
          name: 'Family Pack',
          description: 'Great for families and multiple users',
          price: 49.99,
          currency: 'EUR',
          credits: 35,
          features: ['35 Story Credits', 'All Templates', 'Priority Support', '20% Bonus Credits', 'Family Sharing'],
          isActive: true,
          discountPercentage: 25,
          sortOrder: 3
        },
        {
          id: '4',
          name: 'Enterprise',
          description: 'Custom solutions for businesses',
          price: 199.99,
          currency: 'EUR',
          credits: 150,
          features: ['150 Story Credits', 'Custom Templates', 'Dedicated Support', 'White Label Options', 'Analytics Dashboard'],
          isActive: true,
          sortOrder: 4
        }
      ];

      const mockCoupons: CouponCode[] = [
        {
          id: '1',
          code: 'WELCOME2025',
          description: 'New Year Welcome Discount',
          discountType: 'percentage',
          discountValue: 20,
          expiresAt: '2025-01-31T23:59:59Z',
          usageLimit: 1000,
          usageCount: 234,
          isActive: true
        },
        {
          id: '2',
          code: 'FAMILY50',
          description: 'Family Pack Special Offer',
          discountType: 'fixed',
          discountValue: 10,
          expiresAt: '2025-02-14T23:59:59Z',
          usageLimit: 500,
          usageCount: 87,
          isActive: true
        },
        {
          id: '3',
          code: 'BLACKFRIDAY',
          description: 'Black Friday 2024 (Expired)',
          discountType: 'percentage',
          discountValue: 50,
          expiresAt: '2024-11-30T23:59:59Z',
          usageLimit: 2000,
          usageCount: 1847,
          isActive: false
        }
      ];

      setPricingTiers(mockTiers);
      setCouponCodes(mockCoupons);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching pricing data:', error);
      setIsLoading(false);
    }
  };

  const toggleTierStatus = (tierId: string) => {
    setPricingTiers(tiers => 
      tiers.map(tier => 
        tier.id === tierId ? { ...tier, isActive: !tier.isActive } : tier
      )
    );
  };

  const toggleCouponStatus = (couponId: string) => {
    setCouponCodes(coupons => 
      coupons.map(coupon => 
        coupon.id === couponId ? { ...coupon, isActive: !coupon.isActive } : coupon
      )
    );
  };

  if (status === 'loading' || isLoading) {
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

  return (
    <div className="min-h-screen bg-base-200">
      <AdminHeader />
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-base-content mb-2">Pricing Management</h1>
          <p className="text-base-content/70">Manage pricing tiers, discounts, and coupon codes</p>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-bordered mb-6">
          <a 
            className={`tab tab-lg ${activeTab === 'tiers' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('tiers')}
          >
            Pricing Tiers
          </a>
          <a 
            className={`tab tab-lg ${activeTab === 'coupons' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('coupons')}
          >
            Coupon Codes
          </a>
        </div>

        {/* Pricing Tiers Tab */}
        {activeTab === 'tiers' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Pricing Tiers</h2>
              <button className="btn btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Tier
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {pricingTiers.map((tier) => (
                <div key={tier.id} className={`card bg-base-100 shadow-xl ${!tier.isActive ? 'opacity-60' : ''}`}>
                  <div className="card-body">
                    <div className="flex justify-between items-start">
                      <h3 className="card-title">{tier.name}</h3>
                      <div className="form-control">
                        <input 
                          type="checkbox" 
                          className="toggle toggle-primary" 
                          checked={tier.isActive}
                          onChange={() => toggleTierStatus(tier.id)}
                        />
                      </div>
                    </div>
                    
                    <p className="text-sm opacity-70">{tier.description}</p>
                    
                    <div className="my-4">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-bold">{tier.price}</span>
                        <span className="ml-1 text-lg">{tier.currency}</span>
                      </div>
                      <div className="text-sm opacity-70">{tier.credits} credits</div>
                      {tier.discountPercentage && (
                        <div className="badge badge-secondary mt-2">
                          {tier.discountPercentage}% bonus
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2">Features:</h4>
                      <ul className="text-sm space-y-1">
                        {tier.features.map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-success" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="card-actions">
                      <button className="btn btn-sm btn-outline">Edit</button>
                      <button className="btn btn-sm btn-ghost">Analytics</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coupon Codes Tab */}
        {activeTab === 'coupons' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Coupon Codes</h2>
              <button className="btn btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Coupon
              </button>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Description</th>
                        <th>Discount</th>
                        <th>Usage</th>
                        <th>Expires</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {couponCodes.map((coupon) => (
                        <tr key={coupon.id} className={!coupon.isActive ? 'opacity-60' : ''}>
                          <td>
                            <div className="font-mono font-bold">{coupon.code}</div>
                          </td>
                          <td>{coupon.description}</td>
                          <td>
                            {coupon.discountType === 'percentage' 
                              ? `${coupon.discountValue}%` 
                              : `${coupon.discountValue} EUR`
                            }
                          </td>
                          <td>
                            <div className="text-sm">
                              <div>{coupon.usageCount.toLocaleString()}</div>
                              {coupon.usageLimit && (
                                <div className="text-xs opacity-50">
                                  / {coupon.usageLimit.toLocaleString()} limit
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            {coupon.expiresAt ? (
                              <div className="text-sm">
                                {new Date(coupon.expiresAt).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-xs opacity-50">No expiration</span>
                            )}
                          </td>
                          <td>
                            <div className="form-control">
                              <input 
                                type="checkbox" 
                                className="toggle toggle-sm toggle-primary" 
                                checked={coupon.isActive}
                                onChange={() => toggleCouponStatus(coupon.id)}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button className="btn btn-ghost btn-xs">Edit</button>
                              <button className="btn btn-ghost btn-xs">Analytics</button>
                              <button className="btn btn-ghost btn-xs text-error">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <AdminFooter />
    </div>
  );
}
