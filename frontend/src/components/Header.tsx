import React from 'react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (q: string) => void;
  onRefresh: () => void;
  placeholder?: string;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  onRefresh,
  placeholder = 'Search emails...',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(searchQuery);
    }
  };

  return (
    <header className="bg-surface-container-lowest h-[64px] px-gutter border-b border-outline-variant flex items-center justify-between shrink-0 sticky top-0 z-10 w-full max-w-container-max mx-auto">
      <div className="flex-1 max-w-2xl relative group">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none group-focus-within:text-primary transition-colors">
          search
        </span>
        <input 
          className="w-full h-[36px] pl-10 pr-4 bg-[#F4F7F5] border-none rounded-full font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200 outline-none" 
          placeholder={placeholder} 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="flex items-center gap-2 ml-4">
        <button 
          onClick={() => onSearch(searchQuery)}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus:ring-2 focus:ring-primary"
          title="Filter / Search"
        >
          <span className="material-symbols-outlined text-[20px]">filter_list</span>
        </button>
        <button 
          onClick={onRefresh}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 focus:ring-2 focus:ring-primary"
          title="Refresh List"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
        </button>
      </div>
    </header>
  );
};
