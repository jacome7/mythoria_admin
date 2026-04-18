'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface NotificationTemplate {
  id?: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  language: string;
  eventType: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  variables: string[];
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}


export default function NotificationTemplatePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const isEditing = params?.id !== 'new';
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subject' | 'html' | 'text' | 'preview'>('subject');

  const [template, setTemplate] = useState<NotificationTemplate>({
    name: '',
    type: 'email',
    language: 'en',
    eventType: 'ticket.created',
    subject: '',
    htmlContent: '',
    textContent: '',
    variables: [],
    enabled: true,
  });

  const [previewData] = useState({
    'ticket.id': 'TICKET-123',
    'ticket.subject': 'Sample Ticket Subject',
    'ticket.description': 'This is a sample ticket description for preview purposes.',
    'ticket.status': 'open',
    'ticket.priority': 'medium',
    'ticket.type': 'contact',
    'ticket.createdAt': new Date().toLocaleDateString(),
    'ticket.updatedAt': new Date().toLocaleDateString(),
    'customer.name': 'John Doe',
    'customer.email': 'john.doe@example.com',
    'admin.name': 'Admin User',
    'comment.content': 'This is a sample comment content.',
    'comment.author': 'Support Agent',
    'comment.createdAt': new Date().toLocaleDateString(),
  });

  const loadTemplate = useCallback(async () => {
    try {
      setIsLoading(true);

      if (!isEditing || !params?.id) {
        return;
      }

      const response = await fetch('/api/notifications/templates');
      if (!response.ok) {
        throw new Error(`Failed to load notification templates (${response.status})`);
      }

      const payload = await response.json();
      const existingTemplate = (payload?.data || []).find(
        (candidate: NotificationTemplate) => candidate.id === params.id,
      );

      if (!existingTemplate) {
        router.push('/notifications');
        return;
      }

      setTemplate(existingTemplate);
    } catch (error) {
      console.error('Error loading template:', error);
      router.push('/notifications');
    } finally {
      setIsLoading(false);
    }
  }, [isEditing, params?.id, router]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    loadTemplate();
  }, [status, router, loadTemplate]);

  const handleSave = async () => {
    console.error('Notification template save is disabled until the real persistence API is implemented.');
  };

  const renderPreview = (content: string) => {
    let rendered = content;
    Object.entries(previewData).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return rendered;
  };

  const availableVariables = [
    'ticket.id',
    'ticket.subject',
    'ticket.description',
    'ticket.status',
    'ticket.priority',
    'ticket.type',
    'ticket.createdAt',
    'ticket.updatedAt',
    'customer.name',
    'customer.email',
    'admin.name',
    'comment.content',
    'comment.author',
    'comment.createdAt',
  ];

  const insertVariable = (variable: string, field: 'subject' | 'htmlContent' | 'textContent') => {
    const variableText = `{{${variable}}}`;
    setTemplate((prev) => ({
      ...prev,
      [field]: (prev[field] || '') + variableText,
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
          <h1 className="text-3xl font-bold">{isEditing ? 'Edit Template' : 'Create Template'}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Variables Panel */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Available Variables</h3>
              <p className="text-sm text-base-content/70 mb-4">
                Click to insert into the active field
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableVariables.map((variable) => (
                  <button
                    key={variable}
                    className="btn btn-ghost btn-sm justify-start w-full text-left"
                    onClick={() =>
                      insertVariable(
                        variable,
                        activeTab === 'subject'
                          ? 'subject'
                          : activeTab === 'html'
                            ? 'htmlContent'
                            : 'textContent',
                      )
                    }
                  >
                    <code className="text-xs">{'{{' + variable + '}}'}</code>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Template Editor */}
          <div className="col-span-3">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Template Name</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter template name"
                      className="input input-bordered"
                      value={template.name}
                      onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Event Type</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={template.eventType}
                      onChange={(e) =>
                        setTemplate((prev) => ({ ...prev, eventType: e.target.value }))
                      }
                    >
                      <option value="ticket.created">Ticket Created</option>
                      <option value="ticket.status_updated">Ticket Status Updated</option>
                      <option value="ticket.comment_added">Comment Added</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Type</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={template.type}
                      onChange={(e) =>
                        setTemplate((prev) => ({
                          ...prev,
                          type: e.target.value as NotificationTemplate['type'],
                        }))
                      }
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="push">Push Notification</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Language</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={template.language}
                      onChange={(e) =>
                        setTemplate((prev) => ({ ...prev, language: e.target.value }))
                      }
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                </div>

                {/* Template Content Tabs */}
                <div className="tabs tabs-bordered mb-4">
                  <button
                    className={`tab tab-lg ${activeTab === 'subject' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('subject')}
                  >
                    Subject
                  </button>
                  {template.type === 'email' && (
                    <>
                      <button
                        className={`tab tab-lg ${activeTab === 'html' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('html')}
                      >
                        HTML Content
                      </button>
                      <button
                        className={`tab tab-lg ${activeTab === 'text' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('text')}
                      >
                        Text Content
                      </button>
                    </>
                  )}
                  <button
                    className={`tab tab-lg ${activeTab === 'preview' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('preview')}
                  >
                    Preview
                  </button>
                </div>

                {/* Subject Tab */}
                {activeTab === 'subject' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Subject Line</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter subject line with variables like {{ticket.subject}}"
                      className="input input-bordered"
                      value={template.subject || ''}
                      onChange={(e) =>
                        setTemplate((prev) => ({ ...prev, subject: e.target.value }))
                      }
                    />
                  </div>
                )}

                {/* HTML Content Tab */}
                {activeTab === 'html' && template.type === 'email' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">HTML Content</span>
                    </label>
                    <textarea
                      placeholder="Enter HTML content with variables like {{ticket.subject}}"
                      className="textarea textarea-bordered h-96 font-mono text-sm"
                      value={template.htmlContent || ''}
                      onChange={(e) =>
                        setTemplate((prev) => ({ ...prev, htmlContent: e.target.value }))
                      }
                    />
                  </div>
                )}

                {/* Text Content Tab */}
                {activeTab === 'text' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Text Content</span>
                    </label>
                    <textarea
                      placeholder="Enter plain text content with variables like {{ticket.subject}}"
                      className="textarea textarea-bordered h-96 font-mono text-sm"
                      value={template.textContent || ''}
                      onChange={(e) =>
                        setTemplate((prev) => ({ ...prev, textContent: e.target.value }))
                      }
                    />
                  </div>
                )}

                {/* Preview Tab */}
                {activeTab === 'preview' && (
                  <div className="space-y-4">
                    <div className="alert alert-info">
                      <span>
                        Preview using sample data. Variables will be replaced with actual values
                        when sent.
                      </span>
                    </div>

                    {template.subject && (
                      <div>
                        <h4 className="font-bold mb-2">Subject:</h4>
                        <div className="bg-base-200 p-3 rounded border">
                          {renderPreview(template.subject)}
                        </div>
                      </div>
                    )}

                    {template.htmlContent && (
                      <div>
                        <h4 className="font-bold mb-2">HTML Content:</h4>
                        <iframe
                          title="Notification template HTML preview"
                          className="w-full min-h-96 bg-white rounded border border-base-300"
                          sandbox=""
                          srcDoc={renderPreview(template.htmlContent)}
                        />
                      </div>
                    )}

                    {template.textContent && (
                      <div>
                        <h4 className="font-bold mb-2">Text Content:</h4>
                        <div className="bg-base-200 p-3 rounded border whitespace-pre-wrap font-mono text-sm">
                          {renderPreview(template.textContent)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Enable/Disable */}
                <div className="form-control mt-6">
                  <label className="cursor-pointer label justify-start">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={template.enabled}
                      onChange={(e) =>
                        setTemplate((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                    />
                    <span className="label-text ml-2">Enable this template</span>
                  </label>
                </div>

                <div className="alert alert-warning mt-6">
                  <span>
                    Template editing is temporarily read-only here because the persistence API is not
                    implemented yet. This avoids showing false successful saves in production.
                  </span>
                </div>

                {/* Actions */}
                <div className="card-actions justify-end mt-6">
                  <Link href="/notifications" className="btn btn-ghost">
                    Back
                  </Link>
                  <button className="btn btn-primary" onClick={handleSave} disabled>
                    {isEditing ? 'Update Template' : 'Create Template'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
