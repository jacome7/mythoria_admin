'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import type { BiographerProject } from '@/services/biographer';

export default function BiographerOperations() {
  const [projects, setProjects] = useState<BiographerProject[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState<BiographerProject>();
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(60);
  const pendingCommand = useRef<{ payload: string; requestId: string } | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/biographer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'listProjects', input: { limit: 100 } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load projects');
      setProjects(Array.isArray(result.data) ? result.data : result.data.projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load projects');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function inspectProject(id: string) {
    setProjectId(id);
    setSelectedProject(undefined);
    setError('');
    try {
      const response = await fetch('/api/admin/biographer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'getProject', input: { projectId: id } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load project');
      setSelectedProject(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load project');
    }
  }
  async function command(operation: 'extendAllowance' | 'setLiveEnabled', enabled?: boolean) {
    setBusy(true);
    setError('');
    try {
      const payload = JSON.stringify({ operation, projectId, reason, minutes, enabled });
      if (pendingCommand.current?.payload !== payload)
        pendingCommand.current = { payload, requestId: crypto.randomUUID() };
      const requestId = pendingCommand.current.requestId;
      const input =
        operation === 'extendAllowance'
          ? { projectId, reason, additionalSeconds: minutes * 60, requestId }
          : { projectId, reason, enabled, requestId };
      const response = await fetch('/api/admin/biographer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, input }),
      });
      if (!response.ok) throw new Error('Unable to apply change');
      pendingCommand.current = null;
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to apply change');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      )}
      <button className="btn btn-sm" disabled={busy} onClick={() => void load()}>
        Refresh
      </button>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Locale</th>
              <th>Status</th>
              <th>Author’s remaining voice minutes</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.projectId}>
                <td>
                  <button className="link" onClick={() => void inspectProject(p.projectId)}>
                    {p.title || p.projectId}
                  </button>
                </td>
                <td>{p.locale}</td>
                <td>{p.status}</td>
                <td>{Math.floor(Math.max(0, p.liveSecondsLimit - p.liveSecondsUsed) / 60)}</td>
                <td>{p.liveEnabled ? 'Enabled' : 'Paused'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="card bg-base-200 p-5 space-y-3">
        <h2 className="text-xl font-semibold">Author voice controls</h2>
        {selectedProject && <p>Author ID: {selectedProject.authorId}</p>}
        <label>
          Project ID
          <input
            className="input input-bordered block w-full"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSelectedProject(undefined);
            }}
          />
        </label>
        <label>
          Reason
          <textarea
            className="textarea textarea-bordered block w-full"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label>
          Additional minutes for this author
          <input
            className="input input-bordered block"
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            disabled={
              busy || !projectId || reason.trim().length < 3 || minutes < 1 || minutes > 600
            }
            onClick={() => void command('extendAllowance')}
          >
            Extend author’s allowance
          </button>
          <button
            className="btn"
            disabled={busy || !projectId || reason.trim().length < 3}
            onClick={() => void command('setLiveEnabled', false)}
          >
            Pause this author’s voice access
          </button>
          <button
            className="btn"
            disabled={busy || !projectId || reason.trim().length < 3}
            onClick={() => void command('setLiveEnabled', true)}
          >
            Enable this author’s voice access
          </button>
        </div>
      </section>
    </div>
  );
}
