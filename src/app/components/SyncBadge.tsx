"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getGymCode } from "../lib/gymCode";

type SyncState = "idle" | "saving" | "saved" | "error";

export default function SyncBadge() {
  const [state, setState] = useState<SyncState>("idle");
  const [time,  setTime]  = useState("");
  const [show,  setShow]  = useState(false); // Supabase+gymCode 있을 때만 렌더

  useEffect(() => {
    // Supabase 미설정 or gymCode 없으면 숨김
    if (!supabase || !getGymCode()) return;
    setShow(true);

    function handler(e: Event) {
      const { state: s, time: t } = (e as CustomEvent<{ state: SyncState; time?: string }>).detail;
      setState(s);
      if (t) setTime(t);
    }
    window.addEventListener("gym-sync", handler);
    return () => window.removeEventListener("gym-sync", handler);
  }, []);

  if (!show || state === "idle") return null;

  const cfg: Record<string, { icon: string; label: string; cls: string }> = {
    saving: {
      icon:  "⏳",
      label: "저장 중...",
      cls:   "text-amber-700 bg-amber-50 border-amber-300",
    },
    saved: {
      icon:  "☁️",
      label: `자동저장 ${time}`,
      cls:   "text-emerald-700 bg-emerald-50 border-emerald-300",
    },
    error: {
      icon:  "⚠️",
      label: "저장 실패",
      cls:   "text-red-700 bg-red-50 border-red-300",
    },
  };

  const { icon, label, cls } = cfg[state] ?? cfg["error"];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${cls}`}
    >
      {icon} {label}
    </span>
  );
}
