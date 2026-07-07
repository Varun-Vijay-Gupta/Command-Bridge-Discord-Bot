import { useEffect, useState, FormEvent } from 'react';
import { api, AppSettings } from '../api/client';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookType, setWebhookType] = useState('discord');
  const [aiProvider, setAiProvider] = useState('none');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSettings().then((data) => {
      setSettings(data);
      setWebhookType(data.mirrorWebhookType);
      setAiProvider(data.aiProvider);
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const data: Record<string, string> = {
      mirrorWebhookType: webhookType,
      aiProvider,
    };
    if (webhookUrl) data.mirrorWebhookUrl = webhookUrl;

    const updated = await api.updateSettings(data);
    setSettings(updated);
    setWebhookUrl('');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure webhooks, AI provider, and application settings</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Application Info</h2>
        <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Discord Application ID: </span>
            <code>{settings?.discordApplicationId}</code>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Interactions Endpoint: </span>
            <code>{window.location.origin.replace('5173', '3001')}/api/interactions</code>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Live SSE Clients: </span>
            {settings?.sseClients ?? 0}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Mirror Webhook</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Mirror interaction notifications to a Slack Incoming Webhook or Discord webhook URL.
        </p>
        {saved && (
          <div style={{ background: 'rgba(87,242,135,0.1)', border: '1px solid rgba(87,242,135,0.3)', color: 'var(--success)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            Settings saved successfully.
          </div>
        )}
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Webhook Type</label>
            <select value={webhookType} onChange={(e) => setWebhookType(e.target.value)}>
              <option value="discord">Discord Webhook</option>
              <option value="slack">Slack Incoming Webhook</option>
            </select>
          </div>
          <div className="form-group">
            <label>
              Webhook URL {settings?.mirrorWebhookUrl && '(currently configured)'}
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
            />
          </div>
          <div className="form-group">
            <label>AI Provider (for auto-tagging)</label>
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
              <option value="none">Disabled</option>
              <option value="groq">Groq (free tier)</option>
              <option value="gemini">Google Gemini (free tier)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Save Settings</button>
        </form>
      </div>
    </div>
  );
}
