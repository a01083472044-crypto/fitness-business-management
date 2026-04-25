"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const TERM_KEY = "gym_staff_term";

export const STAFF_PRESETS = [
  { type: "헬스장 / PT샵",    term: "트레이너", icon: "🏋️" },
  { type: "필라테스 / 요가",  term: "강사",     icon: "🧘" },
  { type: "크로스핏",         term: "코치",     icon: "💪" },
  { type: "골프연습장",       term: "프로",     icon: "⛳" },
  { type: "직접 입력",        term: "",         icon: "✏️" },
];

interface StaffTermContextType {
  staffTerm: string;         // 예: "트레이너", "강사", "코치"
  setStaffTerm: (v: string) => void;
}

const StaffTermContext = createContext<StaffTermContextType>({
  staffTerm: "트레이너",
  setStaffTerm: () => {},
});

export function StaffTermProvider({ children }: { children: ReactNode }) {
  const [staffTerm, setStaffTermState] = useState("트레이너");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TERM_KEY);
      if (saved) setStaffTermState(saved);
    } catch {}
  }, []);

  const setStaffTerm = (v: string) => {
    const term = v.trim() || "트레이너";
    setStaffTermState(term);
    try { localStorage.setItem(TERM_KEY, term); } catch {}
  };

  return (
    <StaffTermContext.Provider value={{ staffTerm, setStaffTerm }}>
      {children}
    </StaffTermContext.Provider>
  );
}

export function useStaffTerm() {
  return useContext(StaffTermContext);
}
