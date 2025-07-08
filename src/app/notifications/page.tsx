'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface NotificationRule {
  id: string;
  name: string;
  eventType: 'ticket.created' | 'ticket.status_updated' | 'ticket.comment_added';
  channels: string[];
  templateId: string;
  enabled: boolean;
  conditions?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  language: string;
  subject?: string;
  content: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  enabled: boolean;
  config: Record<string, unknown>;
}

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'rules' | 'templates' | 'channels' | 'settings'>('rules');
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    loadNotificationData();
  }, [status, router]);

  const loadNotificationData = async () => {
    try {
      setIsLoading(true);
      
      // Load notification rules
      const rulesResponse = await fetch('/api/notifications/rules');
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData.data || []);
      }

      // Load templates
      const templatesResponse = await fetch('/api/notifications/templates');
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        setTemplates(templatesData.data || []);
      }

      // Load channels
      const channelsResponse = await fetch('/api/notifications/channels');
      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        setChannels(channelsData.data || []);
      }
    } catch (error) {
      console.error('Error loading notification data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/notifications/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setRules(prev => prev.map(rule => 
          rule.id === ruleId ? { ...rule, enabled } : rule
        ));
      } else {
        console.error('Failed to update rule');
      }
    } catch (error) {
      console.error('Error updating rule:', error);
    }
  };

  const toggleChannel = async (channelId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/notifications/channels/${channelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setChannels(prev => prev.map(channel => 
          channel.id === channelId ? { ...channel, enabled } : channel
        ));
      } else {
        console.error('Failed to update channel');
      }
    } catch (error) {
      console.error('Error updating channel:', error);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <AdminHeader />
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
        <AdminFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <AdminHeader />
      
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Notification Management</h1>
          <div className="flex gap-2">
            <Link href="/notifications/rules/new" className="btn btn-primary">
              New Rule
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-bordered mb-6">
          <button 
            className={`tab tab-lg ${activeTab === 'rules' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            Notification Rules
          </button>
          <button 
            className={`tab tab-lg ${activeTab === 'templates' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button 
            className={`tab tab-lg ${activeTab === 'channels' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            Channels
          </button>
          <button 
            className={`tab tab-lg ${activeTab === 'settings' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Notification Rules</h2>
              <p className="text-base-content/70 mb-4">
                Configure when and how notifications are sent for different ticket events.
              </p>
              
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Event Type</th>
                      <th>Channels</th>
                      <th>Template</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="font-medium">{rule.name}</td>
                        <td>
                          <span className="badge badge-outline">
                            {rule.eventType}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {rule.channels.map((channel) => (
                              <span key={channel} className="badge badge-secondary badge-sm">
                                {channel}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{rule.templateId}</td>
                        <td>
                          <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={rule.enabled}
                            onChange={(e) => toggleRule(rule.id, e.target.checked)}
                          />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link 
                              href={`/notifications/rules/${rule.id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              Edit
                            </Link>
                            <button className="btn btn-ghost btn-sm text-error">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Notification Templates</h2>
              <p className="text-base-content/70 mb-4">
                Manage templates used for different types of notifications.
              </p>
              
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Language</th>
                      <th>Subject</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id}>
                        <td className="font-medium">{template.name}</td>
                        <td>
                          <span className="badge badge-outline">
                            {template.type}
                          </span>
                        </td>
                        <td>{template.language}</td>
                        <td className="truncate max-w-xs">{template.subject}</td>
                        <td>
                          <div className="flex gap-2">
                            <Link 
                              href={`/notifications/templates/${template.id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              Edit
                            </Link>
                            <button className="btn btn-ghost btn-sm">
                              Preview
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Notification Channels</h2>
              <p className="text-base-content/70 mb-4">
                Configure and manage notification delivery channels.
              </p>
              
              <div className="grid gap-4">
                {channels.map((channel) => (
                  <div key={channel.id} className="card bg-base-200">
                    <div className="card-body">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-lg">{channel.name}</h3>
                          <p className="text-base-content/70">
                            Type: {channel.type} | Provider: {channel.config.provider as string}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={channel.enabled}
                            onChange={(e) => toggleChannel(channel.id, e.target.checked)}
                          />
                          <button className="btn btn-ghost btn-sm">
                            Configure
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Notification Settings</h2>
              <p className="text-base-content/70 mb-4">
                Global notification settings and preferences.
              </p>
              
              <div className="space-y-6">
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Enable notifications globally</span>
                    <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                  </label>
                </div>
                
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Send notifications to admins</span>
                    <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                  </label>
                </div>
                
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Send notifications to customers</span>
                    <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                  </label>
                </div>

                <div className="divider"></div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Notification Engine URL</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="http://localhost:3002" 
                    className="input input-bordered" 
                    defaultValue={process.env.NOTIFICATION_ENGINE_URL || ''}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">API Key</span>
                  </label>
                  <input 
                    type="password" 
                    placeholder="••••••••••••••••" 
                    className="input input-bordered" 
                  />
                </div>

                <div className="card-actions justify-end">
                  <button className="btn btn-primary">Save Settings</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AdminFooter />
    </div>
  );
}
