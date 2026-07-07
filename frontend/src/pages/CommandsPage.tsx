import { useEffect, useState } from 'react';
import { api, DiscordServer, CommandRule } from '../api/client';

export function CommandsPage() {
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [rules, setRules] = useState<CommandRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getServers().then((data) => {
      setServers(data);
      if (data.length > 0) setSelectedServerId(data[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedServerId) return;
    api.getCommandRules(selectedServerId).then(setRules);
  }, [selectedServerId]);

  const toggleRule = async (rule: CommandRule, field: 'enabled' | 'mirrorEnabled' | 'autoTagEnabled') => {
    const updated = await api.updateCommandRule(selectedServerId, rule.commandName, {
      [field]: !rule[field],
    });
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  if (loading) return <div className="loading">Loading commands...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Command Rules</h1>
        <p>Configure slash command behavior per server</p>
      </div>

      {servers.length === 0 ? (
        <div className="card empty-state">
          <h3>No servers connected</h3>
          <p>Connect a Discord server first to configure commands.</p>
        </div>
      ) : (
        <>
          <div className="form-group" style={{ maxWidth: 300, marginBottom: '1.5rem' }}>
            <label>Server</label>
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.guildName}</option>
              ))}
            </select>
          </div>

          <div className="table-wrapper card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Enabled</th>
                  <th>Mirror Notifications</th>
                  <th>AI Auto-Tag</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      /{rule.commandName}
                    </td>
                    <td>
                      <button
                        className={`toggle${rule.enabled ? ' active' : ''}`}
                        onClick={() => toggleRule(rule, 'enabled')}
                        aria-label={`Toggle ${rule.commandName}`}
                      />
                    </td>
                    <td>
                      <button
                        className={`toggle${rule.mirrorEnabled ? ' active' : ''}`}
                        onClick={() => toggleRule(rule, 'mirrorEnabled')}
                        aria-label={`Toggle mirror for ${rule.commandName}`}
                      />
                    </td>
                    <td>
                      <button
                        className={`toggle${rule.autoTagEnabled ? ' active' : ''}`}
                        onClick={() => toggleRule(rule, 'autoTagEnabled')}
                        aria-label={`Toggle AI tagging for ${rule.commandName}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Available Commands</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <strong>/report</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Submit a report with title, description, and severity. Supports deferred responses,
                  interactive buttons, and modal forms.
                </p>
              </div>
              <div>
                <strong>/status</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Check system status with a refresh button. Returns an embed with uptime and server info.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
