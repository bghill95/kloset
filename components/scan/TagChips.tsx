"use client";

import { useState } from "react";

export default function TagChips({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim().toLowerCase();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-sm"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={`+ add ${label.toLowerCase()}`}
          aria-label={`Add ${label.toLowerCase()}`}
          className="w-36 rounded-full border border-dashed border-neutral-400 px-3 py-1 text-sm"
        />
      </div>
    </div>
  );
}
