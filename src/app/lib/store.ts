import { pushToCloud } from "./sync";

export type SalaryType = "base+rate" | "rate" | "base+fixed";

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

// ── 결제 수단 ──────────────────────────────────────────────────────────────
export type PaymentMethod = "카드" | "현금" | "지역화폐" | "";

// 결제 수단별 수수료율 (%) — 카드는 연매출 구간별 상이, 기본값 0.4%(영세가맹점)
export const PAYMENT_FEE_RATES: Record<string, number> = {
  "카드":    0.4,  // 기본값: 영세가맹점(연매출 3억 이하) 신용카드 수수료
  "현금":    0,
  "지역화폐": 0,
};

// 카드 수수료 연매출 구간별 공식 요율 (2026년 상반기 여신금융협회 기준)
export const CARD_FEE_TIERS: { label: string; rate: number }[] = [
  { label: "영세 (3억↓) 0.4%",   rate: 0.4  },
  { label: "중소1 (5억↓) 1.0%",  rate: 1.0  },
  { label: "중소2 (10억↓) 1.15%", rate: 1.15 },
  { label: "중소3 (30억↓) 1.45%", rate: 1.45 },
  { label: "일반 (30억↑) 직접입력", rate: 0 },
];

export function calcPaymentFee(amount: number, method: PaymentMethod, cardRate?: number): number {
  if (!method) return 0;
  const rate = method === "카드"
    ? (cardRate ?? PAYMENT_FEE_RATES["카드"])
    : (PAYMENT_FEE_RATES[method] ?? 0);
  return Math.round(amount * rate / 100);
}

// ── PT 패키지 ──────────────────────────────────────────────────────────────
export interface SessionPackage {
  id: string;
  name: string;              // 수업명 (예: "홍성은 수업")
  trainerName: string;       // 담당 트레이너
  trainerType: "정규직" | "프리랜서" | "";
  totalSessions: number;     // 결제 회차
  conductedSessions: number; // 진행 회차
  paymentAmount: number;     // 결제 금액 (원래 결제액)
  paymentMethod: PaymentMethod; // 결제 수단
  paymentFee: number;        // 수수료 금액
  netAmount: number;         // 실수령액 (paymentAmount - paymentFee)
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
  managementFee: number; // 관리비
  trainerSalary: number;
  freelanceSalary: number;
  utilities: number;
  communication: number;
  depreciation: number;
  otherFixed: number;
  supplies: number;
  marketing: number;
  paymentFee: number;    // 결제 수수료 (카드 등)
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
  salaryType: SalaryType;
  baseSalary: number;   // 기본급/기본지원금
  commRate: number;     // 매출 배분율 0~100
  sessionFee: number;   // 고정 수업료 (회당)
}

export interface TrainerSettlement {
  id: string;
  month: string;           // YYYY-MM
  trainerId: string;
  trainerName: string;
  empType: "정규직" | "프리랜서" | "";
  salaryType: SalaryType;
  baseSalary: number;
  commRate: number;
  sessionFee: number;
  completedSessions: number;
  ptRevenue: number;
  incentive: number;
  grossSalary: number;
  netSalary: number;
  withholdingTax: number;
  insuranceCost: number;
  companyCost: number;
  settled: boolean;
  settledAt: string;
  memo: string;
}

// ── 스토리지 키 ────────────────────────────────────────────────────────────
const SCHEDULE_KEY    = "gym_schedule";
const MEMBERS_KEY     = "gym_members";
const COSTS_KEY       = "gym_costs";
const PREFILL_KEY     = "calc_prefill";
const TRAINERS_KEY    = "gym_trainers";
const SETTLEMENT_KEY  = "gym_settlements";
const BRANCHES_KEY    = "gym_branches";

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
  try {
    const raw = JSON.parse(localStorage.getItem(TRAINERS_KEY) || "[]");
    return raw.map((t: Trainer) => ({
      ...t,
      salaryType: t.salaryType ?? "base+rate",
      baseSalary: t.baseSalary ?? 0,
      commRate: t.commRate ?? 50,
      sessionFee: t.sessionFee ?? 0,
    }));
  } catch { return []; }
}

export function saveTrainers(trainers: Trainer[]) {
  localStorage.setItem(TRAINERS_KEY, JSON.stringify(trainers));
  pushToCloud("trainers", trainers);
}

export function getBranches(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(BRANCHES_KEY) || "[]"); } catch { return []; }
}

export function saveBranches(branches: string[]) {
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
}

export function getSettlements(): TrainerSettlement[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SETTLEMENT_KEY) || "[]"); } catch { return []; }
}

export function saveSettlements(settlements: TrainerSettlement[]) {
  localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(settlements));
  pushToCloud("settlements", settlements);
}

// ── 유틸 ───────────────────────────────────────────────────────────────────
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function emptyCosts(month: string): MonthlyCosts {
  return {
    month, rent: 0, managementFee: 0, trainerSalary: 0, freelanceSalary: 0,
    utilities: 0, communication: 0, depreciation: 0, otherFixed: 0,
    supplies: 0, marketing: 0, paymentFee: 0, otherVariable: 0, isVat: false,
  };
}

/** 전체 회원 패키지에서 결제 수수료 합산 → 해당 월 비용에 반영 */
export function syncPaymentFeeToCosts(members: Member[], month: string) {
  const totalFee = members.flatMap((m) => m.packages ?? [])
    .filter((p) => p.registeredAt?.slice(0, 7) === month)
    .reduce((s, p) => s + (p.paymentFee ?? 0), 0);

  const allCosts = getCosts();
  const existing = allCosts.find((c) => c.month === month) ?? emptyCosts(month);
  const updated  = { ...existing, paymentFee: totalFee };
  saveCosts([...allCosts.filter((c) => c.month !== month), updated]);
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
