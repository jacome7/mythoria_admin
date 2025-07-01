'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import AdminFooter from '@/components/AdminFooter';

interface Story {
  id: string;
  title: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  status: 'draft' | 'generating' | 'completed' | 'published' | 'archived';
  wordCount: number;
  chapters: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isPublic: boolean;
  flagged: boolean;
}

export default function StoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFlagged, setFilterFlagged] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

      fetchStories();
    }
  }, [status, session, router]);

  const fetchStories = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockStories: Story[] = [
        {
          id: '1',
          title: 'The Adventures of Sarah in Magical Kingdom',
          author: {
            id: '101',
            name: 'John Smith',
            email: 'john@example.com'
          },
          status: 'completed',
          wordCount: 5420,
          chapters: 8,
          createdAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-01T15:30:00Z',
          tags: ['fantasy', 'children', 'adventure'],
          isPublic: true,
          flagged: false
        },
        {
          id: '2',
          title: 'Corporate Warriors: The Tech Startup Story',
          author: {
            id: '102',
            name: 'Maria Garcia',
            email: 'maria@techcorp.com'
          },
          status: 'generating',
          wordCount: 0,
          chapters: 0,
          createdAt: '2025-01-01T14:00:00Z',
          updatedAt: '2025-01-01T14:00:00Z',
          tags: ['corporate', 'business', 'startup'],
          isPublic: false,
          flagged: false
        },
        {
          id: '3',
          title: 'Space Explorer Emma',
          author: {
            id: '103',
            name: 'Robert Johnson',
            email: 'robert@gmail.com'
          },
          status: 'completed',
          wordCount: 3200,
          chapters: 5,
          createdAt: '2024-12-30T09:00:00Z',
          updatedAt: '2024-12-30T16:45:00Z',
          tags: ['sci-fi', 'space', 'adventure'],
          isPublic: true,
          flagged: true
        },
        {
          id: '4',
          title: 'The Mystery of the Lost Treasure',
          author: {
            id: '104',
            name: 'Lisa Chen',
            email: 'lisa@example.com'
          },
          status: 'draft',
          wordCount: 1200,
          chapters: 2,
          createdAt: '2025-01-01T11:00:00Z',
          updatedAt: '2025-01-01T12:30:00Z',
          tags: ['mystery', 'treasure', 'adventure'],
          isPublic: false,
          flagged: false
        }
      ];

      setStories(mockStories);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching stories:', error);
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'badge-neutral';
      case 'generating': return 'badge-warning';
      case 'completed': return 'badge-success';
      case 'published': return 'badge-info';
      case 'archived': return 'badge-ghost';
      default: return 'badge-neutral';
    }
  };

  const filteredStories = stories.filter(story => {
    const statusMatch = filterStatus === 'all' || story.status === filterStatus;
    const flaggedMatch = filterFlagged === 'all' || 
      (filterFlagged === 'flagged' && story.flagged) ||
      (filterFlagged === 'clean' && !story.flagged);
    const searchMatch = searchTerm === '' || 
      story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.author.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    return statusMatch && flaggedMatch && searchMatch;
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
          <h1 className="text-3xl font-bold text-base-content mb-2">Stories Management</h1>
          <p className="text-base-content/70">View, moderate, and manage user-generated stories</p>
        </div>

        {/* Filters and Search */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Search</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Search stories, authors..." 
                  className="input input-bordered w-full max-w-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

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
                  <option value="draft">Draft</option>
                  <option value="generating">Generating</option>
                  <option value="completed">Completed</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Content</span>
                </label>
                <select 
                  className="select select-bordered w-full max-w-xs"
                  value={filterFlagged}
                  onChange={(e) => setFilterFlagged(e.target.value)}
                >
                  <option value="all">All Content</option>
                  <option value="clean">Clean</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stories Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Total Stories</h3>
              <p className="text-2xl font-bold">{stories.length}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Completed</h3>
              <p className="text-2xl font-bold">{stories.filter(s => s.status === 'completed').length}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Flagged</h3>
              <p className="text-2xl font-bold text-error">{stories.filter(s => s.flagged).length}</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title text-sm">Public</h3>
              <p className="text-2xl font-bold">{stories.filter(s => s.isPublic).length}</p>
            </div>
          </div>
        </div>

        {/* Stories Table */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Story</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Created</th>
                    <th>Flags</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStories.map((story) => (
                    <tr key={story.id} className={story.flagged ? 'bg-error/10' : ''}>
                      <td>
                        <div>
                          <div className="font-bold">{story.title}</div>
                          <div className="text-sm opacity-50">
                            {story.tags.map(tag => (
                              <span key={tag} className="badge badge-outline badge-xs mr-1">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="font-medium">{story.author.name}</div>
                          <div className="text-sm opacity-50">{story.author.email}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(story.status)} capitalize`}>
                          {story.status}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div>{story.wordCount.toLocaleString()} words</div>
                          <div className="text-xs opacity-50">{story.chapters} chapters</div>
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {new Date(story.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {story.flagged && (
                            <span className="badge badge-error badge-xs">Flagged</span>
                          )}
                          {story.isPublic && (
                            <span className="badge badge-info badge-xs">Public</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-xs">View</button>
                          <button className="btn btn-ghost btn-xs">Edit</button>
                          <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="btn btn-ghost btn-xs">
                              ⋮
                            </div>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                              <li><a>Archive</a></li>
                              <li><a>Flag Content</a></li>
                              <li><a>Export</a></li>
                              <li><a className="text-error">Delete</a></li>
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredStories.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-base-content/70">No stories found matching your filters.</p>
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
