import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface SenderProfile {
  id: string;
  name: string;
  smtpUser: string;
}

export const Compose: React.FC = () => {
  const navigate = useNavigate();

  // Form states
  const [senders, Senders] = useState<SenderProfile[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetweenEmailsSec, setDelayBetweenEmailsSec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [startTime, setStartTime] = useState(() => {
    // Default to current time + 1 minute
    const date = new Date(Date.now() + 60 * 1000);
    // Format to local date-time string YYYY-MM-DDThh:mm
    const tzoffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
  });

  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch senders on mount
  useEffect(() => {
    const loadSenders = async () => {
      try {
        const res = await api.getSenders();
        Senders(res.senders || []);
        if (res.senders && res.senders.length > 0) {
          setSelectedSenderId(res.senders[0].id);
        }
      } catch (err) {
        console.error('Failed to load senders:', err);
      }
    };
    loadSenders();
  }, []);

  const handleAddRecipient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = recipientInput.trim().toLowerCase();
    if (trimmed && !recipients.includes(trimmed)) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setRecipients([...recipients, trimmed]);
        setRecipientInput('');
        setError('');
      } else {
        setError('Please enter a valid email address');
      }
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Split by commas, newlines, or semicolons
      const emails = text
        .split(/[\n,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

      if (emails.length > 0) {
        // Unique merge
        const merged = Array.from(new Set([...recipients, ...emails]));
        setRecipients(merged);
        setError('');
        setSuccessMsg(`Successfully imported ${emails.length} leads!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError('No valid email addresses found in the file');
      }
    };
    reader.readAsText(file);
  };

  const applyFormat = (tag: string) => {
    const textarea = document.getElementById('email-body-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    const replacement = `<${tag}>${selectedText}</${tag}>`;
    const newBody = text.substring(0, start) + replacement + text.substring(end);
    
    setBody(newBody);

    // Refocus and restore selection
    setTimeout(() => {
      textarea.focus();
      const offset = tag.length + 2; // e.g. "<b>" is 3 characters
      textarea.setSelectionRange(start + offset, start + offset + selectedText.length);
    }, 10);
  };

  const handleSendLater = async () => {
    if (!selectedSenderId) {
      setError('Please select a sender profile');
      return;
    }
    if (recipients.length === 0) {
      setError('Please add at least one recipient email');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!body.trim()) {
      setError('Email message body is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.scheduleCampaign({
        senderId: selectedSenderId,
        subject,
        body: body.replace(/\n/g, '<br/>'), // Convert newlines to HTML br
        leads: recipients,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmailsSec: Number(delayBetweenEmailsSec),
        hourlyLimit: Number(hourlyLimit),
      });

      navigate('/scheduled');
    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign');
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex justify-center p-space-md lg:p-space-lg font-body-md">
      {/* Main Container */}
      <main className="w-full max-w-5xl bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <header className="flex items-center justify-between p-space-lg border-b border-outline-variant">
          <div 
            onClick={() => navigate(-1)}
            className="flex items-center gap-space-sm cursor-pointer hover:bg-surface-container-low p-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface">arrow_back</span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Compose New Campaign</h1>
          </div>
          <div className="flex items-center gap-space-md">
            <button 
              onClick={() => setPanelOpen(!panelOpen)}
              className={`hover:bg-surface-container-low p-2 rounded-full transition-colors relative ${panelOpen ? 'text-primary' : 'text-on-surface-variant'}`} 
              title="Schedule Campaign Configuration"
            >
              <span className="material-symbols-outlined">schedule</span>
            </button>
            <button 
              onClick={handleSendLater}
              disabled={loading}
              className="bg-primary-container text-white border border-primary hover:bg-[#009650] font-label-md text-label-md px-5 py-2 rounded transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Schedule Campaign'}
            </button>
          </div>
        </header>

        {/* Display Status Alerts */}
        {error && (
          <div className="mx-space-lg mt-4 text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mx-space-lg mt-4 text-center text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-2">
            {successMsg}
          </div>
        )}

        {/* Form Fields Container */}
        <div className="p-space-lg flex flex-col gap-space-md">
          {/* From Field */}
          <div className="flex items-center border-b border-outline-variant pb-space-sm">
            <label className="font-label-md text-label-md text-on-surface-variant w-24">From Sender</label>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="bg-surface-container-low rounded-lg px-3 py-1 cursor-pointer border border-transparent focus:border-outline outline-none text-sm font-body-sm text-on-surface"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.smtpUser})
                </option>
              ))}
            </select>
          </div>

          {/* To Field with Interactive Chips */}
          <div className="flex items-start border-b border-outline-variant pb-space-sm pt-space-sm relative">
            <label className="font-label-md text-label-md text-on-surface-variant w-24 mt-2">To Leads</label>
            <div className="flex-1 flex flex-wrap gap-2 items-center min-h-[36px] pr-32">
              {recipients.map((email) => (
                <div 
                  key={email}
                  className="flex items-center gap-1 bg-[#E8F7EF] border border-primary text-primary rounded-full px-3 py-1 font-body-sm text-body-sm"
                >
                  <span>{email}</span>
                  <button 
                    onClick={() => handleRemoveRecipient(email)}
                    className="material-symbols-outlined text-[14px] hover:text-red-600 font-bold"
                  >
                    close
                  </button>
                </div>
              ))}
              <input
                type="text"
                placeholder="Type email & press Enter"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRecipient(e);
                }}
                className="bg-transparent border-none p-0 focus:ring-0 font-body-sm text-body-sm text-on-surface placeholder-on-surface-variant/50 outline-none w-48"
              />
            </div>
            
            <div className="absolute right-0 top-2 flex items-center">
              <label className="text-primary font-label-md text-label-md flex items-center gap-1 hover:underline cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">upload</span>
                Upload List
                <input 
                  type="file" 
                  accept=".txt,.csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Subject Field */}
          <div className="flex items-center border-b border-outline-variant pb-space-sm pt-space-sm">
            <label className="font-label-md text-label-md text-on-surface-variant w-24">Subject</label>
            <input 
              className="flex-1 bg-transparent border-none p-0 focus:ring-0 font-body-sm text-body-sm text-on-surface placeholder-on-surface-variant/50 outline-none" 
              placeholder="Enter subject line..." 
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Spacing & Hourly limits config */}
          <div className="flex items-center gap-space-lg pt-space-sm bg-[#F4F7F5] p-3 rounded-lg mt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant">Delay between emails (sec)</label>
              <input 
                className="w-16 h-8 text-center bg-surface-container-lowest border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary font-body-sm text-body-sm outline-none" 
                type="number"
                min="0"
                value={delayBetweenEmailsSec}
                onChange={(e) => setDelayBetweenEmailsSec(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant">Sender Hourly Limit</label>
              <input 
                className="w-16 h-8 text-center bg-surface-container-lowest border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary font-body-sm text-body-sm outline-none" 
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Editor Area & Scheduler Panel */}
        <div className="flex-1 flex px-space-lg pb-space-lg relative gap-space-lg min-h-[300px]">
          {/* Rich Text Editor */}
          <div className="flex-1 flex flex-col bg-[#FAFAFA] rounded-xl overflow-hidden border border-outline-variant/30 relative">
            {/* Rich Editor Toolbar */}
            <div className="bg-surface-container-lowest border-b border-outline-variant/30 p-2 flex items-center flex-wrap gap-1 mx-4 mt-4 rounded-xl shadow-sm">
              <button type="button" className="p-1.5 text-secondary hover:bg-surface-container-low rounded"><span className="material-symbols-outlined text-[20px]">undo</span></button>
              <button type="button" className="p-1.5 text-secondary hover:bg-surface-container-low rounded"><span className="material-symbols-outlined text-[20px]">redo</span></button>
              <div className="w-px h-4 bg-outline-variant mx-1"></div>
              <button type="button" onClick={() => applyFormat('b')} className="p-1.5 text-secondary hover:bg-surface-container-low rounded font-bold" title="Bold (Wrap with <b>)">B</button>
              <button type="button" onClick={() => applyFormat('i')} className="p-1.5 text-secondary hover:bg-surface-container-low rounded italic" title="Italic (Wrap with <i>)">I</button>
              <button type="button" onClick={() => applyFormat('u')} className="p-1.5 text-secondary hover:bg-surface-container-low rounded underline" title="Underline (Wrap with <u>)">U</button>
              <div className="w-px h-4 bg-outline-variant mx-1"></div>
              <button type="button" className="p-1.5 text-secondary hover:bg-surface-container-low rounded"><span className="material-symbols-outlined text-[20px]">format_align_left</span></button>
              <button type="button" onClick={() => applyFormat('li')} className="p-1.5 text-secondary hover:bg-surface-container-low rounded" title="List Item (Wrap with <li>)"><span className="material-symbols-outlined text-[20px]">format_list_bulleted</span></button>
              <button type="button" className="p-1.5 text-secondary hover:bg-surface-container-low rounded"><span className="material-symbols-outlined text-[20px]">insert_link</span></button>
            </div>
            
            {/* Textarea */}
            <div className="flex-1 p-6">
              <textarea 
                id="email-body-textarea"
                className="w-full h-full bg-transparent border-none resize-none focus:ring-0 font-body-sm text-body-sm text-on-surface placeholder-on-surface-variant/50 outline-none" 
                placeholder="Type your email body here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>

          {/* Send Later Calendar Config Panel */}
          {panelOpen && (
            <aside className="w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-md flex flex-col shrink-0">
              <div className="p-space-md border-b border-outline-variant">
                <h3 className="font-headline-md text-headline-md text-on-surface">Schedule Send</h3>
              </div>
              <div className="p-space-md flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-on-surface-variant">Pick start date & time</span>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border border-outline-variant rounded px-3 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary outline-none font-body-sm text-body-sm mt-1"
                  />
                </div>
                
                {/* Standard Quick select options */}
                <div className="flex flex-col gap-1 mt-2">
                  <button 
                    onClick={() => {
                      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
                      setStartTime(tomorrow.toISOString().slice(0, 16));
                    }}
                    type="button"
                    className="text-left py-2 px-2 hover:bg-surface-container-low rounded font-body-sm text-body-sm text-on-surface transition-colors"
                  >
                    Tomorrow
                  </button>
                  <button 
                    onClick={() => {
                      const tomorrow10 = new Date(Date.now() + 24 * 3600 * 1000);
                      tomorrow10.setHours(10, 0, 0, 0);
                      setStartTime(tomorrow10.toISOString().slice(0, 16));
                    }}
                    type="button"
                    className="text-left py-2 px-2 hover:bg-surface-container-low rounded font-body-sm text-body-sm text-on-surface transition-colors"
                  >
                    Tomorrow, 10:00 AM
                  </button>
                </div>
              </div>
              
              <div className="p-space-md flex justify-end gap-3 mt-auto border-t border-outline-variant bg-gray-50 rounded-b-xl">
                <button 
                  onClick={() => setPanelOpen(false)}
                  className="font-label-md text-label-md text-on-surface hover:bg-surface-container-low px-4 py-2 rounded transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => setPanelOpen(false)}
                  className="font-label-md text-label-md bg-primary-container text-white border border-primary hover:bg-[#009650] px-4 py-2 rounded transition-colors"
                >
                  OK
                </button>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};
