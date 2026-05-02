import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check, User } from 'lucide-react';
import { cn } from '@ancore/ui-kit';
import type { AccountData } from '../types/dashboard';

export interface AccountSelectorProps {
  accounts: AccountData[];
  currentAccount: AccountData | null;
  onAccountChange: (account: AccountData) => void;
  className?: string;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  currentAccount,
  onAccountChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredAccounts = accounts.filter((account) =>
    account.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < filteredAccounts.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredAccounts.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredAccounts[highlightedIndex]) {
            onAccountChange(filteredAccounts[highlightedIndex]);
            setIsOpen(false);
            setSearchQuery('');
            setHighlightedIndex(-1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, highlightedIndex, filteredAccounts, onAccountChange]
  );

  const handleAccountSelect = useCallback(
    (account: AccountData) => {
      onAccountChange(account);
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    },
    [onAccountChange]
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchInputRef.current?.focus();
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  useEffect(() => {
    if (isOpen && filteredAccounts.length === 0) {
      setHighlightedIndex(-1);
    } else if (isOpen && highlightedIndex >= filteredAccounts.length) {
      setHighlightedIndex(0);
    }
  }, [isOpen, filteredAccounts.length, highlightedIndex]);

  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm rounded-md border',
          'bg-background hover:bg-accent transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          isOpen && 'ring-2 ring-primary ring-offset-2'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select account"
      >
        <User className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">
          {currentAccount ? formatAddress(currentAccount.address) : 'Select Account'}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-3 py-2 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-auto">
            {filteredAccounts.length > 0 ? (
              <ul role="listbox" className="py-1">
                {filteredAccounts.map((account, index) => (
                  <li key={account.address}>
                    <button
                      onClick={() => handleAccountSelect(account)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left',
                        'hover:bg-accent transition-colors',
                        'focus:outline-none focus:bg-accent',
                        highlightedIndex === index && 'bg-accent',
                        currentAccount?.address === account.address && 'bg-accent/50'
                      )}
                      role="option"
                      aria-selected={currentAccount?.address === account.address}
                    >
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{formatAddress(account.address)}</div>
                        <div className="text-xs text-muted-foreground">
                          Balance: {account.balance.toFixed(2)} • Status: {account.status}
                        </div>
                      </div>
                      {currentAccount?.address === account.address && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">No accounts found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
