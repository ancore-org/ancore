import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@ancore/ui-kit';

interface MobileNavProps {
  links: { to: string; label: string; end?: boolean }[];
}

export const MobileNav: React.FC<MobileNavProps> = ({ links }) => {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const focusableElements = drawerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const content = (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className="relative w-[280px] h-full bg-background border-r p-6 shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-8">
          <span className="font-semibold text-lg">Ancore</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  'px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      >
        <Menu className="w-6 h-6" />
      </button>

      {isOpen && createPortal(content, document.body)}
    </>
  );
};
