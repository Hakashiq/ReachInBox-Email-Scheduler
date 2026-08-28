import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, scheduledCount, sentCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

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
              onClick={() => navigate('/slack')}
              className="w-full text-left px-4 py-2 text-sm text-on-surface-variant hover:bg-hover-tint flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">hub</span>
              Slack Integration
            </button>
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-outline-variant"
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
      </div>
    </nav>
  );
};
