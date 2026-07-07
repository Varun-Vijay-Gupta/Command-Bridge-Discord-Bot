import { useEffect, useState, useCallback } from 'react';
import { api, InteractionLog } from '../api/client';
import { useSse } from '../hooks/useSse';

export function LogsPage() {
  const [logs, setLogs] = useState<InteractionLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<InteractionLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      const data = await api.getLogs(params);
      setLogs(data.logs);
      setTotalPages(data.pagination.pages);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useSse((log) => {
    if (page === 1 && (!statusFilter || log.status === statusFilter)) {
      setLogs((prev) => [log, ...prev.slice(0, 19)]);
    }
  });

  const viewDetail = async (id: string) => {
    const log = await api.getLog(id);
    setSelectedLog(log);
  };

  const handleRetry = async (id: string) => {
    await api.retryLog(id);
    await load();
    setSelectedLog(null);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Interaction Logs</h1>
          <p>All recorded Discord interactions</p>
        </div>
        <span className="live-indicator">Live</span>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)' }}
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="DEFERRED">Deferred</option>
          <option value="PROCESSING">Processing</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="card empty-state">
          <h3>No logs found</h3>
          <p>Interactions will appear here once slash commands are used.</p>
        </div>
      ) : (
        <div className="table-wrapper card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Command</th>
                <th>User</th>
                <th>Server</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Tags</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>/{log.commandName || '—'}</td>
                  <td>{log.userName || log.userId}</td>
                  <td>{log.server?.guildName || '—'}</td>
                  <td>
                    <span className={`badge badge-${log.status.toLowerCase()}`}>
                      {log.status}
                    </span>
                  </td>
                  <td>{log.processingMs ? `${log.processingMs}ms` : '—'}</td>
                  <td>
                    {log.tags?.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => viewDetail(log.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span style={{ padding: '0.35rem 0.75rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}

      {selectedLog && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div className="card" style={{ maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem' }}>Interaction Detail</h2>
            <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div><strong>ID:</strong> {selectedLog.interactionId}</div>
              <div><strong>Command:</strong> /{selectedLog.commandName}</div>
              <div><strong>Status:</strong> <span className={`badge badge-${selectedLog.status.toLowerCase()}`}>{selectedLog.status}</span></div>
              {selectedLog.aiSummary && <div><strong>AI Summary:</strong> {selectedLog.aiSummary}</div>}
              {selectedLog.errorMessage && <div style={{ color: 'var(--danger)' }}><strong>Error:</strong> {selectedLog.errorMessage}</div>}
              {selectedLog.processingMs && <div><strong>Processing:</strong> {selectedLog.processingMs}ms</div>}
              {selectedLog.failures && selectedLog.failures.length > 0 && (
                <div>
                  <strong>Failures ({selectedLog.failures.length}):</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                    {selectedLog.failures.map((f) => (
                      <li key={f.id} style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                        Attempt {f.attemptNumber}: {f.errorMessage}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              {selectedLog.status === 'FAILED' && (
                <button className="btn btn-primary btn-sm" onClick={() => handleRetry(selectedLog.id)}>
                  Retry
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
