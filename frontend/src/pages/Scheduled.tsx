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
  subject?: string;
  bodySnippet?: string;
}

interface ScheduledProps {
  user: any;
  setUser: (user: any) => void;
}

export const Scheduled: React.FC<ScheduledProps> = ({ user, setUser }) => {
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

      // 2. Fetch scheduled list
      const schedRes = await api.getScheduledEmails();
      setEmails(schedRes.emails || []);
      setScheduledCount(schedRes.emails?.length || 0);

      // 3. Fetch sent count for sidebar indicator
      const sentRes = await api.getSentEmails();
      setSentCount(sentRes.emails?.length || 0);
    } catch (err) {
      console.error('Failed to fetch scheduled data:', err);
      // Redirect to login if unauthorized
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchSilentData = async () => {
    try {
      const schedRes = await api.getScheduledEmails();
      setEmails(schedRes.emails || []);
      setScheduledCount(schedRes.emails?.length || 0);

      const sentRes = await api.getSentEmails();
      setSentCount(sentRes.emails?.length || 0);
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
      // Map Elasticsearch hit sources to matching log structure
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
      // Filter results to only show scheduled ones on this view
      setEmails(results.filter((e: any) => e.status === 'scheduled'));
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return isoString;
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading User Session...</div>;
  }

  return (
    <div className="bg-surface text-on-surface h-screen overflow-hidden flex">
      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        scheduledCount={scheduledCount} 
        sentCount={sentCount} 
      />

      {/* Main Content Area */}
      <main className="ml-[240px] flex-1 flex flex-col h-full bg-surface-container-lowest">
        {/* Header Search & Refresh */}
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          onRefresh={fetchData}
          placeholder="Search scheduled emails..."
        />

        {/* Scheduled List */}
        <div className="flex-1 overflow-y-auto w-full">
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant">Loading scheduled list...</div>
          ) : emails.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2">schedule</span>
              <p className="font-headline-md">No scheduled emails found</p>
              <p className="text-sm mt-1">Compose a new email to schedule a campaign.</p>
            </div>
          ) : (
            <div className="flex flex-col bg-surface-container-lowest">
              {emails.map((email) => {
                const recipientName = email.recipientEmail.split('@')[0];
                return (
                  <div 
                    key={email.id}
                    onClick={() => navigate(`/emails/${email.id}`)}
                    className="flex items-center px-gutter py-4 border-b border-outline-variant hover:bg-hover-tint transition-colors cursor-pointer group"
                  >
                    <div className="w-1/4 min-w-[150px]">
                      <span className="font-headline-md text-headline-md text-on-surface truncate block">
                        To: {recipientName}
                      </span>
                    </div>
                    
                    <div className="w-48 shrink-0 flex items-center">
                      <div className="bg-badge-green text-badge-green-text px-3 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span className="font-label-sm text-label-sm">
                          {formatTime(email.scheduledTime)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-headline-md text-headline-md text-on-surface truncate">
                        {email.subject || 'No Subject'}
                      </span>
                      <span className="text-on-surface-variant font-body-sm text-body-sm shrink-0">
                        - Scheduled -
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {email.bodySnippet || 'No preview available...'}
                      </span>
                    </div>

                    <div className="w-10 flex justify-end shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Star logic placeholder
                        }}
                        className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity hover:text-yellow-500"
                      >
                        <span className="material-symbols-outlined text-[20px]">star</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
