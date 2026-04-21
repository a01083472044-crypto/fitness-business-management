export interface Member {
  id: string;
  name: string;
  phone: string;
  trainer: string;
  totalPayment: number;
  totalSessions: number;
  conductedSessions: number;
}

export interface MonthlyCosts {
  month: string; // YYYY-MM
  rent: number;
  trainerSalary: number;
  freelanceSalary: number;
  utilities: number;
  communication: number;
  depreciation: number;
  otherFixed: number;
  supplies: number;
  marketing: number;
  otherVariable: number;
  isVat: boolean;
}

export interface CalcPrefill {
  totalPayment: number;
  totalSessions: number;
  conductedSessions: number;
  rent: number;
  trainerSalary: number;
  freelanceSalary: number;
  depreciation: number;
  otherFixed: number;
  supplies: number;
  marketing: number;
  otherVariable: number;
  isVat: boolean;
}

const MEMBERS_KEY = "gym_members";
const COSTS_KEY = "gym_costs";
const PREFILL_KEY = "calc_prefill";

export function getMembers(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveMembers(members: Member[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function getCosts(): MonthlyCosts[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(COSTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCosts(costs: MonthlyCosts[]) {
  localStorage.setItem(COSTS_KEY, JSON.stringify(costs));
}

export function getPrefill(): CalcPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setPrefill(data: CalcPrefill) {
  localStorage.setItem(PREFILL_KEY, JSON.stringify(data));
}

export function clearPrefill() {
  localStorage.removeItem(PREFILL_KEY);
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function emptyCosts(month: string): MonthlyCosts {
  return {
    month,
    rent: 0,
    trainerSalary: 0,
    freelanceSalary: 0,
    utilities: 0,
    communication: 0,
    depreciation: 0,
    otherFixed: 0,
    supplies: 0,
    marketing: 0,
    otherVariable: 0,
    isVat: false,
  };
}

export function formatManwon(n: number): string | null {
  if (!n) return null;
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  let result = "";
  if (eok) result += eok + "억 ";
  if (man) result += man + "만";
  if (!eok && !man && rest) result += rest;
  return result.trim() ? result.trim() + "원" : null;
}
