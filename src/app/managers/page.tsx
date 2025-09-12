'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

interface Manager {
  managerId: string;
  name: string;
  email: string;
  mobilePhone: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ManagerFormData {
  name: string;
  email: string;
  mobilePhone: string;
  role: string;
}

export default function ManagersPage() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [formData, setFormData] = useState<ManagerFormData>({
    name: '',
    email: '',
    mobilePhone: '',
    role: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchManagers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/managers');
      if (response.ok) {
        const data = await response.json();
        setManagers(data.data);
      } else {
        console.error('Failed to fetch managers');
        setError('Failed to load managers');
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
      setError('Failed to load managers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && session?.user) {
      fetchManagers();
    }
  }, [loading, session]);

  const handleCreateNew = () => {
    setEditingManager(null);
    setFormData({ name: '', email: '', mobilePhone: '', role: '' });
    setShowForm(true);
    setError(null);
  };

  const handleEdit = (manager: Manager) => {
    setEditingManager(manager);
    setFormData({
      name: manager.name,
      email: manager.email,
      mobilePhone: manager.mobilePhone || '',
      role: manager.role || ''
    });
    setShowForm(true);
    setError(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingManager(null);
    setFormData({ name: '', email: '', mobilePhone: '', role: '' });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingManager 
        ? `/api/admin/managers/${editingManager.managerId}`
        : '/api/admin/managers';
      
      const method = editingManager ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchManagers(); // Refresh the list
        handleCloseForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error saving manager:', error);
      setError('Failed to save manager');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (manager: Manager) => {
    if (!confirm(`Are you sure you want to delete ${manager.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/managers/${manager.managerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchManagers(); // Refresh the list
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete manager');
      }
    } catch (error) {
      console.error('Error deleting manager:', error);
      setError('Failed to delete manager');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <main className="container mx-auto px-4 py-8">
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
      <main className="container mx-auto px-4 py-8">
        <div className="bg-base-100 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Managers</h1>
            <button 
              className="btn btn-primary"
              onClick={handleCreateNew}
            >
              + Add New Manager
            </button>
          </div>

          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* Managers Table */}
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile Phone</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {managers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-base-content/60">
                      No managers found. Create your first manager!
                    </td>
                  </tr>
                ) : (
                  managers.map((manager) => (
                    <tr key={manager.managerId}>
                      <td className="font-medium">{manager.name}</td>
                      <td>{manager.email}</td>
                      <td>{manager.mobilePhone || '-'}</td>
                      <td>{manager.role || '-'}</td>
                      <td>{new Date(manager.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-2">
                          <button 
                            className="btn btn-sm btn-outline btn-info"
                            onClick={() => handleEdit(manager)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn btn-sm btn-outline btn-error"
                            onClick={() => handleDelete(manager)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manager Form Modal */}
        {showForm && (
          <div className="modal modal-open">
            <div className="modal-box max-w-md">
              <h3 className="font-bold text-lg mb-4">
                {editingManager ? 'Edit Manager' : 'Add New Manager'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Name *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Email *</span>
                  </label>
                  <input
                    type="email"
                    className="input input-bordered w-full"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Mobile Phone</span>
                  </label>
                  <input
                    type="tel"
                    className="input input-bordered w-full"
                    value={formData.mobilePhone}
                    onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Role</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g., Admin, Manager, Support"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <div className="alert alert-error">
                    <span>{error}</span>
                  </div>
                )}

                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleCloseForm}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : (
                      editingManager ? 'Update Manager' : 'Create Manager'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
