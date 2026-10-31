"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
};

/** Text field with a dropdown of earlier values. Typing a new value is allowed. */
export default function Combobox({ value, onChange, options, placeholder, id }: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [value, options]);

  const exact = options.some((o) => o.toLowerCase() === value.trim().toLowerCase());
  const showList = open && (filtered.length > 0 || (value.trim() && !exact));

  return (
    <div className="relative">
      <input
        id={id}
        className="field pr-10"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="words"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {options.length > 0 && (
        <button
          type="button"
          aria-label="Ver postos"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown size={18} />
        </button>
      )}
      {showList && (
        <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto card shadow-lg py-1">
          {filtered.map((o) => (
            <li key={o}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-surface-2 active:bg-surface-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            </li>
          ))}
          {value.trim() && !exact && (
            <li className="px-4 py-3 text-sm text-muted flex items-center gap-2 border-t border-line">
              <Plus size={14} /> Novo: <span className="text-ink font-semibold">{value.trim()}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
