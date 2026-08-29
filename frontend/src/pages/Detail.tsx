import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';

interface EmailDetail {
  id: string;
  campaignId: string;
  recipientEmail: string;
  status: string;
  scheduledTime: string;
  sentTime?: string | null;
  errorMessage?: string | null;
  etherealUrl?: string | null;
  subject?: string;
  body?: string;
  senderName?: string;
  retryCount?: number;
}

interface DetailProps {
  user: any;
  setUser: (user: any) => void;
}

export const Detail: React.FC<DetailProps> = ({ user, setUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEmailDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch user context
      const meRes = await api.getMe();
      setUser(meRes.user);

      // 2. Fetch both lists to find this specific email log
      const [schedRes, sentRes] = await Promise.all([
        api.getScheduledEmails(),
        api.getSentEmails(),
      ]);

      const allEmails = [...(schedRes.emails || []), ...(sentRes.emails || [])];
      setScheduledCount(schedRes.emails?.length || 0);
      setSentCount(sentRes.emails?.length || 0);

      const found = allEmails.find((e: any) => e.id === id);
      if (found) {
        // Map backend structure to page detail needs
        setEmail({
          id: found.id,
          campaignId: found.campaignId,
          recipientEmail: found.recipientEmail,
          status: found.status,
          scheduledTime: found.scheduledTime,
          sentTime: found.sentTime,
          errorMessage: found.errorMessage,
          etherealUrl: found.etherealUrl,
          subject: found.subject,
          body: found.body || '<i>(No content body)</i>',
          senderName: found.senderName || 'Sender Profile',
          retryCount: found.retryCount,
        });
      } else {
        console.error('Email log not found for ID:', id);
      }
    } catch (err) {
      console.error('Failed to load email details:', err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailDetails();
  }, [id]);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return isoString;
    }
  };

  if (!user) {
    return <div className="p-8 text-center">Loading User Session...</div>;
  }

  const recipientInitial = email?.recipientEmail?.charAt(0).toUpperCase() || 'R';

  return (
    <div className="bg-background text-on-background h-screen w-full overflow-hidden flex">
      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        scheduledCount={scheduledCount} 
        sentCount={sentCount} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen ml-[240px] max-w-container-max relative bg-background">
        {/* Top Header */}
        <header className="bg-surface border-b border-outline-variant docked full-width top-0 sticky z-10 flex items-center justify-between w-full h-[64px] px-gutter">
          <div className="flex items-center gap-space-md">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <h1 className="font-headline-md text-headline-md text-on-surface truncate">
              {email ? email.subject : 'Loading Email Details...'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchEmailDetails}
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200"
              title="Refresh"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </header>

        {/* Email Detail Canvas */}
        <main className="flex-1 overflow-y-auto p-margin-page">
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant">Loading email content thread...</div>
          ) : !email ? (
            <div className="p-8 text-center text-red-600 font-headline-md">Email log not found.</div>
          ) : (
            <article className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-sm flex flex-col min-h-full">
              {/* Thread Header */}
              <div className="px-space-lg py-space-md flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest rounded-t-lg">
                <div className="flex items-center gap-space-md">
                  <h1 className="font-headline-md text-headline-md text-on-surface font-semibold">
                    {email.subject}
                  </h1>
                </div>
                <div className="flex items-center gap-space-sm text-on-surface-variant">
                  {email.etherealUrl && (
                    <a 
                      href={email.etherealUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors uppercase tracking-wide mr-2"
                    >
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      Ethereal Preview
                    </a>
                  )}
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                    email.status === 'sent' 
                      ? 'bg-green-100 text-green-800' 
                      : email.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : email.retryCount && email.retryCount > 0
                      ? 'bg-[#FEF08A] text-[#854D0E] border border-[#FACC15]'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {email.status === 'scheduled' && email.retryCount && email.retryCount > 0
                      ? 'rescheduled (rate limit)'
                      : email.status}
                  </span>
                </div>
              </div>

              {/* Error Banner for Failed Emails */}
              {email.status === 'failed' && email.errorMessage && (
                <div className="mx-space-lg mt-space-md p-space-md bg-red-50 border-l-4 border-red-500 rounded text-red-800 text-sm">
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <div>
                      <p className="font-semibold">SMTP Sending Failed</p>
                      <p className="mt-1">{email.errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sender/Recipient Info Row */}
              <div className="px-space-lg py-space-md flex items-start justify-between">
                <div className="flex items-center gap-space-md">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline-md text-headline-md font-bold">
                    {recipientInitial}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="font-headline-md text-headline-md text-on-surface">To: {email.recipientEmail}</span>
                    </div>
                    <span className="text-xs text-on-surface-variant mt-1">
                      From: {email.senderName || 'Configured Sender Profile'}
                    </span>
                  </div>
                </div>
                <span className="font-meta-data text-meta-data text-on-surface-variant whitespace-nowrap mt-1">
                  Scheduled: {formatTime(email.scheduledTime)}
                  {email.sentTime && ` | Sent: ${formatTime(email.sentTime)}`}
                </span>
              </div>

              {/* Email Content Body */}
              <div 
                className="px-space-lg py-space-md font-body-md text-body-md text-on-surface flex-1 flex flex-col gap-space-md max-w-[800px]"
                dangerouslySetInnerHTML={{ __html: email.body || '' }}
              />

            </article>
          )}
        </main>
      </div>
    </div>
  );
};
