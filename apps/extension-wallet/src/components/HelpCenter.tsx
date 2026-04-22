import React, { useMemo, useState } from 'react';
import helpContent from '../data/help-content.json';

type HelpSection = 'gettingStarted' | 'features' | 'security' | 'faq';

interface HelpCenterProps {
  open: boolean;
  onClose: () => void;
}

const sectionLabels: Record<HelpSection, string> = {
  gettingStarted: 'Getting Started',
  features: 'Features',
  security: 'Security',
  faq: 'FAQ',
};

const sections: HelpSection[] = ['gettingStarted', 'features', 'security', 'faq'];

export const HelpCenter: React.FC<HelpCenterProps> = ({ open, onClose }) => {
  const [activeSection, setActiveSection] = useState<HelpSection>('gettingStarted');
  const [query, setQuery] = useState('');

  const filteredContent = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (activeSection === 'faq') {
      return helpContent.faq.filter(({ question, answer }) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          question.toLowerCase().includes(normalizedQuery) ||
          answer.toLowerCase().includes(normalizedQuery)
        );
      });
    }

    return helpContent[activeSection].filter(({ title, content }) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        title.toLowerCase().includes(normalizedQuery) ||
        content.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [activeSection, query]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
    >
      <div className="mx-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <header className="border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Help Center</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Find answers quickly</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/20 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <label className="mt-4 block">
            <span className="sr-only">Search help content</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics, issues, and keywords"
              className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-cyan-300/50 transition focus:ring"
            />
          </label>
        </header>

        <div className="grid grid-cols-4 gap-2 border-b border-white/10 p-3">
          {sections.map((section) => {
            const isActive = section === activeSection;

            return (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={[
                  'rounded-xl px-2 py-1.5 text-[11px] font-medium transition',
                  isActive
                    ? 'bg-cyan-300 text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {sectionLabels[section]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredContent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/60 p-4 text-sm text-slate-400">
              No results found. Try a different keyword.
            </div>
          ) : null}

          {activeSection === 'faq'
            ? (filteredContent as Array<{ question: string; answer: string }>).map((item) => (
                <details
                  key={item.question}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200"
                >
                  <summary className="cursor-pointer list-none font-medium text-white">
                    {item.question}
                  </summary>
                  <p className="mt-2 leading-6 text-slate-300">{item.answer}</p>
                </details>
              ))
            : (filteredContent as Array<{ title: string; content: string }>).map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.content}</p>
                </article>
              ))}
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
