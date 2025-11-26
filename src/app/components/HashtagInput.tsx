'use client';

import { useMemo, useState } from 'react';

interface HashtagInputProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
}

const DELIMITERS = [',', 'Enter', 'Tab', ' '];

export function HashtagInput({
  value,
  onChange,
  placeholder = '#fanedit',
  label = 'Required Hashtags',
  helperText = 'Press enter, comma, or space to add hashtags. Paste multiple hashtags at once and we will separate them.',
}: HashtagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const normalizedValue = useMemo(() => value ?? [], [value]);

  const normalizeHashtag = (tag: string) => {
    const trimmed = tag.trim().replace(/^#+/, '');
    if (!trimmed) return null;
    const cleaned = trimmed.replace(/\s+/g, '').toLowerCase();
    if (!cleaned) return null;
    return `#${cleaned}`;
  };

  const addHashtags = (raw: string) => {
    const parts = raw.split(/[,\s]+/).filter(Boolean);
    const normalized = parts
      .map(normalizeHashtag)
      .filter((tag): tag is string => Boolean(tag));

    if (!normalized.length) {
      return;
    }

    const deduped = Array.from(new Set([...normalizedValue, ...normalized]));
    onChange(deduped);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (DELIMITERS.includes(event.key)) {
      event.preventDefault();
      if (inputValue.trim()) {
        addHashtags(inputValue);
        setInputValue('');
      }
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addHashtags(inputValue);
      setInputValue('');
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData?.getData('text');
    if (!text) return;
    event.preventDefault();
    addHashtags(text);
    setInputValue('');
  };

  const removeHashtag = (tag: string) => {
    onChange(normalizedValue.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
          {label}
        </label>
      )}
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--color-primary)]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          className="w-full bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          placeholder={placeholder}
        />
      </div>
      {helperText && (
        <p className="text-[11px] text-[var(--color-text-muted)]">{helperText}</p>
      )}
      {normalizedValue.length === 0 ? (
        <div className="px-3 py-2 rounded border border-dashed border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]">
          No hashtags yet
        </div>
      ) : (
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            Added hashtags
          </p>
          <div className="flex flex-wrap gap-2">
            {normalizedValue.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-primary)]/12 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
              >
                {tag}
                <button
                  type="button"
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none"
                  onClick={() => removeHashtag(tag)}
                  aria-label={`Remove ${tag}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


