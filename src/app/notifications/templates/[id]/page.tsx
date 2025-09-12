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
  const [isSaving, setIsSaving] = useState(false);
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
      
      if (isEditing && params?.id) {
        // TODO: Replace with actual API call
        const mockTemplate: NotificationTemplate = {
          id: params.id as string,
          name: 'Ticket Created Notification',
          type: 'email',
          language: 'en',
          eventType: 'ticket.created',
          subject: 'New Ticket Created: {{ticket.subject}}',
          htmlContent: `<h2>New Ticket Created</h2>
<p>A new ticket has been created in the Mythoria support system.</p>
<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h3>Ticket Details</h3>
  <p><strong>ID:</strong> {{ticket.id}}</p>
  <p><strong>Subject:</strong> {{ticket.subject}}</p>
  <p><strong>Priority:</strong> {{ticket.priority}}</p>
  <p><strong>Type:</strong> {{ticket.type}}</p>
  <p><strong>Description:</strong> {{ticket.description}}</p>
</div>
<div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h3>Customer Information</h3>
  <p><strong>Name:</strong> {{customer.name}}</p>
  <p><strong>Email:</strong> {{customer.email}}</p>
</div>
<p>Created on: {{ticket.createdAt}}</p>`,
          textContent: `New Ticket Created

A new ticket has been created in the Mythoria support system.

Ticket Details:
- ID: {{ticket.id}}
- Subject: {{ticket.subject}}
- Priority: {{ticket.priority}}
- Type: {{ticket.type}}
- Description: {{ticket.description}}

Customer Information:
- Name: {{customer.name}}
- Email: {{customer.email}}

Created on: {{ticket.createdAt}}`,
          variables: ['ticket.id', 'ticket.subject', 'ticket.priority', 'ticket.type', 'ticket.description', 'customer.name', 'customer.email', 'ticket.createdAt'],
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setTemplate(mockTemplate);
      }
    } catch (error) {
      console.error('Error loading template:', error);
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

    loadTemplate();
  }, [status, router, loadTemplate]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // TODO: Implement actual API call
      console.log('Saving template:', template);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      router.push('/notifications');
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderPreview = (content: string) => {
    let rendered = content;
    Object.entries(previewData).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return rendered;
  };

  const availableVariables = [
    'ticket.id', 'ticket.subject', 'ticket.description', 'ticket.status', 
    'ticket.priority', 'ticket.type', 'ticket.createdAt', 'ticket.updatedAt',
    'customer.name', 'customer.email',
    'admin.name',
    'comment.content', 'comment.author', 'comment.createdAt'
  ];

  const insertVariable = (variable: string, field: 'subject' | 'htmlContent' | 'textContent') => {
    const variableText = `{{${variable}}}`;
    setTemplate(prev => ({
      ...prev,
      [field]: (prev[field] || '') + variableText
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
            {isEditing ? 'Edit Template' : 'Create Template'}
          </h1>
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
                    onClick={() => insertVariable(variable, 
                      activeTab === 'subject' ? 'subject' : 
                      activeTab === 'html' ? 'htmlContent' : 'textContent'
                    )}
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
                      onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Event Type</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={template.eventType}
                      onChange={(e) => setTemplate(prev => ({ ...prev, eventType: e.target.value }))}
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
                      onChange={(e) => setTemplate(prev => ({ 
                        ...prev, 
                        type: e.target.value as NotificationTemplate['type']
                      }))}
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
                      onChange={(e) => setTemplate(prev => ({ ...prev, language: e.target.value }))}
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
                      onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
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
                      onChange={(e) => setTemplate(prev => ({ ...prev, htmlContent: e.target.value }))}
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
                      onChange={(e) => setTemplate(prev => ({ ...prev, textContent: e.target.value }))}
                    />
                  </div>
                )}

                {/* Preview Tab */}
                {activeTab === 'preview' && (
                  <div className="space-y-4">
                    <div className="alert alert-info">
                      <span>Preview using sample data. Variables will be replaced with actual values when sent.</span>
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
                        <div 
                          className="bg-white p-4 rounded border border-base-300"
                          dangerouslySetInnerHTML={{ __html: renderPreview(template.htmlContent) }}
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
                      onChange={(e) => setTemplate(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span className="label-text ml-2">Enable this template</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="card-actions justify-end mt-6">
                  <Link href="/notifications" className="btn btn-ghost">
                    Cancel
                  </Link>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={isSaving || !template.name}
                  >
                    {isSaving && <span className="loading loading-spinner loading-sm"></span>}
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
