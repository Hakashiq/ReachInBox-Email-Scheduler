const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper to make fetch requests with credentials/cookies
async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important to pass session cookies!
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      // Ignore if not JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Authentication
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  mockLogin: (email: string) => request('/auth/mock-login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  // Senders
  getSenders: () => request('/emails/senders'),
  createSender: (data: { name: string; smtpUser: string; smtpPass: string; maxEmailsPerHour: number }) =>
    request('/emails/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Campaigns & Scheduling
  scheduleCampaign: (data: {
    senderId: string;
    subject: string;
    body: string;
    leads: string[];
    startTime: string;
    delayBetweenEmailsSec: number;
    hourlyLimit: number;
  }) => request('/emails/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Lists
  getScheduledEmails: () => request('/emails/scheduled'),
  getSentEmails: () => request('/emails/sent'),

  // Search
  searchEmails: (query: string) => request(`/emails/search?q=${encodeURIComponent(query)}`),

  // Slack Connection
  getSlackStatus: () => request('/slack/status'),
  connectSlackWebhook: (webhookUrl: string) => request('/slack/connect-webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl }),
  }),
  disconnectSlack: () => request('/slack/disconnect', { method: 'POST' }),
};

export { API_BASE };
