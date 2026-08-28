import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api, API_BASE } from '../services/api';

interface SlackProps {
  user: any;
  setUser: (user: any) => void;
}

export const Slack: React.FC<SlackProps> = ({ user, setUser }) => {
  const navigate = useNavigate();

  const [connected, setConnected] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Manual configuration form states
  const [manualWebhook, setManualWebhook] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const meRes = await api.getMe();
      setUser(meRes.user);

      const [slackRes, schedRes, sentRes] = await Promise.all([
        api.getSlackStatus(),
        api.getScheduledEmails(),
        api.getSentEmails(),
      ]);

      setConnected(slackRes.connected);
      setWebhookUrl(slackRes.webhookUrl || '');
      setScheduledCount(schedRes.emails?.length || 0);
      setSentCount(sentRes.emails?.length || 0);
    } catch (err) {
      console.error('Failed to load Slack status data:', err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOAuthConnect = () => {
    // Redirect to backend Slack OAuth trigger
    window.location.href = `${API_BASE}/slack/oauth/start`;
  };

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWebhook.trim() || !manualWebhook.startsWith('https://hooks.slack.com/services/')) {
      setError('Please enter a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/services/');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.connectSlackWebhook(manualWebhook);
      setSuccess('Successfully connected manual Slack Webhook!');
      setManualWebhook('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to connect webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Slack integration?')) {
      return;
    }
    setLoading(true);
    try {
      await api.disconnectSlack();
      setSuccess('Slack disconnected successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading User Session...</div>;
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        scheduledCount={scheduledCount} 
        sentCount={sentCount} 
      />

      {/* Main Content Area */}
      <main className="flex-1 ml-[240px] flex flex-col min-h-screen">
        {/* Top Header */}
        <Header 
          searchQuery=""
          setSearchQuery={() => {}}
          onSearch={() => {}}
          onRefresh={fetchData}
          placeholder="Slack Integration Settings"
        />

        {/* Page Content */}
        <div className="flex-1 p-gutter max-w-xl w-full mx-auto overflow-y-auto mt-8">
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-outline-variant pb-4 mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">hub</span>
              <div>
                <h1 className="font-headline-md text-headline-md text-on-surface">Slack Integration</h1>
                <p className="text-xs text-on-surface-variant">Send instant alerts to Slack when sender hourly limits are hit.</p>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-4 text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-2 mb-4 text-center">
                {success}
              </div>
            )}

            {loading ? (
              <div className="text-center py-4 text-on-surface-variant">Fetching status...</div>
            ) : connected ? (
              // Connected State
              <div className="flex flex-col gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800">
                  <span className="material-symbols-outlined">check_circle</span>
                  <div>
                    <p className="font-semibold">Slack is Active</p>
                    <p className="text-xs mt-0.5">Webhook URL: {webhookUrl}</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleDisconnect}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-label-md text-label-md py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">link_off</span>
                  Disconnect Slack
                </button>
              </div>
            ) : (
              // Disconnected State
              <div className="flex flex-col gap-6">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-on-surface-variant text-center">
                  <p>Slack notifications are currently **disabled**.</p>
                  <p className="text-xs mt-1">Connect your Slack workspace to start receiving rate limit warnings.</p>
                </div>

                {/* OAuth Connect Button */}
                <button 
                  onClick={handleOAuthConnect}
                  className="w-full bg-primary text-white hover:bg-surface-tint font-label-md text-label-md py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  Connect Slack Workspace
                </button>

                <div className="flex items-center gap-4 my-2">
                  <div className="flex-1 h-[1px] bg-outline-variant"></div>
                  <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">or manually connect</span>
                  <div className="flex-1 h-[1px] bg-outline-variant"></div>
                </div>

                {/* Manual Webhook Configuration Form */}
                <form onSubmit={handleManualConnect} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant">Slack Incoming Webhook URL</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
                      value={manualWebhook}
                      onChange={(e) => setManualWebhook(e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full bg-surface-container-lowest border border-primary text-primary font-label-md text-label-md py-2 rounded-lg hover:bg-hover-tint transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving ? 'Connecting...' : 'Connect Manual Webhook'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
