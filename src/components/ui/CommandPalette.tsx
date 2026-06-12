import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Compass, Briefcase, FileText, Settings, DollarSign, Users, Shield, Calendar, HelpCircle, Layers } from 'lucide-react';

interface CommandItem {
  name: string;
  category: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  keywords: string;
}

const COMMANDS: CommandItem[] = [
  { name: 'Dashboard', category: 'Navigation', path: '/dashboard', icon: Compass, keywords: 'home main analytics' },
  { name: 'Projects Registry', category: 'Projects', path: '/projects', icon: Briefcase, keywords: 'contracts execution' },
  { name: 'Initialize Project', category: 'Projects', path: '/projects/new', icon: Briefcase, keywords: 'create new start' },
  { name: 'Tenders & RFPs', category: 'Sales', path: '/tenders', icon: Layers, keywords: 'bid estimates proposals' },
  { name: 'Quotations Catalog', category: 'Sales', path: '/quotations', icon: FileText, keywords: 'client proposal price' },
  { name: 'Receivables (AR Invoices)', category: 'Finance', path: '/finance/ar', icon: DollarSign, keywords: 'billing client cash' },
  { name: 'Payables (AP Invoices)', category: 'Finance', path: '/finance/ap', icon: DollarSign, keywords: 'suppliers matching payments' },
  { name: 'VAT Return (Form 201)', category: 'Finance', path: '/finance/vat', icon: Shield, keywords: 'fta government taxes' },
  { name: 'HR / Employee Registry', category: 'People', path: '/hr', icon: Users, keywords: 'team staff payroll' },
  { name: 'Timesheets Calendar', category: 'People', path: '/timesheets', icon: Calendar, keywords: 'hours log work' },
  { name: 'System Settings', category: 'Configuration', path: '/admin/settings', icon: Settings, keywords: 'admin preferences profile' },
  { name: 'Support / Service Desk', category: 'Help', path: '/service-desk', icon: HelpCircle, keywords: 'tickets requests errors' },
];

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle command palette on Cmd/Ctrl + K and custom events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter commands
  const filteredCommands = COMMANDS.filter(cmd => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(lower) ||
      cmd.category.toLowerCase().includes(lower) ||
      cmd.keywords.toLowerCase().includes(lower)
    );
  });

  // Handle arrow keys and navigation
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          router.push(filteredCommands[selectedIndex].path);
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [isOpen, selectedIndex, filteredCommands, router]);

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-[1000] flex items-start justify-center pt-[15vh] px-4">
      <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[50vh]">
        {/* Search Input bar */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border-color)] py-3">
          <Search size={18} className="text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search path..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />
          <kbd className="text-[10px] bg-[var(--bg-dark)] text-[var(--text-muted)] border border-[var(--border-color)] px-1.5 py-0.5 rounded shadow select-none">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-transparent max-h-[350px] custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="text-[var(--text-muted)] text-xs py-8 text-center font-medium">
              No matching pages or actions found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={cmd.name}
                  data-active={isSelected}
                  onClick={() => {
                    router.push(cmd.path);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition-colors duration-150 ${
                    isSelected ? 'bg-[var(--primary-glow)] text-[var(--text-primary)] border-l-2 border-l-[var(--primary)]' : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} />
                    <div>
                      <span className="text-xs font-semibold block leading-none mb-1">
                        {cmd.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {cmd.category}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[9px] text-[var(--primary)] font-bold uppercase tracking-wider bg-[var(--primary-glow)] px-1.5 py-0.5 rounded border border-[var(--primary)]/10">
                      Jump
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="bg-[var(--bg-dark)] border-t border-[var(--border-color)] px-4 py-2 flex items-center justify-between text-[9px] text-[var(--text-muted)] font-semibold select-none">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Enter</span>
          </div>
          <div>JEET Command Center</div>
        </div>
      </div>
    </div>
  );
};
