'use client';

import { useEffect, useRef, useState } from 'react';

interface SettingsState {
  region: string;
  language: string;
  minDurationMinutes: number;
}

interface SettingsDrawerProps {
  value: SettingsState;
  onChange: (value: SettingsState) => void;
}

const regions = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'JP', label: 'Japan' }
];

const languages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' }
];

export function SettingsDrawer({ value, onChange }: SettingsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const update = (partial: Partial<SettingsState>) => {
    onChange({ ...value, ...partial });
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.325 4.317a1 1 0 0 1 .764-.317h1.822a1 1 0 0 1 .764.317l1.2 1.273a1 1 0 0 0 .683.315l1.676.094a1 1 0 0 1 .94.94l.094 1.676a1 1 0 0 0 .315.683l1.273 1.2a1 1 0 0 1 0 1.528l-1.273 1.2a1 1 0 0 0-.315.683l-.094 1.676a1 1 0 0 1-.94.94l-1.676.094a1 1 0 0 0-.683.315l-1.2 1.273a1 1 0 0 1-.764.317h-1.822a1 1 0 0 1-.764-.317l-1.2-1.273a1 1 0 0 0-.683-.315l-1.676-.094a1 1 0 0 1-.94-.94l-.094-1.676a1 1 0 0 0-.315-.683l-1.273-1.2a1 1 0 0 1 0-1.528l1.273-1.2a1 1 0 0 0 .315-.683l.094-1.676a1 1 0 0 1 .94-.94l1.676-.094a1 1 0 0 0 .683-.315z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Settings
      </button>
      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">Preferences</h2>
            <div className="mt-4 space-y-5 text-sm text-white/80">
              <label className="flex flex-col gap-2">
                <span>Region</span>
                <select
                  value={value.region}
                  onChange={(event) => update({ region: event.target.value })}
                  className="rounded-lg border border-white/10 bg-background px-3 py-2"
                >
                  {regions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span>Language</span>
                <select
                  value={value.language}
                  onChange={(event) => update({ language: event.target.value })}
                  className="rounded-lg border border-white/10 bg-background px-3 py-2"
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span>Hide videos shorter than (minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={value.minDurationMinutes}
                  onChange={(event) => update({ minDurationMinutes: Number(event.target.value) })}
                  className="rounded-lg border border-white/10 bg-background px-3 py-2"
                />
                <p className="text-xs text-white/50">
                  Shorts are always excluded. Increase this if you only want longer videos.
                </p>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  onChange({ region: 'US', language: 'en', minDurationMinutes: 1 });
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export type { SettingsState };
