import { useEffect, useState, FormEvent } from 'react';
import { api, DiscordServer } from '../api/client';

export function ServersPage() {
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ guildId: '', guildName: '', botChannelId: '' });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [serversData, invite] = await Promise.all([
        api.getServers(),
        api.getInviteUrl(),
      ]);
      setServers(serversData);
      setInviteUrl(invite.url);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.connectServer({
        guildId: form.guildId,
        guildName: form.guildName,
        botChannelId: form.botChannelId || undefined,
      });
      setShowForm(false);
      setForm({ guildId: '', guildName: '', botChannelId: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect server');
    }
  };

  const handleToggle = async (server: DiscordServer) => {
    await api.updateServer(server.id, { isActive: !server.isActive });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this server from CommandBridge?')) return;
    await api.deleteServer(id);
    await load();
  };

  if (loading) return <div className="loading">Loading servers...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Discord Servers</h1>
          <p>Connect and manage your Discord servers</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {inviteUrl && (
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Invite Bot
            </a>
          )}
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Connect Server'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Connect Server</h2>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleConnect}>
            <div className="grid-2">
              <div className="form-group">
                <label>Guild ID</label>
                <input
                  value={form.guildId}
                  onChange={(e) => setForm({ ...form, guildId: e.target.value })}
                  placeholder="123456789012345678"
                  required
                />
              </div>
              <div className="form-group">
                <label>Server Name</label>
                <input
                  value={form.guildName}
                  onChange={(e) => setForm({ ...form, guildName: e.target.value })}
                  placeholder="My Discord Server"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Bot Response Channel ID (optional)</label>
              <input
                value={form.botChannelId}
                onChange={(e) => setForm({ ...form, botChannelId: e.target.value })}
                placeholder="Channel ID for bot responses"
              />
            </div>
            <button type="submit" className="btn btn-primary">Connect</button>
          </form>
        </div>
      )}

      {servers.length === 0 ? (
        <div className="card empty-state">
          <h3>No servers connected</h3>
          <p>Invite the bot to your Discord server, then connect it here.</p>
        </div>
      ) : (
        <div className="table-wrapper card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Guild ID</th>
                <th>Channel</th>
                <th>Commands</th>
                <th>Interactions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {server.guildName}
                  </td>
                  <td><code style={{ fontSize: '0.8rem' }}>{server.guildId}</code></td>
                  <td>{server.botChannelId || '—'}</td>
                  <td>{server.commandRules?.length ?? 0}</td>
                  <td>{server._count?.interactionLogs ?? 0}</td>
                  <td>
                    <span className={`badge ${server.isActive ? 'badge-completed' : 'badge-failed'}`}>
                      {server.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggle(server)}
                    >
                      {server.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(server.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
