'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface AIProvider {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio';
  isActive: boolean;
  priority: number;
  costPerToken?: number;
  costPerImage?: number;
  costPerSecond?: number;
  dailyUsage: number;
  monthlyUsage: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

interface UsageData {
  date: string;
  textTokens: number;
  imageGenerations: number;
  audioSeconds: number;
  totalCost: number;
}

interface TokenUsage {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requests: number;
}

export default function AIUsagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'costs'>('overview');

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

      fetchAIUsageData();
    }
  }, [status, session, router, timePeriod]);

  const fetchAIUsageData = async () => {
    try {
      setIsLoading(true);
      
      // Mock data for now - replace with actual API calls
      const mockProviders: AIProvider[] = [
        {
          id: '1',
          name: 'OpenAI GPT-4',
          type: 'text',
          isActive: true,
          priority: 1,
          costPerToken: 0.00003,
          dailyUsage: 850000,
          monthlyUsage: 24500000,
          dailyLimit: 1000000,
          monthlyLimit: 30000000
        },
        {
          id: '2',
          name: 'OpenAI DALL-E 3',
          type: 'image',
          isActive: true,
          priority: 1,
          costPerImage: 0.04,
          dailyUsage: 245,
          monthlyUsage: 7340,
          dailyLimit: 500,
          monthlyLimit: 15000
        },
        {
          id: '3',
          name: 'Google Vertex AI',
          type: 'text',
          isActive: true,
          priority: 2,
          costPerToken: 0.000025,
          dailyUsage: 120000,
          monthlyUsage: 3600000,
          dailyLimit: 500000,
          monthlyLimit: 15000000
        },
        {
          id: '4',
          name: 'Azure OpenAI',
          type: 'text',
          isActive: false,
          priority: 3,
          costPerToken: 0.000035,
          dailyUsage: 0,
          monthlyUsage: 0,
          dailyLimit: 200000,
          monthlyLimit: 6000000
        },
        {
          id: '5',
          name: 'ElevenLabs TTS',
          type: 'audio',
          isActive: true,
          priority: 1,
          costPerSecond: 0.0024,
          dailyUsage: 3600,
          monthlyUsage: 108000,
          dailyLimit: 7200,
          monthlyLimit: 216000
        }
      ];

      const mockUsageData: UsageData[] = [
        { date: '2025-01-01', textTokens: 850000, imageGenerations: 245, audioSeconds: 3600, totalCost: 35.2 },
        { date: '2024-12-31', textTokens: 920000, imageGenerations: 278, audioSeconds: 4200, totalCost: 42.1 },
        { date: '2024-12-30', textTokens: 780000, imageGenerations: 189, audioSeconds: 2800, totalCost: 28.9 },
        { date: '2024-12-29', textTokens: 1100000, imageGenerations: 312, audioSeconds: 5400, totalCost: 51.3 },
        { date: '2024-12-28', textTokens: 650000, imageGenerations: 156, audioSeconds: 2200, totalCost: 22.7 },
        { date: '2024-12-27', textTokens: 890000, imageGenerations: 234, audioSeconds: 3800, totalCost: 37.8 },
        { date: '2024-12-26', textTokens: 1200000, imageGenerations: 356, audioSeconds: 6000, totalCost: 58.4 }
      ];

      const mockTokenUsage: TokenUsage[] = [
        {
          model: 'gpt-4-turbo',
          provider: 'OpenAI',
          inputTokens: 12500000,
          outputTokens: 8900000,
          totalCost: 642.00,
          requests: 15420
        },
        {
          model: 'gpt-3.5-turbo',
          provider: 'OpenAI',
          inputTokens: 45000000,
          outputTokens: 32000000,
          totalCost: 115.50,
          requests: 28950
        },
        {
          model: 'gemini-pro',
          provider: 'Google',
          inputTokens: 3200000,
          outputTokens: 2100000,
          totalCost: 132.50,
          requests: 5678
        },
        {
          model: 'dall-e-3',
          provider: 'OpenAI',
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 293.60,
          requests: 7340
        },
        {
          model: 'eleven-labs-tts',
          provider: 'ElevenLabs',
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 259.20,
          requests: 4320
        }
      ];

      setProviders(mockProviders);
      setUsageData(mockUsageData);
      setTokenUsage(mockTokenUsage);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching AI usage data:', error);
      setIsLoading(false);
    }
  };

  const toggleProviderStatus = (providerId: string) => {
    setProviders(providers => 
      providers.map(provider => 
        provider.id === providerId ? { ...provider, isActive: !provider.isActive } : provider
      )
    );
  };

  const totalDailyCost = usageData.length > 0 ? usageData[0].totalCost : 0;
  const totalMonthlyCost = usageData.reduce((sum, day) => sum + day.totalCost, 0);
  const totalTokens = tokenUsage.reduce((sum, usage) => sum + usage.inputTokens + usage.outputTokens, 0);

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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">AI Usage & Costs</h1>
              <p className="text-base-content/70">Monitor AI provider usage, costs, and performance</p>
            </div>
            
            <div className="form-control">
              <select 
                className="select select-bordered" 
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as '7d' | '30d' | '90d')}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-primary">Daily Cost</h3>
              <p className="text-3xl font-bold">€{totalDailyCost.toFixed(2)}</p>
              <div className="text-sm text-success">-5.2% vs yesterday</div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-secondary">Monthly Cost</h3>
              <p className="text-3xl font-bold">€{totalMonthlyCost.toFixed(2)}</p>
              <div className="text-sm text-warning">Budget: €2,000</div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-accent">Total Tokens</h3>
              <p className="text-3xl font-bold">{(totalTokens / 1000000).toFixed(1)}M</p>
              <div className="text-sm text-info">+12.3% vs last month</div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm text-warning">Active Providers</h3>
              <p className="text-3xl font-bold">{providers.filter(p => p.isActive).length}</p>
              <div className="text-sm text-base-content/70">of {providers.length} total</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-bordered mb-6">
          <a 
            className={`tab tab-lg ${activeTab === 'overview' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Usage Overview
          </a>
          <a 
            className={`tab tab-lg ${activeTab === 'providers' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('providers')}
          >
            Provider Settings
          </a>
          <a 
            className={`tab tab-lg ${activeTab === 'costs' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('costs')}
          >
            Cost Analysis
          </a>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Chart Placeholder */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Daily Usage Trend</h3>
                <div className="h-64 flex items-center justify-center bg-base-200 rounded">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-base-content/70">Usage trend chart would go here</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Usage */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Recent Usage</h3>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Tokens</th>
                        <th>Images</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData.slice(0, 7).map((day) => (
                        <tr key={day.date}>
                          <td className="text-sm">
                            {new Date(day.date).toLocaleDateString()}
                          </td>
                          <td>{(day.textTokens / 1000).toFixed(0)}K</td>
                          <td>{day.imageGenerations}</td>
                          <td className="font-bold">€{day.totalCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Provider Settings Tab */}
        {activeTab === 'providers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {providers.map((provider) => (
              <div key={provider.id} className={`card bg-base-100 shadow-xl ${!provider.isActive ? 'opacity-60' : ''}`}>
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="card-title">{provider.name}</h3>
                      <div className="badge badge-outline capitalize">{provider.type}</div>
                    </div>
                    <div className="form-control">
                      <input 
                        type="checkbox" 
                        className="toggle toggle-primary" 
                        checked={provider.isActive}
                        onChange={() => toggleProviderStatus(provider.id)}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="text-sm opacity-70 mb-2">Daily Usage</div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-bold">
                        {provider.type === 'text' && `${(provider.dailyUsage / 1000).toFixed(0)}K tokens`}
                        {provider.type === 'image' && `${provider.dailyUsage} images`}
                        {provider.type === 'audio' && `${(provider.dailyUsage / 60).toFixed(0)} minutes`}
                      </span>
                      <span className="text-sm">
                        {provider.dailyLimit && 
                          `${((provider.dailyUsage / provider.dailyLimit) * 100).toFixed(0)}%`
                        }
                      </span>
                    </div>
                    {provider.dailyLimit && (
                      <progress 
                        className="progress progress-primary w-full" 
                        value={provider.dailyUsage} 
                        max={provider.dailyLimit}
                      ></progress>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <div className="text-sm opacity-70">Cost Structure</div>
                    <div className="text-sm">
                      {provider.costPerToken && `€${provider.costPerToken.toFixed(6)} per token`}
                      {provider.costPerImage && `€${provider.costPerImage.toFixed(3)} per image`}
                      {provider.costPerSecond && `€${provider.costPerSecond.toFixed(4)} per second`}
                    </div>
                  </div>
                  
                  <div className="card-actions mt-4">
                    <button className="btn btn-sm btn-outline">Configure</button>
                    <button className="btn btn-sm btn-ghost">Analytics</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cost Analysis Tab */}
        {activeTab === 'costs' && (
          <div>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="card-title">Cost Breakdown by Model</h3>
                  <button className="btn btn-sm btn-outline">Export Report</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Provider</th>
                        <th>Input Tokens</th>
                        <th>Output Tokens</th>
                        <th>Requests</th>
                        <th>Total Cost</th>
                        <th>Avg Cost/Request</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsage.map((usage) => (
                        <tr key={usage.model}>
                          <td className="font-medium">{usage.model}</td>
                          <td>{usage.provider}</td>
                          <td>{usage.inputTokens > 0 ? `${(usage.inputTokens / 1000000).toFixed(2)}M` : '-'}</td>
                          <td>{usage.outputTokens > 0 ? `${(usage.outputTokens / 1000000).toFixed(2)}M` : '-'}</td>
                          <td>{usage.requests.toLocaleString()}</td>
                          <td className="font-bold">€{usage.totalCost.toFixed(2)}</td>
                          <td>€{(usage.totalCost / usage.requests).toFixed(4)}</td>
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
