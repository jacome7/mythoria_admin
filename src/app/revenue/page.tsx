'use client';

import { useEffect, useState } from 'react';
import { formatAdminDate } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface RevenueData {
  period: string;
  revenue: number;
  transactions: number;
  averageOrderValue: number;
  refunds: number;
}

interface TopProduct {
  name: string;
  revenue: number;
  units: number;
  percentage: number;
}

interface PaymentMethod {
  method: string;
  revenue: number;
  transactions: number;
  percentage: number;
}

export default function RevenuePage() {
  const { session, loading } = useAdminAuth();
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    if (!loading && session?.user) {
      fetchRevenueData();
    }
  }, [loading, session, timePeriod]);

  const fetchRevenueData = async () => {
    try {
      setIsLoading(true);

      // Mock data for now - replace with actual API calls
      const mockRevenueData: RevenueData[] = [
        {
          period: '2025-01-01',
          revenue: 1250.0,
          transactions: 45,
          averageOrderValue: 27.78,
          refunds: 2,
        },
        {
          period: '2024-12-31',
          revenue: 2100.5,
          transactions: 78,
          averageOrderValue: 26.93,
          refunds: 1,
        },
        {
          period: '2024-12-30',
          revenue: 1890.25,
          transactions: 62,
          averageOrderValue: 30.49,
          refunds: 3,
        },
        {
          period: '2024-12-29',
          revenue: 2450.75,
          transactions: 89,
          averageOrderValue: 27.54,
          refunds: 0,
        },
        {
          period: '2024-12-28',
          revenue: 1675.0,
          transactions: 56,
          averageOrderValue: 29.91,
          refunds: 4,
        },
        {
          period: '2024-12-27',
          revenue: 3200.25,
          transactions: 112,
          averageOrderValue: 28.57,
          refunds: 2,
        },
        {
          period: '2024-12-26',
          revenue: 2890.5,
          transactions: 95,
          averageOrderValue: 30.43,
          refunds: 1,
        },
      ];

      const mockTopProducts: TopProduct[] = [
        { name: 'Creator Pack (15 Credits)', revenue: 4567.5, units: 183, percentage: 35.2 },
        { name: 'Family Pack (35 Credits)', revenue: 3894.75, units: 78, percentage: 30.1 },
        { name: 'Starter Pack (5 Credits)', revenue: 2234.25, units: 224, percentage: 17.3 },
        { name: 'Enterprise (150 Credits)', revenue: 1999.8, units: 10, percentage: 15.4 },
        { name: 'Custom Solutions', revenue: 249.9, units: 1, percentage: 2.0 },
      ];

      const mockPaymentMethods: PaymentMethod[] = [
        { method: 'Credit Card', revenue: 8234.5, transactions: 387, percentage: 63.6 },
        { method: 'PayPal', revenue: 2890.75, transactions: 95, percentage: 22.3 },
        { method: 'Apple Pay', revenue: 1234.25, transactions: 42, percentage: 9.5 },
        { method: 'Google Pay', revenue: 587.7, transactions: 19, percentage: 4.5 },
        { method: 'Bank Transfer', revenue: 8.0, transactions: 1, percentage: 0.1 },
      ];

      setRevenueData(mockRevenueData);
      setTopProducts(mockTopProducts);
      setPaymentMethods(mockPaymentMethods);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      setIsLoading(false);
    }
  };

  const totalRevenue = revenueData.reduce((sum, day) => sum + day.revenue, 0);
  const totalTransactions = revenueData.reduce((sum, day) => sum + day.transactions, 0);
  const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const totalRefunds = revenueData.reduce((sum, day) => sum + day.refunds, 0);

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

  return (
    <div className="min-h-screen bg-base-200">
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">Revenue Analytics</h1>
              <p className="text-base-content/70">Track sales performance and revenue metrics</p>
            </div>

            <div className="form-control">
              <select
                className="select select-bordered"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as '7d' | '30d' | '90d' | '1y')}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-primary">Total Revenue</h3>
              <p className="text-3xl font-bold">
                €{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="text-sm text-success">+12.5% vs previous period</div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-secondary">Transactions</h3>
              <p className="text-3xl font-bold">{totalTransactions.toLocaleString()}</p>
              <div className="text-sm text-success">+8.3% vs previous period</div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-accent">Avg Order Value</h3>
              <p className="text-3xl font-bold">€{averageOrderValue.toFixed(2)}</p>
              <div className="text-sm text-success">+3.2% vs previous period</div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-warning">Refunds</h3>
              <p className="text-3xl font-bold">{totalRefunds}</p>
              <div className="text-sm text-error">+1 vs previous period</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart Placeholder */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Revenue Trend</h3>
              <div className="h-64 flex items-center justify-center bg-base-200 rounded">
                <div className="text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <p className="text-base-content/70">Revenue chart would go here</p>
                  <p className="text-sm text-base-content/50">
                    Integration with charting library needed
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Top Products</h3>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="badge badge-primary badge-sm mr-3">{index + 1}</div>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-base-content/70">
                          {product.units} units sold
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        €{product.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-base-content/70">{product.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Methods */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Payment Methods</h3>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.method} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{method.method}</div>
                      <div className="text-sm text-base-content/70">
                        {method.transactions} transactions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        €{method.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-base-content/70">{method.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center mb-4">
                <h3 className="card-title">Daily Revenue</h3>
                <button className="btn btn-sm btn-outline">Export</button>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Revenue</th>
                      <th>Orders</th>
                      <th>AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.slice(0, 7).map((day) => (
                      <tr key={day.period}>
                        <td className="text-sm">{formatAdminDate(day.period)}</td>
                        <td className="font-bold">
                          €{day.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td>{day.transactions}</td>
                        <td>€{day.averageOrderValue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
