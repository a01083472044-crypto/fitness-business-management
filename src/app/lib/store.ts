import { pushToCloud } from "./sync";

// ── 스케줄 ─────────────────────────────────────────────────────────────────
export interface ScheduleEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // "09:00"
  trainerId: string;
  trainerName: string;
  memberId: string;
  memberName: string;
  packageId: string;   // "" = 패키지 미연동
  note: string;
  done: boolean;       // 완료 여부
}

// ── PT 패키지 ──────────────────────────────────────────────────────────────
export interface SessionPackage {
  id: string;
  name: string;              // 수업명 (예: "홍성은 수업")
  trainerName: string;       // 담당 트레이너
  trainerType: "정규직" | "프리랜서" | "";
  totalSessions: number;     // 결제 회차
  conductedSessions: number; // 진행 회차
  paymentAmount: number;     // 결제 금액
  registeredAt: string;      // YYYY-MM-DD
}

// ── 회원 ───────────────────────────────────────────────────────────────────
export interface Member {
  id: string;
  name: string;
  phone: string;
  trainer: string;
  trainerType: "정규직" | "프리랜서" | "";
  totalPayment: number;       // packages 합산 (또는 수동 입력)
  totalSessions: number;
  conductedSessions: number;
  packages: SessionPackage[]; // PT 패키지 목록
}

// packages가 있으면 합산값을 Member의 집계 필드에 동기화
export function syncMemberTotals(m: Member): Member {
  const pkgs = m.packages ?? [];
  if (pkgs.length === 0) return m;
  return {
    ...m,
    totalPayment:      pkgs.reduce((s, p) => s + p.paymentAmount, 0),
    totalSessions:     pkgs.reduce((s, p) => s + p.totalSessions, 0),
    conductedSessions: pkgs.reduce((s, p) => s + p.conductedSessions, 0),
  };
}

// ── 월별 비용 ──────────────────────────────────────────────────────────────
export interface MonthlyCosts {
  month: string;
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

// ── 계산기 프리필 ──────────────────────────────────────────────────────────
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

// ── 트레이너 ───────────────────────────────────────────────────────────────
export interface Trainer {
  id: string;
  name: string;
  phone: string;
  branch: string;
  status: "재직" | "퇴사";
  empType: "정규직" | "프리랜서";
  joinDate: string;
  memo: string;
}

// ── 스토리지 키 ────────────────────────────────────────────────────────────
const SCHEDULE_KEY = "gym_schedule";
const MEMBERS_KEY  = "gym_members";
const COSTS_KEY    = "gym_costs";
const PREFILL_KEY  = "calc_prefill";
const TRAINERS_KEY = "gym_trainers";

// ── CRUD 함수 ──────────────────────────────────────────────────────────────
export function getMembers(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
    // 기존 데이터 호환: packages 필드 없으면 빈 배열 주입
    return raw.map((m: Member) => ({ ...m, packages: m.packages ?? [] }));
  } catch { return []; }
}

export function saveMembers(members: Member[]) {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  pushToCloud("members", members);
}

export function getCosts(): MonthlyCosts[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(COSTS_KEY) || "[]"); } catch { return []; }
}

export function saveCosts(costs: MonthlyCosts[]) {
  localStorage.setItem(COSTS_KEY, JSON.stringify(costs));
  pushToCloud("costs", costs);
}

export function getPrefill(): CalcPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFILL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setPrefill(data: CalcPrefill) {
  localStorage.setItem(PREFILL_KEY, JSON.stringify(data));
}

export function clearPrefill() {
  localStorage.removeItem(PREFILL_KEY);
}

export function getSchedules(): ScheduleEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || "[]"); } catch { return []; }
}

export function saveSchedules(entries: ScheduleEntry[]) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(entries));
  pushToCloud("schedules", entries);
}

export function getTrainers(): Trainer[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TRAINERS_KEY) || "[]"); } catch { return []; }
}

export function saveTrainers(trainers: Trainer[]) {
  localStorage.setItem(TRAINERS_KEY, JSON.stringify(trainers));
  pushToCloud("trainers", trainers);
}

// ── 유틸 ───────────────────────────────────────────────────────────────────
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function emptyCosts(month: string): MonthlyCosts {
  return {
    month, rent: 0, trainerSalary: 0, freelanceSalary: 0,
    utilities: 0, communication: 0, depreciation: 0, otherFixed: 0,
    supplies: 0, marketing: 0, otherVariable: 0, isVat: false,
  };
}

export function formatManwon(n: number): string | null {
  if (!n) return null;
  const eok  = Math.floor(n / 100000000);
  const man  = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  let result = "";
  if (eok)  result += eok + "억 ";
  if (man)  result += man + "만";
  if (!eok && !man && rest) result += rest;
  return result.trim() ? result.trim() + "원" : null;
}
