import { useState, type FormEvent } from 'react';
import { Icon } from '../../../shared/components/Icon';
import { termFromText } from '../data/poiCatalog';
import type { PoiSearchTerm } from '../types';

type PoiTermInputProps = { label: string; placeholder: string; onSubmit: (term: PoiSearchTerm) => void };

/** Ô nhập từ khóa tự do ("phở", "sửa xe", "Highlands"…); khớp danh mục thì gửi danh mục. */
export function PoiTermInput({ label, placeholder, onSubmit }: PoiTermInputProps) {
  const [text, setText] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = termFromText(text);
    if (term) onSubmit(term);
  };

  return (
    <form onSubmit={submit} className="relative shrink-0" role="search" aria-label={label}>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft dark:text-slate-400"
      />
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        maxLength={80}
        className="h-10 w-32 rounded-full md:w-44 bg-white/90 pl-9 pr-3 text-[13px] text-ink shadow-sm ring-1 ring-black/5 backdrop-blur-xl placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/85 dark:text-slate-100 dark:ring-white/10 dark:placeholder:text-slate-500"
      />
    </form>
  );
}
