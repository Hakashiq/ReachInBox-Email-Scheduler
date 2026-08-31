import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, API_BASE } from '../services/api';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
    isAdmin?: boolean;
  };
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, scheduledCount, sentCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Slack Integration states
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [manualWebhook, setManualWebhook] = useState('');
  const [slackError, setSlackError] = useState('');
  const [slackSuccess, setSlackSuccess] = useState('');
  const [slackSaving, setSlackSaving] = useState(false);
  const [hasDefaultFallback, setHasDefaultFallback] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const fetchSlackStatus = async () => {
    try {
      const res = await api.getSlackStatus();
      setSlackConnected(res.connected);
      setSlackWebhook(res.webhookUrl || '');
      setHasDefaultFallback(res.hasDefaultFallback || false);
    } catch (err) {
      console.error('Failed to load Slack integration status:', err);
    }
  };

  useEffect(() => {
    if (settingsOpen) {
      fetchSlackStatus();
      setSlackError('');
      setSlackSuccess('');
    }
  }, [settingsOpen]);

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWebhook.trim() || !manualWebhook.startsWith('https://hooks.slack.com/services/')) {
      setSlackError('Please enter a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/services/');
      return;
    }

    setSlackSaving(true);
    setSlackError('');
    setSlackSuccess('');

    try {
      await api.connectSlackWebhook(manualWebhook);
      setSlackSuccess('Slack connected successfully!');
      setManualWebhook('');
      fetchSlackStatus();
    } catch (err: any) {
      setSlackError(err.message || 'Failed to connect Slack webhook');
    } finally {
      setSlackSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Slack integration?')) {
      return;
    }
    setSlackSaving(true);
    setSlackError('');
    setSlackSuccess('');
    try {
      await api.disconnectSlack();
      setSlackSuccess('Slack disconnected successfully.');
      fetchSlackStatus();
    } catch (err: any) {
      setSlackError(err.message || 'Failed to disconnect Slack');
    } finally {
      setSlackSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <nav className="bg-surface-container-lowest fixed h-full w-[240px] left-0 top-0 border-r border-outline-variant flex flex-col gap-space-md p-space-md z-20">
      {/* Brand Name */}
      <div className="px-space-sm py-space-sm mb-space-md">
        <span className="font-headline-lg text-headline-lg font-black text-on-surface tracking-tighter uppercase cursor-pointer" onClick={() => navigate('/scheduled')}>
          ReachInbox
        </span>
      </div>

      {/* User Profile Card */}
      <div className="relative">
        <div 
          className="bg-search-bg rounded-lg p-3 flex items-center justify-between cursor-pointer border border-transparent hover:border-outline-variant transition-colors"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <div className="flex items-center gap-3">
            <img 
              alt={`${user.name} profile picture`} 
              className="w-8 h-8 rounded-full object-cover border border-outline-variant"
              src={user.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCwgoyfQ4YLSslnEOYn-1DE3BiL6u9aZTKCp6L_1HDhb4Iy3EGThaydIKTjgDGo4H87xxgBGhJuiv7apIWODmchjuQsVWDb2iUJnTCOLBPT9ydb50WVc_mL3Zzsrlp60f7daxYEY7F3gjF65k0EhYaU6AB1lP2vRW64P5gfKgOXO9Kkbi7Sgq0anD4TE8X4L-pNPy4zmOMxtxAplG6eteAMkNmth5PvUGZga1j3sbBp7VH1jqpjoAjmUA'} 
            />
            <div className="flex flex-col overflow-hidden max-w-[130px]">
              <span className="font-label-md text-label-md text-on-surface truncate">{user.name}</span>
              <span className="font-meta-data text-meta-data text-on-surface-variant truncate">{user.email}</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
            {dropdownOpen ? 'expand_less' : 'expand_more'}
          </span>
        </div>

        {/* Profile Dropdown Options */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded-lg shadow-md py-1 z-30">
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Compose CTA Button */}
      <button 
        onClick={() => navigate('/compose')}
        className="w-full bg-surface-container-lowest border border-primary text-primary font-headline-md text-headline-md py-2 rounded-lg hover:bg-hover-tint transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
        + Compose
      </button>

      {/* Navigation Links */}
      <div className="flex flex-col gap-1 mt-4">
        <span className="font-meta-data text-meta-data text-on-surface-variant uppercase tracking-wider pl-3 mb-2">Core</span>
        
        {/* Scheduled link */}
        <button 
          onClick={() => navigate('/scheduled')}
          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors duration-200 border-l-4 ${
            isActive('/scheduled') 
              ? 'bg-nav-active text-primary font-bold border-primary' 
              : 'text-on-surface-variant border-transparent hover:bg-hover-tint'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px]">schedule</span>
            <span className="font-label-md text-label-md">Scheduled</span>
          </div>
          <span className="font-meta-data text-meta-data">{scheduledCount}</span>
        </button>

        {/* Sent link */}
        <button 
          onClick={() => navigate('/sent')}
          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors duration-200 border-l-4 ${
            isActive('/sent') 
              ? 'bg-nav-active text-primary font-bold border-primary' 
              : 'text-on-surface-variant border-transparent hover:bg-hover-tint'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px]">send</span>
            <span className="font-label-md text-label-md">Sent & Failed</span>
          </div>
          <span className="font-meta-data text-meta-data">{sentCount}</span>
        </button>

        {/* Senders link */}
        <button 
          onClick={() => navigate('/senders')}
          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors duration-200 border-l-4 ${
            isActive('/senders') 
              ? 'bg-nav-active text-primary font-bold border-primary' 
              : 'text-on-surface-variant border-transparent hover:bg-hover-tint'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px]">group</span>
            <span className="font-label-md text-label-md">Senders</span>
          </div>
        </button>

        {/* Queue Monitor link (Visible to all users) */}
        <a 
          href={`${API_BASE}/admin/queues`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors duration-200 border-l-4 text-on-surface-variant border-transparent hover:bg-hover-tint"
        >
          <span className="material-symbols-outlined text-[20px]">monitoring</span>
          <span className="font-label-md text-label-md">Queue Monitor</span>
        </a>

        {/* Settings link */}
        <button 
          onClick={() => setSettingsOpen(true)}
          className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors duration-200 border-l-4 ${
            settingsOpen 
              ? 'bg-nav-active text-primary font-bold border-primary' 
              : 'text-on-surface-variant border-transparent hover:bg-hover-tint'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="font-label-md text-label-md">Settings</span>
          </div>
        </button>
      </div>

      {/* Settings Slide-out Drawer */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-black/30 transition-opacity"
            onClick={() => setSettingsOpen(false)}
          />
          
          {/* Slide-out Panel */}
          <div className="relative w-80 max-w-full bg-white h-full shadow-2xl flex flex-col p-6 z-10 border-l border-outline-variant">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#dadce0] mb-6">
              <span className="text-lg font-semibold text-[#202124]">Settings</span>
              <button 
                onClick={() => setSettingsOpen(false)}
                className="material-symbols-outlined hover:bg-surface-container-low p-1 rounded-full text-on-surface-variant text-[20px]"
              >
                close
              </button>
            </div>

            {/* Settings Body */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
              {/* Integrations Header */}
              <div>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-3">Integrations</span>
                
                {/* Slack card */}
                <div className="bg-[#F8F9FA] border border-[#dadce0] rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[22px] fill">hub</span>
                    <span className="font-semibold text-sm">Slack</span>
                  </div>
                  
                  <span className="text-xs text-on-surface-variant leading-relaxed">
                    Receive notifications when a sender reaches its hourly limit.
                  </span>

                  {/* Status Indicator */}
                  {slackConnected ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded border border-green-200">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                      Connected (Custom Webhook)
                    </div>
                  ) : hasDefaultFallback ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#006d38] font-semibold bg-[#E8F7EF] px-2 py-1 rounded border border-[#CDEED6]">
                      <span className="w-1.5 h-1.5 bg-[#00A859] rounded-full animate-pulse"></span>
                      Connected (System Default)
                    </div>
                  ) : (
                    <div className="text-xs text-on-surface-variant bg-gray-100 px-2 py-1 rounded border border-gray-200 text-center font-medium">
                      Not Connected
                    </div>
                  )}

                  {/* Connect Webhook Form */}
                  {!slackConnected ? (
                    <form onSubmit={handleManualConnect} className="flex flex-col gap-2 mt-1">
                      <input 
                        type="url"
                        placeholder="https://hooks.slack.com/services/..."
                        required
                        value={manualWebhook}
                        onChange={(e) => setManualWebhook(e.target.value)}
                        className="w-full border border-[#dadce0] rounded px-2.5 py-1.5 outline-none focus:border-primary text-xs bg-white"
                      />
                      <button
                        type="submit"
                        disabled={slackSaving}
                        className="w-full h-8 bg-primary text-white rounded text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-50 hover:bg-[#009650]"
                      >
                        {slackSaving ? 'Connecting...' : 'Connect Slack'}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2 mt-1">
                      <span className="text-[10px] text-on-surface-variant font-mono truncate bg-gray-100 p-1.5 rounded">
                        {slackWebhook}
                      </span>
                      <button
                        onClick={handleDisconnect}
                        disabled={slackSaving}
                        className="w-full h-8 border border-red-200 hover:bg-red-50 text-red-600 rounded text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {slackSaving ? 'Disconnecting...' : 'Disconnect Slack'}
                      </button>
                    </div>
                  )}

                  {/* Alerts inside drawer */}
                  {slackError && (
                    <div className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded p-1.5 text-center mt-1">
                      {slackError}
                    </div>
                  )}
                  {slackSuccess && (
                    <div className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded p-1.5 text-center mt-1">
                      {slackSuccess}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-[#dadce0] pt-4 mt-auto">
              <button 
                onClick={handleLogout}
                className="w-full h-10 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition-colors duration-200"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
