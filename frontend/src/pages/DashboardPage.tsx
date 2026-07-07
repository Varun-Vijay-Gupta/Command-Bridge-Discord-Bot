import { useEffect, useState, useCallback } from 'react';
import { api, Stats, InteractionLog } from '../api/client';
import { useSse } from '../hooks/useSse';

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<InteractionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, logsData] = await Promise.all([
        api.getStats(),
        api.getLogs({ limit: '10' }),
      ]);
      setStats(statsData);
      setRecentLogs(logsData.logs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSse(
    (log) => {
      setRecentLogs((prev) => [log, ...prev.slice(0, 9)]);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total: prev.total + 1,
              completed: log.status === 'COMPLETED' ? prev.completed + 1 : prev.completed,
              failed: log.status === 'FAILED' ? prev.failed + 1 : prev.failed,
              deferred: log.status === 'DEFERRED' ? prev.deferred + 1 : prev.deferred,
            }
          : prev
      );
    },
    (newStats) => setStats(newStats)
  );

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Real-time overview of Discord interactions</p>
        </div>
        <span className="live-indicator">Live</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="label">Total Interactions</div>
          <div className="value">{stats?.total ?? 0}</div>
        </div>
        <div className="stat-card success">
          <div className="label">Completed</div>
          <div className="value">{stats?.completed ?? 0}</div>
        </div>
        <div className="stat-card danger">
          <div className="label">Failed</div>
          <div className="value">{stats?.failed ?? 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Deferred</div>
          <div className="value">{stats?.deferred ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Recent Interactions</h2>
        {recentLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No interactions yet</h3>
            <p>Connect a Discord server and use slash commands to see activity here.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Command</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>/{log.commandName || 'unknown'}</td>
                    <td>{log.userName || log.userId}</td>
                    <td>
                      <span className={`badge badge-${log.status.toLowerCase()}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
