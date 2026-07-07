import { useEffect, useState } from 'react';
import { api, FailureLog } from '../api/client';

export function FailuresPage() {
  const [failures, setFailures] = useState<FailureLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFailures().then((data) => {
      setFailures(data.failures);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Loading failure history...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Failure History</h1>
        <p>Retry attempts and error details for failed interactions</p>
      </div>

      {failures.length === 0 ? (
        <div className="card empty-state">
          <h3>No failures recorded</h3>
          <p>Failed interactions and retry attempts will appear here.</p>
        </div>
      ) : (
        <div className="table-wrapper card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Command</th>
                <th>User</th>
                <th>Server</th>
                <th>Attempt</th>
                <th>Error</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.id}>
                  <td>/{f.interactionLog?.commandName || '—'}</td>
                  <td>{f.interactionLog?.userName || '—'}</td>
                  <td>{f.interactionLog?.server?.guildName || '—'}</td>
                  <td>#{f.attemptNumber}</td>
                  <td style={{ color: 'var(--danger)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.errorMessage}
                  </td>
                  <td>{new Date(f.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
