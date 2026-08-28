import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';

interface EmailLog {
  id: string;
  campaignId: string;
  recipientEmail: string;
  status: string;
  scheduledTime: string;
  sentTime?: string | null;
  errorMessage?: string | null;
  subject?: string;
  bodySnippet?: string;
}

interface SentProps {
  user: any;
  setUser: (user: any) => void;
}

export const Sent: React.FC<SentProps> = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current user context
      const meRes = await api.getMe();
      setUser(meRes.user);

      // 2. Fetch sent/failed list
      const sentRes = await api.getSentEmails();
      setEmails(sentRes.emails || []);
      setSentCount(sentRes.emails?.length || 0);

      // 3. Fetch scheduled count for sidebar indicator
      const schedRes = await api.getScheduledEmails();
      setScheduledCount(schedRes.emails?.length || 0);
    } catch (err) {
      console.error('Failed to fetch sent emails data:', err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchSilentData = async () => {
    try {
      const sentRes = await api.getSentEmails();
      setEmails(sentRes.emails || []);
      setSentCount(sentRes.emails?.length || 0);

      const schedRes = await api.getScheduledEmails();
      setScheduledCount(schedRes.emails?.length || 0);
    } catch (err) {
      console.error('Silent refresh failed:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchSilentData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      fetchData();
      return;
    }
    setLoading(true);
    try {
      const searchRes = await api.searchEmails(query);
      const results = (searchRes.results || []).map((doc: any) => ({
        id: doc.email_id,
        campaignId: doc.campaign_id,
        recipientEmail: doc.recipient,
        status: doc.status,
        scheduledTime: doc.scheduled_time,
        sentTime: doc.sent_time,
        subject: doc.subject,
        bodySnippet: doc.body ? doc.body.replace(/<[^>]*>/g, '').substring(0, 60) + '...' : '',
      }));
      // Filter results to only show sent or failed ones on this view
      setEmails(results.filter((e: any) => e.status === 'sent' || e.status === 'failed'));
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading User Session...</div>;
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-screen antialiased selection:bg-primary-container selection:text-on-primary">
      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        scheduledCount={scheduledCount} 
        sentCount={sentCount} 
      />

      {/* Main Content Area */}
      <main className="flex-1 ml-[240px] flex flex-col min-h-screen">
        {/* TopAppBar Search */}
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          onRefresh={fetchData}
          placeholder="Search sent emails..."
        />

        {/* Page Content */}
        <div className="flex-1 p-gutter max-w-container-max w-full mx-auto overflow-y-auto">
          {/* List Container */}
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden">
            {/* List Header */}
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
              <h1 className="font-headline-md text-headline-md text-on-surface">Sent & Failed Emails</h1>
              <span className="font-meta-data text-meta-data text-on-surface-variant">
                Showing latest sends ({emails.length} total)
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-on-surface-variant">Loading sent list...</div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2">send</span>
                <p className="font-headline-md">No sent emails found</p>
                <p className="text-sm mt-1">Sent campaign logs will appear here once processed.</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {emails.map((email) => {
                  const recipientName = email.recipientEmail.split('@')[0];
                  return (
                    <li 
                      key={email.id}
                      onClick={() => navigate(`/emails/${email.id}`)}
                      className="group flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-lowest last:border-b-0 hover:bg-surface-container-low/30 transition-colors duration-150 cursor-pointer relative"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-transparent group-hover:bg-primary-container/20 transition-colors"></div>
                      
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Recipient */}
                        <div className="w-48 shrink-0">
                          <span className="font-label-md text-label-md text-on-surface truncate block">
                            To: {recipientName} ({email.recipientEmail})
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {email.status === 'failed' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 uppercase tracking-wide" title={email.errorMessage || ''}>
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant uppercase tracking-wide">
                              Sent
                            </span>
                          )}
                        </div>

                        {/* Subject & Snippet */}
                        <div className="flex-1 truncate min-w-0 flex items-baseline gap-2">
                          <span className="font-label-md text-label-md text-on-surface truncate">
                            {email.subject || 'No Subject'}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                            - {email.bodySnippet || 'No preview available...'}
                          </span>
                        </div>
                      </div>

                      {/* Trailing Action */}
                      <div className="shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="text-on-surface-variant hover:text-yellow-500 transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-[20px]">star</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
