"use client";

import { useState } from "react";

interface Faq { q: string; a: string; }

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {faqs.map((f, i) => (
        <div key={i} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex justify-between items-center px-6 py-4 text-left font-bold text-zinc-900 hover:bg-zinc-50 transition-colors"
          >
            <span>{f.q}</span>
            <span className={`text-blue-500 text-xl transition-transform duration-200 ${open === i ? "rotate-45" : ""}`}>+</span>
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-sm text-zinc-600 leading-relaxed border-t border-zinc-50 pt-3">
              {f.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
