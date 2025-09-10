'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

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

interface ActionUsage {
  action: string;
  totalCost: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  uniqueStories: number;
  averageCostPerRequest: number;
  averageCostPerStory: number;
}

export default function AIUsagePage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [actionUsage, setActionUsage] = useState<ActionUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<'1d' | '7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'costs'>('overview');

  // Helper function to get action icon and description
  const getActionInfo = (action: string) => {
    const actionMap: Record<string, { icon: string; name: string; description: string }> = {
      'story_structure': { icon: '🏗️', name: 'Story Structure', description: 'Creating the story framework and plot' },
      'story_outline': { icon: '📋', name: 'Story Outline', description: 'Generating story outlines and summaries' },
      'chapter_writing': { icon: '✍️', name: 'Chapter Writing', description: 'Writing story chapters and content' },
      'image_generation': { icon: '🎨', name: 'Image Generation', description: 'Creating story illustrations and images' },
      'story_review': { icon: '🔍', name: 'Story Review', description: 'Reviewing and analyzing story content' },
      'character_generation': { icon: '👤', name: 'Character Generation', description: 'Creating characters and personas' },
      'story_enhancement': { icon: '✨', name: 'Story Enhancement', description: 'Improving and refining story content' },
      'audio_generation': { icon: '🎵', name: 'Audio Generation', description: 'Creating audio content and narration' },
      'content_validation': { icon: '✅', name: 'Content Validation', description: 'Validating content quality and safety' },
      'image_edit': { icon: '🖼️', name: 'Image Editing', description: 'Editing and modifying images' },
      'test': { icon: '🧪', name: 'Test', description: 'Testing and experimental features' }
    };
    return actionMap[action] || { icon: '📝', name: action.replace(/_/g, ' '), description: 'AI action' };
  };

  const fetchAIUsageData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch real token usage stats from API
      const response = await fetch(`/api/ai-usage/stats?period=${timePeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch AI usage data');
      }
      
      const data = await response.json();
      
      // Transform the real data to match the existing UI structure
      
      // Convert model breakdown to provider format for backward compatibility
      const transformedProviders: AIProvider[] = data.modelBreakdown.map((model: { model: string; totalTokens: number; averageCostPerRequest: number; inputTokens: number; outputTokens: number; totalCost: number; requests: number }, index: number) => ({
        id: (index + 1).toString(),
        name: model.model,
        type: 'text' as const, // Most models are text-based
        isActive: true,
        priority: index + 1,
        costPerToken: model.averageCostPerRequest / (model.totalTokens || 1),
        dailyUsage: Math.round(model.totalTokens / (timePeriod === '1d' ? 1 : timePeriod === '7d' ? 7 : timePeriod === '30d' ? 30 : 90)),
        monthlyUsage: model.totalTokens,
        dailyLimit: undefined,
        monthlyLimit: undefined
      }));

      // Transform daily usage data
      const transformedUsageData: UsageData[] = data.dailyUsage.map((day: { date: string; totalTokens: number; totalCost: number }) => ({
        date: day.date,
        textTokens: Number(day.totalTokens) || 0,
        imageGenerations: 0, // Will need to be calculated based on action types
        audioSeconds: 0, // Will need to be calculated based on action types
        totalCost: Number(day.totalCost) || 0
      }));

      // Transform model breakdown to token usage format
      const transformedTokenUsage: TokenUsage[] = data.modelBreakdown.map((model: { model: string; inputTokens: number; outputTokens: number; totalCost: number; requests: number }) => ({
        model: model.model,
        provider: model.model.includes('gpt') ? 'OpenAI' : 
                  model.model.includes('gemini') ? 'Google' : 
                  model.model.includes('claude') ? 'Anthropic' : 'Unknown',
        inputTokens: Number(model.inputTokens) || 0,
        outputTokens: Number(model.outputTokens) || 0,
        totalCost: Number(model.totalCost) || 0,
        requests: Number(model.requests) || 0
      }));

      // Transform action breakdown data
      const transformedActionUsage: ActionUsage[] = data.actionBreakdown.map((action: { action: string; totalCost: number; requests: number; inputTokens: number; outputTokens: number; uniqueStories: number; averageCostPerRequest: number; averageCostPerStory: number }) => ({
        action: action.action,
        totalCost: Number(action.totalCost) || 0,
        requests: Number(action.requests) || 0,
        inputTokens: Number(action.inputTokens) || 0,
        outputTokens: Number(action.outputTokens) || 0,
        uniqueStories: Number(action.uniqueStories) || 0,
        averageCostPerRequest: Number(action.averageCostPerRequest) || 0,
        averageCostPerStory: Number(action.averageCostPerStory) || 0
      }));

      setProviders(transformedProviders);
      setUsageData(transformedUsageData);
      setTokenUsage(transformedTokenUsage);
      setActionUsage(transformedActionUsage);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching AI usage data:', error);
      
      // Provide fallback empty data to prevent UI errors
      setProviders([]);
      setUsageData([]);
      setTokenUsage([]);
      setActionUsage([]);
      setIsLoading(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    if (!loading && session?.user) {
      fetchAIUsageData();
    }
  }, [loading, session, timePeriod, fetchAIUsageData]);

  const toggleProviderStatus = (providerId: string) => {
    setProviders(providers => 
      providers.map(provider => 
        provider.id === providerId ? { ...provider, isActive: !provider.isActive } : provider
      )
    );
  };

  const totalDailyCost = usageData.length > 0 ? Number(usageData[0].totalCost) || 0 : 0;
  const totalMonthlyCost = usageData.reduce((sum, day) => sum + (Number(day.totalCost) || 0), 0);
  const totalTokens = tokenUsage.reduce((sum, usage) => sum + (Number(usage.inputTokens) || 0) + (Number(usage.outputTokens) || 0), 0);

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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-base-content mb-2">AI Usage & Costs</h1>
              <p className="text-base-content/70">Monitor AI provider usage, costs, and performance</p>
            </div>
            
            <div className="form-control">
              <select 
                className="select select-bordered" 
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as '1d' | '7d' | '30d' | '90d')}
              >
                <option value="1d">Last 24 hours</option>
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
                  <h3 className="card-title">Cost Breakdown by Action</h3>
                  <button className="btn btn-sm btn-outline">Export Report</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Input Tokens</th>
                        <th>Output Tokens</th>
                        <th>Requests</th>
                        <th>Stories</th>
                        <th>Total Cost</th>
                        <th>Avg Cost/Request</th>
                        <th>Avg Cost/Story</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actionUsage.map((usage) => {
                        const actionInfo = getActionInfo(usage.action);
                        return (
                          <tr key={usage.action}>
                            <td className="font-medium">
                              <div className="flex items-center space-x-3">
                                <span className="text-lg">{actionInfo.icon}</span>
                                <div>
                                  <div className="font-semibold">{actionInfo.name}</div>
                                  <div className="text-xs text-base-content/60">{actionInfo.description}</div>
                                </div>
                              </div>
                            </td>
                            <td>{usage.inputTokens > 0 ? `${(usage.inputTokens / 1000000).toFixed(2)}M` : '-'}</td>
                            <td>{usage.outputTokens > 0 ? `${(usage.outputTokens / 1000000).toFixed(2)}M` : '-'}</td>
                            <td>{usage.requests.toLocaleString()}</td>
                            <td>
                              <div className="font-semibold">{usage.uniqueStories.toLocaleString()}</div>
                              <div className="text-xs text-base-content/60">unique stories</div>
                            </td>
                            <td className="font-bold">€{usage.totalCost.toFixed(2)}</td>
                            <td>€{usage.averageCostPerRequest.toFixed(4)}</td>
                            <td>
                              <div className="font-bold text-primary text-lg">€{usage.averageCostPerStory.toFixed(3)}</div>
                              <div className="text-xs text-base-content/60">per story</div>
                            </td>
                          </tr>
                        );
                      })}
                      {actionUsage.length > 0 && (
                        <tr className="border-t-2 border-base-300 bg-base-200/50">
                          <td className="font-bold">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">📊</span>
                              <div>Total</div>
                            </div>
                          </td>
                          <td className="font-bold">
                            {(actionUsage.reduce((sum, usage) => sum + usage.inputTokens, 0) / 1000000).toFixed(2)}M
                          </td>
                          <td className="font-bold">
                            {(actionUsage.reduce((sum, usage) => sum + usage.outputTokens, 0) / 1000000).toFixed(2)}M
                          </td>
                          <td className="font-bold">
                            {actionUsage.reduce((sum, usage) => sum + usage.requests, 0).toLocaleString()}
                          </td>
                          <td className="font-bold">
                            {actionUsage.reduce((sum, usage) => sum + usage.uniqueStories, 0).toLocaleString()}
                          </td>
                          <td className="font-bold text-lg">
                            €{actionUsage.reduce((sum, usage) => sum + usage.totalCost, 0).toFixed(2)}
                          </td>
                          <td className="font-bold">
                            €{(
                              actionUsage.reduce((sum, usage) => sum + usage.totalCost, 0) /
                              Math.max(actionUsage.reduce((sum, usage) => sum + usage.requests, 0), 1)
                            ).toFixed(4)}
                          </td>
                          <td className="font-bold text-secondary text-lg">
                            €{(
                              actionUsage.reduce((sum, usage) => sum + usage.totalCost, 0) /
                              Math.max(actionUsage.reduce((sum, usage) => sum + usage.uniqueStories, 0), 1)
                            ).toFixed(3)}
                          </td>
                        </tr>
                      )}
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
