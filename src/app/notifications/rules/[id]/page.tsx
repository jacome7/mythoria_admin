'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface NotificationRule {
  id?: string;
  name: string;
  eventType: 'ticket.created' | 'ticket.status_updated' | 'ticket.comment_added';
  channels: string[];
  templateId: string;
  enabled: boolean;
  conditions?: {
    ticketType?: string[];
    priority?: string[];
    status?: string[];
  };
  recipients?: {
    includeAdmins: boolean;
    includeCustomers: boolean;
    customEmails: string[];
  };
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  language: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  enabled: boolean;
}

export default function NotificationRulePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const isEditing = params?.id !== 'new';
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  
  const [rule, setRule] = useState<NotificationRule>({
    name: '',
    eventType: 'ticket.created',
    channels: ['email'],
    templateId: '',
    enabled: true,
    conditions: {
      ticketType: [],
      priority: [],
      status: [],
    },
    recipients: {
      includeAdmins: true,
      includeCustomers: true,
      customEmails: [],
    },
  });

  const [customEmail, setCustomEmail] = useState('');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load templates and channels
      const [templatesResponse, channelsResponse] = await Promise.all([
        fetch('/api/notifications/templates'),
        fetch('/api/notifications/channels')
      ]);
      
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        setTemplates(templatesData.data || []);
        
        // Set default template if available and not editing
        if (!isEditing && templatesData.data && templatesData.data.length > 0) {
          setRule(prev => ({ ...prev, templateId: templatesData.data[0].id }));
        }
      }
      
      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        setChannels(channelsData.data?.filter((c: NotificationChannel) => c.enabled) || []);
      }

      // If editing, load the existing rule
      if (isEditing && params?.id) {
        const ruleResponse = await fetch(`/api/notifications/rules/${params.id}`);
        if (ruleResponse.ok) {
          const ruleData = await ruleResponse.json();
          setRule(ruleData.data);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isEditing, params?.id]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    loadData();
  }, [status, router, loadData]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const url = isEditing 
        ? `/api/notifications/rules/${params?.id}`
        : '/api/notifications/rules';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      });

      if (response.ok) {
        router.push('/notifications');
      } else {
        const errorData = await response.json();
        console.error('Failed to save rule:', errorData);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    setRule(prev => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter(id => id !== channelId)
        : [...prev.channels, channelId]
    }));
  };

  const handleConditionToggle = (type: 'ticketType' | 'priority' | 'status', value: string) => {
    setRule(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        [type]: prev.conditions?.[type]?.includes(value)
          ? prev.conditions[type]?.filter(v => v !== value) || []
          : [...(prev.conditions?.[type] || []), value]
      }
    }));
  };

  const addCustomEmail = () => {
    if (customEmail.trim() && !rule.recipients?.customEmails.includes(customEmail.trim())) {
      setRule(prev => ({
        ...prev,
        recipients: {
          ...prev.recipients!,
          customEmails: [...prev.recipients!.customEmails, customEmail.trim()]
        }
      }));
      setCustomEmail('');
    }
  };

  const removeCustomEmail = (email: string) => {
    setRule(prev => ({
      ...prev,
      recipients: {
        ...prev.recipients!,
        customEmails: prev.recipients!.customEmails.filter(e => e !== email)
      }
    }));
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      
      <div className="container mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/notifications" className="btn btn-ghost">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Notification Rule' : 'Create Notification Rule'}
          </h1>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Rule Name</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter rule name"
                    className="input input-bordered"
                    value={rule.name}
                    onChange={(e) => setRule(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Event Type</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={rule.eventType}
                    onChange={(e) => setRule(prev => ({ 
                      ...prev, 
                      eventType: e.target.value as NotificationRule['eventType']
                    }))}
                  >
                    <option value="ticket.created">Ticket Created</option>
                    <option value="ticket.status_updated">Ticket Status Updated</option>
                    <option value="ticket.comment_added">Comment Added</option>
                  </select>
                </div>
              </div>

              {/* Template Selection */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Template</span>
                </label>
                <select
                  className="select select-bordered"
                  value={rule.templateId}
                  onChange={(e) => setRule(prev => ({ ...prev, templateId: e.target.value }))}
                >
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Channels */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Notification Channels</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {channels.map((channel) => (
                    <label key={channel.id} className="cursor-pointer label">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={rule.channels.includes(channel.id)}
                        onChange={() => handleChannelToggle(channel.id)}
                      />
                      <span className="label-text ml-2">{channel.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Conditions (Optional)</h3>
                <p className="text-sm text-base-content/70">
                  Only send notifications when these conditions are met. Leave empty to send for all events.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Ticket Type */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Ticket Type</span>
                    </label>
                    <div className="space-y-2">
                      {['contact', 'print_request', 'buy_credits', 'other'].map((type) => (
                        <label key={type} className="cursor-pointer label justify-start">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={rule.conditions?.ticketType?.includes(type) || false}
                            onChange={() => handleConditionToggle('ticketType', type)}
                          />
                          <span className="label-text ml-2 capitalize">{type.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Priority</span>
                    </label>
                    <div className="space-y-2">
                      {['low', 'medium', 'high', 'urgent'].map((priority) => (
                        <label key={priority} className="cursor-pointer label justify-start">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={rule.conditions?.priority?.includes(priority) || false}
                            onChange={() => handleConditionToggle('priority', priority)}
                          />
                          <span className="label-text ml-2 capitalize">{priority}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Status</span>
                    </label>
                    <div className="space-y-2">
                      {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                        <label key={status} className="cursor-pointer label justify-start">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={rule.conditions?.status?.includes(status) || false}
                            onChange={() => handleConditionToggle('status', status)}
                          />
                          <span className="label-text ml-2 capitalize">{status.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipients */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recipients</h3>
                
                <div className="space-y-2">
                  <label className="cursor-pointer label justify-start">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={rule.recipients?.includeAdmins || false}
                      onChange={(e) => setRule(prev => ({
                        ...prev,
                        recipients: {
                          ...prev.recipients!,
                          includeAdmins: e.target.checked
                        }
                      }))}
                    />
                    <span className="label-text ml-2">Include Admins</span>
                  </label>

                  <label className="cursor-pointer label justify-start">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={rule.recipients?.includeCustomers || false}
                      onChange={(e) => setRule(prev => ({
                        ...prev,
                        recipients: {
                          ...prev.recipients!,
                          includeCustomers: e.target.checked
                        }
                      }))}
                    />
                    <span className="label-text ml-2">Include Customers</span>
                  </label>
                </div>

                {/* Custom Emails */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Additional Email Recipients</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Enter email address"
                      className="input input-bordered flex-1"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCustomEmail()}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={addCustomEmail}
                    >
                      Add
                    </button>
                  </div>
                  
                  {rule.recipients?.customEmails && rule.recipients.customEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rule.recipients.customEmails.map((email) => (
                        <div key={email} className="badge badge-secondary gap-2">
                          {email}
                          <button
                            type="button"
                            className="btn btn-ghost btn-circle btn-xs"
                            onClick={() => removeCustomEmail(email)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Enable/Disable */}
              <div className="form-control">
                <label className="cursor-pointer label justify-start">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={rule.enabled}
                    onChange={(e) => setRule(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span className="label-text ml-2">Enable this rule</span>
                </label>
              </div>

              {/* Actions */}
              <div className="card-actions justify-end">
                <Link href="/notifications" className="btn btn-ghost">
                  Cancel
                </Link>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={isSaving || !rule.name || !rule.templateId}
                >
                  {isSaving && <span className="loading loading-spinner loading-sm"></span>}
                  {isEditing ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
