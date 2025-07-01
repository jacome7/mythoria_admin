'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'completed';
  assignedTo?: string;
  createdAt: string;
  dueDate?: string;
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

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

      fetchTasks();
    }
  }, [status, session, router]);

  const fetchTasks = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockTasks: Task[] = [
        {
          id: '1',
          title: 'Review Story Moderation Queue',
          description: 'Check flagged stories for inappropriate content',
          priority: 'high',
          status: 'open',
          assignedTo: 'Admin Team',
          createdAt: '2025-01-01T10:00:00Z',
          dueDate: '2025-01-02T17:00:00Z'
        },
        {
          id: '2',
          title: 'Process Print Requests',
          description: 'Review and approve pending print orders',
          priority: 'medium',
          status: 'open',
          assignedTo: 'Operations',
          createdAt: '2025-01-01T09:00:00Z',
          dueDate: '2025-01-03T12:00:00Z'
        },
        {
          id: '3',
          title: 'Update Pricing Tiers',
          description: 'Implement new pricing structure for Q1 2025',
          priority: 'urgent',
          status: 'in-progress',
          assignedTo: 'Product Team',
          createdAt: '2024-12-30T14:00:00Z',
          dueDate: '2025-01-05T23:59:59Z'
        },
        {
          id: '4',
          title: 'AI Usage Optimization',
          description: 'Analyze and optimize AI token usage patterns',
          priority: 'low',
          status: 'open',
          assignedTo: 'Engineering',
          createdAt: '2025-01-01T08:00:00Z'
        }
      ];

      setTasks(mockTasks);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'badge-error';
      case 'high': return 'badge-warning';
      case 'medium': return 'badge-info';
      case 'low': return 'badge-success';
      default: return 'badge-neutral';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'badge-error';
      case 'in-progress': return 'badge-warning';
      case 'completed': return 'badge-success';
      default: return 'badge-neutral';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || task.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

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
          <h1 className="text-3xl font-bold text-base-content mb-2">Open Tasks</h1>
          <p className="text-base-content/70">Manage and track administrative tasks</p>
        </div>

        {/* Filters */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select 
                  className="select select-bordered w-full max-w-xs" 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Priority</span>
                </label>
                <select 
                  className="select select-bordered w-full max-w-xs"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">&nbsp;</span>
                </label>
                <button className="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Task
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div>
                          <div className="font-bold">{task.title}</div>
                          <div className="text-sm opacity-50">{task.description}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getPriorityColor(task.priority)} capitalize`}>
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(task.status)} capitalize`}>
                          {task.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td>{task.assignedTo || 'Unassigned'}</td>
                      <td>
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-xs">View</button>
                          <button className="btn btn-ghost btn-xs">Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTasks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-base-content/70">No tasks found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  );
}
