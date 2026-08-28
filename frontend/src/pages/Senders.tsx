import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';

interface SenderProfile {
  id: string;
  name: string;
  smtpUser: string;
  maxEmailsPerHour: number;
  createdAt: string;
}

interface SendersProps {
  user: any;
  setUser: (user: any) => void;
}

export const Senders: React.FC<SendersProps> = ({ user, setUser }) => {
  const navigate = useNavigate();

  const [senders, setSenders] = useState<SenderProfile[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal / Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [maxEmailsPerHour, setMaxEmailsPerHour] = useState(50);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const meRes = await api.getMe();
      setUser(meRes.user);

      const [sendersRes, schedRes, sentRes] = await Promise.all([
        api.getSenders(),
        api.getScheduledEmails(),
        api.getSentEmails(),
      ]);

      setSenders(sendersRes.senders || []);
      setScheduledCount(schedRes.emails?.length || 0);
      setSentCount(sentRes.emails?.length || 0);
    } catch (err) {
      console.error('Failed to fetch senders data:', err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !smtpUser || !smtpPass) {
      setFormError('All fields are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.createSender({
        name,
        smtpUser,
        smtpPass,
        maxEmailsPerHour: Number(maxEmailsPerHour),
      });

      // Reset form & reload
      setName('');
      setSmtpUser('');
      setSmtpPass('');
      setMaxEmailsPerHour(50);
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add sender profile');
    } finally {
      setSaving(false);
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
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={() => {}}
          onRefresh={fetchData}
          placeholder="Search senders..."
        />

        {/* Page Content */}
        <div className="flex-1 p-gutter max-w-container-max w-full mx-auto overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden">
            {/* List Header */}
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
              <div>
                <h1 className="font-headline-md text-headline-md text-on-surface">Sender Profiles</h1>
                <p className="text-xs text-on-surface-variant mt-0.5">Manage SMTP accounts used to send campaigns.</p>
              </div>
              <button 
                onClick={() => setModalOpen(true)}
                className="bg-primary text-white hover:bg-surface-tint font-label-md text-label-md px-4 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Sender
              </button>
            </div>

            {/* List View */}
            {loading ? (
              <div className="p-8 text-center text-on-surface-variant">Loading sender profiles...</div>
            ) : senders.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">group</span>
                <p className="font-headline-md">No senders configured</p>
                <p className="text-sm mt-1">Configure a sender profile to begin scheduling campaigns.</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {senders.map((sender) => (
                  <li 
                    key={sender.id}
                    className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-lowest last:border-b-0 hover:bg-surface-container-low/30 transition-colors duration-150 relative"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center font-bold">
                        {sender.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">
                          {sender.name}
                        </span>
                        <span className="text-xs text-on-surface-variant mt-0.5">
                          SMTP User: {sender.smtpUser}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="font-label-sm text-label-sm text-on-surface-variant block">
                          Hourly Rate Limit
                        </span>
                        <span className="font-headline-md text-headline-md text-primary font-bold">
                          {sender.maxEmailsPerHour} /hr
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Add Sender Modal Popup */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-lowest rounded-xl max-w-md w-full border border-outline-variant shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h3 className="font-headline-md text-headline-md text-on-surface">Add SMTP Sender Profile</h3>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="material-symbols-outlined hover:text-red-500"
                >
                  close
                </button>
              </div>

              <form onSubmit={handleAddSender} className="p-6 flex flex-col gap-4">
                {formError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                    {formError}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Sender Name (display)</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Sales Team, John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">SMTP Username / Email</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. user@smtp.email.com"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">SMTP Password</label>
                  <input 
                    type="password"
                    required
                    placeholder="SMTP Account password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Hourly Rate Limit (emails/hour)</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={maxEmailsPerHour}
                    onChange={(e) => setMaxEmailsPerHour(Number(e.target.value))}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant">
                  <button 
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="font-label-md text-label-md text-on-surface hover:bg-surface-container px-4 py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="bg-primary text-white hover:bg-surface-tint font-label-md text-label-md px-6 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
