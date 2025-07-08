'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface Service {
  id: string;
  serviceCode: string;
  credits: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ServicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newService, setNewService] = useState({
    serviceCode: '',
    credits: 0,
    isActive: true
  });

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

      fetchServices();
    }
  }, [status, session, router]);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services');
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      
      const data = await response.json();
      setServices(data.services || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching services:', error);
      setIsLoading(false);
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService({ ...service });
  };

  const handleSaveEdit = async () => {
    if (!editingService) return;

    try {
      const response = await fetch(`/api/services/${editingService.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: editingService.credits,
          isActive: editingService.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update service');
      }

      setEditingService(null);
      await fetchServices();
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Error updating service');
    }
  };

  const handleCreateService = async () => {
    if (!newService.serviceCode || newService.credits <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newService),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create service');
      }

      setIsCreating(false);
      setNewService({ serviceCode: '', credits: 0, isActive: true });
      await fetchServices();
    } catch (error) {
      console.error('Error creating service:', error);
      alert('Error creating service: ' + (error as Error).message);
    }
  };

  const toggleServiceStatus = async (service: Service) => {
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: service.credits,
          isActive: !service.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle service status');
      }

      await fetchServices();
    } catch (error) {
      console.error('Error toggling service status:', error);
      alert('Error toggling service status');
    }
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Services Management</h1>
          <button
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
          >
            Add New Service
          </button>
        </div>

        {/* Create New Service Modal */}
        {isCreating && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg mb-4">Create New Service</h3>
              
              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text">Service Code</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={newService.serviceCode}
                  onChange={(e) => setNewService({ ...newService, serviceCode: e.target.value })}
                  placeholder="Enter service code"
                />
              </div>

              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text">Credits</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={newService.credits}
                  onChange={(e) => setNewService({ ...newService, credits: parseInt(e.target.value) || 0 })}
                  placeholder="Enter credits amount"
                  min="0"
                />
              </div>

              <div className="form-control w-full mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={newService.isActive}
                    onChange={(e) => setNewService({ ...newService, isActive: e.target.checked })}
                  />
                </label>
              </div>

              <div className="modal-action">
                <button
                  className="btn btn-ghost"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateService}
                >
                  Create Service
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Service Modal */}
        {editingService && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg mb-4">Edit Service</h3>
              
              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text">Service Code</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={editingService.serviceCode}
                  disabled
                  placeholder="Service code cannot be changed"
                />
              </div>

              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text">Credits</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={editingService.credits}
                  onChange={(e) => setEditingService({ ...editingService, credits: parseInt(e.target.value) || 0 })}
                  placeholder="Enter credits amount"
                  min="0"
                />
              </div>

              <div className="form-control w-full mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={editingService.isActive}
                    onChange={(e) => setEditingService({ ...editingService, isActive: e.target.checked })}
                  />
                </label>
              </div>

              <div className="modal-action">
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditingService(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="card bg-white shadow-lg">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Service Code</th>
                    <th>Credits</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="font-semibold">{service.serviceCode}</td>
                      <td>{service.credits}</td>
                      <td>
                        <div className="badge badge-sm badge-outline">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            service.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                      <td>{new Date(service.createdAt).toLocaleDateString()}</td>
                      <td>{new Date(service.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => handleEditService(service)}
                          >
                            Edit
                          </button>
                          <button
                            className={`btn btn-xs ${service.isActive ? 'btn-warning' : 'btn-success'}`}
                            onClick={() => toggleServiceStatus(service)}
                          >
                            {service.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {services.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No services found</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  );
}
