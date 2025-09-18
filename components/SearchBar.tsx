'use client';

import { FormEvent, useState } from 'react';

interface SearchBarProps {
  initialQuery?: string;
  onSearch: (query: string) => void;
}

export function SearchBar({ initialQuery = '', onSearch }: SearchBarProps) {
  const [value, setValue] = useState(initialQuery);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 rounded-full bg-surface px-4 py-2 shadow">
      <svg className="h-5 w-5 text-white/60" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="16.65" y1="16.65" x2="21" y2="21" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search videos (Shorts are excluded)"
        className="flex-1 bg-transparent text-base text-white placeholder-white/40 focus:outline-none"
        aria-label="Search videos"
      />
      <button
        type="submit"
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-white"
      >
        Search
      </button>
    </form>
  );
}
