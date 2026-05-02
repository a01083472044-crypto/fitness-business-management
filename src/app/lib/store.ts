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
  classType?: "1:1" | "그룹"; // 수업 유형 (없으면 1:1로 간주)
  groupSize?: number;          // 그룹 수업 최대 인원
}

// ── 결제 수단 ──────────────────────────────────────────────────────────────
export type PaymentMethod = "카드" | "현금" | "계좌이체" | "간편결제" | "지역화폐" | "";

// 결제 수단별 수수료율 (%) — 카드는 연매출 구간별 상이, 기본값 0.4%(영세가맹점)
export const PAYMENT_FEE_RATES: Record<string, number> = {
  "카드":    0.4,   // 기본값: 영세가맹점(연매출 3억 이하) 신용카드 수수료
  "현금":    0,
  "계좌이체": 0,
  "간편결제": 1.5,  // 카카오페이·네이버페이 등 소상공인 기준 약 1.5%
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

// ── 사업자 유형 ────────────────────────────────────────────────────────────
export type BusinessType =
  | "헬스장" | "PT샵" | "필라테스" | "골프장" | "요가" | "크로스핏" | "기타";

export interface BusinessConfig {
  label: string;
  icon: string;
  color: string;          // tailwind bg color class (button bg)
  programs: ProgramType[];        // 사용 가능한 횟수제 프로그램
  memberships: MembershipCategory[]; // 사용 가능한 기간제 회원권 (아래 선언 후 참조)
  hasLocker: boolean;
  hasCheckin: boolean;
  hasGroupSchedule: boolean;
  hasIndividualSchedule: boolean;
}

// 사업자 유형별 기능 설정 (MembershipCategory는 아래에 정의되지만 여기서 string literal로 사용)
export const BUSINESS_CONFIGS: Record<BusinessType, Omit<BusinessConfig, "memberships"> & { memberships: string[] }> = {
  "헬스장":  {
    label: "헬스장",  icon: "🏋️", color: "bg-blue-500",
    programs: ["PT", "GX", "기타"],
    memberships: ["헬스"],
    hasLocker: true, hasCheckin: true, hasGroupSchedule: true, hasIndividualSchedule: true,
  },
  "PT샵":    {
    label: "PT샵",    icon: "💪", color: "bg-orange-500",
    programs: ["PT", "기타"],
    memberships: [],
    hasLocker: false, hasCheckin: false, hasGroupSchedule: false, hasIndividualSchedule: true,
  },
  "필라테스": {
    label: "필라테스", icon: "🧘", color: "bg-pink-500",
    programs: ["필라테스", "기타"],
    memberships: ["기타기간제"],
    hasLocker: false, hasCheckin: true, hasGroupSchedule: true, hasIndividualSchedule: true,
  },
  "골프장":  {
    label: "골프장",  icon: "⛳", color: "bg-green-600",
    programs: ["골프레슨", "기타"],
    memberships: ["골프", "기타기간제"],
    hasLocker: true, hasCheckin: false, hasGroupSchedule: false, hasIndividualSchedule: true,
  },
  "요가":    {
    label: "요가",    icon: "🙏", color: "bg-purple-500",
    programs: ["요가", "기타"],
    memberships: ["기타기간제"],
    hasLocker: false, hasCheckin: true, hasGroupSchedule: true, hasIndividualSchedule: true,
  },
  "크로스핏": {
    label: "크로스핏", icon: "🔥", color: "bg-red-500",
    programs: ["크로스핏", "GX", "기타"],
    memberships: ["기타기간제"],
    hasLocker: false, hasCheckin: true, hasGroupSchedule: true, hasIndividualSchedule: true,
  },
  "기타":    {
    label: "기타 업종", icon: "✏️", color: "bg-zinc-500",
    programs: ["PT", "필라테스", "GX", "골프레슨", "요가", "크로스핏", "기타"],
    memberships: ["헬스", "골프", "기타기간제"],
    hasLocker: true, hasCheckin: true, hasGroupSchedule: true, hasIndividualSchedule: true,
  },
};

export const BUSINESS_TYPE_LIST: BusinessType[] = ["헬스장", "PT샵", "필라테스", "골프장", "요가", "크로스핏", "기타"];

// ── 횟수제 프로그램 종류 ───────────────────────────────────────────────────
export type ProgramType = "PT" | "필라테스" | "GX" | "골프레슨" | "요가" | "크로스핏" | "기타";

export const PROGRAM_LIST: { type: ProgramType; icon: string; label: string }[] = [
  { type: "PT",      icon: "💪", label: "PT" },
  { type: "필라테스", icon: "🧘", label: "필라테스" },
  { type: "GX",      icon: "💃", label: "GX" },
  { type: "골프레슨", icon: "🏌️", label: "골프레슨" },
  { type: "요가",    icon: "🙏", label: "요가" },
  { type: "크로스핏", icon: "🔥", label: "크로스핏" },
  { type: "기타",    icon: "✏️", label: "기타" },
];

// ── PT 패키지 ──────────────────────────────────────────────────────────────
export type ClassType = "1:1" | "그룹";

export interface SessionPackage {
  id: string;
  name: string;              // 수업명
  programType: ProgramType;  // 프로그램 종류: PT / 필라테스 / GX / 기타
  trainerName: string;       // 담당 트레이너
  trainerType: "정규직" | "프리랜서" | "";
  classType: ClassType;      // 수업 유형: 1:1 또는 그룹
  groupSize: number;         // 인원 수 (1:1이면 1, 2:1이면 2 등)
  totalSessions: number;     // 결제 회차
  conductedSessions: number; // 진행 회차
  paymentAmount: number;     // 결제 금액
  paymentMethod: PaymentMethod;
  paymentFee: number;        // 수수료 금액
  netAmount: number;         // 실수령액
  registeredAt: string;      // YYYY-MM-DD
}

// ── 일반 회원권 ─────────────────────────────────────────────────────────────
export type MembershipDuration = "1개월" | "3개월" | "6개월" | "12개월" | "월구독제";

export const MEMBERSHIP_MONTHS: Record<MembershipDuration, number> = {
  "1개월":   1,
  "3개월":   3,
  "6개월":   6,
  "12개월": 12,
  "월구독제": 1,
};

export type MembershipCategory = "헬스" | "골프" | "기타기간제";

export interface GymMembership {
  id: string;
  category: MembershipCategory;  // 회원권 종류 (헬스 / 골프 / 기타기간제)
  membershipType: MembershipDuration;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD (자동 계산)
  paymentAmount: number;  // 결제 금액
  paymentMethod: PaymentMethod;
  paymentFee: number;     // 수수료
  netAmount: number;      // 실수령액
  registeredAt: string;   // YYYY-MM-DD
  autoRenew: boolean;     // 월구독제 자동 갱신 여부
}

/** 회원권 종료일 자동 계산 (시작일 + 기간 - 1일) */
export function calcMembershipEndDate(startDate: string, type: MembershipDuration): string {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + MEMBERSHIP_MONTHS[type]);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** 특정 월의 일반 회원권 소진매출(consumed) + 미소진부채(deferred) 계산 */
export function calcGymMembershipRevenue(
  allMembers: Member[],
  month: string
): { consumed: number; deferred: number } {
  const [yr, mo] = month.split("-").map(Number);
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd   = new Date(yr, mo, 0); // 이달 말일 (23:59:59)

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let consumed = 0;
  let deferred = 0;

  for (const member of allMembers) {
    for (const m of (member.gymMemberships ?? [])) {
      const start     = new Date(m.startDate + "T00:00:00");
      const end       = new Date(m.endDate   + "T00:00:00");
      const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      if (totalDays <= 0 || m.paymentAmount <= 0) continue;

      const dailyRate = m.paymentAmount / totalDays;

      // ── 이달 소진분: [start, end] ∩ [monthStart, monthEnd] ──────────────
      const ovStart = start > monthStart ? start : monthStart;
      const ovEnd   = end   < monthEnd   ? end   : monthEnd;
      if (ovEnd >= ovStart) {
        const days = Math.round((ovEnd.getTime() - ovStart.getTime()) / 86400000) + 1;
        consumed += dailyRate * Math.max(0, days);
      }

      // ── 미소진부채: 오늘까지 소진된 날 제외한 잔여 일수 ──────────────────
      const consumedDays = Math.min(
        Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000) + 1),
        totalDays
      );
      const remainingDays = Math.max(0, totalDays - consumedDays);
      deferred += dailyRate * remainingDays;
    }
  }

  return { consumed, deferred };
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
  packages: SessionPackage[];      // PT 패키지 목록
  gymMemberships: GymMembership[]; // 일반 회원권 목록
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
  branch: string;   // "" = 전체(공통), 지점명 = 지점별
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
  parkingFee: number;    // 주차비
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
  managementFee: number;
  trainerSalary: number;
  freelanceSalary: number;
  utilities: number;
  communication: number;
  depreciation: number;
  otherFixed: number;
  supplies: number;
  marketing: number;
  parkingFee: number;
  paymentFee: number;
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

// ── 상담 관리 ──────────────────────────────────────────────────────────────
export type ConsultationStatus = "예약" | "완료-등록" | "완료-미등록" | "재상담" | "취소";
export type ConsultationSource = "인스타그램" | "네이버" | "지인소개" | "현장방문" | "카카오" | "기타";
export type ConsultationInterest = "PT" | "헬스(일반)" | "그룹수업" | "체형교정" | "다이어트" | "기타";

export interface Consultation {
  id: string;
  name: string;                    // 상담자 이름
  phone: string;                   // 연락처
  date: string;                    // 상담 날짜 YYYY-MM-DD
  time: string;                    // 상담 시간 HH:MM
  counselor: string;               // 담당 트레이너/직원
  branch: string;                  // 지점
  source: ConsultationSource | ""; // 유입 경로
  interest: ConsultationInterest | ""; // 관심 서비스
  status: ConsultationStatus;      // 상담 결과
  followUpDate: string;            // 재상담 예정일 YYYY-MM-DD
  note: string;                    // 메모
  createdAt: string;               // 생성일시
}

// ── 락커 ───────────────────────────────────────────────────────────────────
export interface Locker {
  id: string;
  number: number;      // 락커 번호
  memberId: string;    // "" = 빈 락커
  memberName: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD 만료일
  note: string;
}

// ── 체크인 ─────────────────────────────────────────────────────────────────
export interface CheckIn {
  id: string;
  memberId: string;
  memberName: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  method: "QR" | "수동";
  branch: string;
}

// ── 스토리지 키 ────────────────────────────────────────────────────────────
const LOCKERS_KEY        = "gym_lockers";
const CHECKINS_KEY       = "gym_checkins";
const SCHEDULE_KEY       = "gym_schedule";
const MEMBERS_KEY        = "gym_members";
const COSTS_KEY          = "gym_costs";
const PREFILL_KEY        = "calc_prefill";
const TRAINERS_KEY       = "gym_trainers";
const CONSULTATIONS_KEY  = "gym_consultations";
const SETTLEMENT_KEY  = "gym_settlements";
const BRANCHES_KEY    = "gym_branches";

// ── CRUD 함수 ──────────────────────────────────────────────────────────────
export function getMembers(): Member[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
    // 기존 데이터 호환: packages 필드 없으면 빈 배열 주입
    return raw.map((m: Member) => ({
      ...m,
      packages: (m.packages ?? []).map((p: SessionPackage) => ({
        ...p,
        programType: p.programType ?? "PT",
        classType:   p.classType   ?? "1:1",
        groupSize:   p.groupSize   ?? 1,
      })),
      gymMemberships: (m.gymMemberships ?? []).map((g: GymMembership) => ({
        ...g,
        category: g.category ?? "헬스",
      })),
    }));
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
      branch:     t.branch     ?? "",
      salaryType: t.salaryType ?? "base+rate",
      baseSalary: t.baseSalary ?? 0,
      commRate:   t.commRate   ?? 50,
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
  pushToCloud("branches", branches);
}

export function getSettlements(): TrainerSettlement[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SETTLEMENT_KEY) || "[]"); } catch { return []; }
}

export function saveSettlements(settlements: TrainerSettlement[]) {
  localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(settlements));
  pushToCloud("settlements", settlements);
}

export function getConsultations(): Consultation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CONSULTATIONS_KEY) || "[]"); } catch { return []; }
}

export function saveConsultations(list: Consultation[]) {
  localStorage.setItem(CONSULTATIONS_KEY, JSON.stringify(list));
  pushToCloud("consultations", list);
}

// ── 유틸 ───────────────────────────────────────────────────────────────────
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function emptyCosts(month: string, branch = ""): MonthlyCosts {
  return {
    month, branch, rent: 0, managementFee: 0, trainerSalary: 0, freelanceSalary: 0,
    utilities: 0, communication: 0, depreciation: 0, otherFixed: 0,
    supplies: 0, marketing: 0, parkingFee: 0, paymentFee: 0, otherVariable: 0, isVat: false,
  };
}

// ── 미수금 ─────────────────────────────────────────────────────────────────
export interface Receivable {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  dueDate: string;    // YYYY-MM-DD
  note: string;
  paid: boolean;
  paidAt: string;     // YYYY-MM-DD
  createdAt: string;  // YYYY-MM-DD
}

// ── 세금계산서 ─────────────────────────────────────────────────────────────
export interface TaxInvoice {
  id: string;
  issueDate: string;    // YYYY-MM-DD
  buyerName: string;
  buyerBizNo: string;   // 사업자등록번호
  supplyAmount: number;
  vatAmount: number;
  total: number;
  invoiceType: "세금계산서" | "계산서" | "현금영수증";
  note: string;
}

const RECEIVABLES_KEY  = "gym_receivables";
const TAX_INVOICES_KEY = "gym_tax_invoices";

export function getReceivables(): Receivable[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECEIVABLES_KEY) || "[]"); } catch { return []; }
}
export function saveReceivables(list: Receivable[]) {
  localStorage.setItem(RECEIVABLES_KEY, JSON.stringify(list));
  pushToCloud("receivables", list);
}
export function getTaxInvoices(): TaxInvoice[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TAX_INVOICES_KEY) || "[]"); } catch { return []; }
}
export function saveTaxInvoices(list: TaxInvoice[]) {
  localStorage.setItem(TAX_INVOICES_KEY, JSON.stringify(list));
  pushToCloud("taxInvoices", list);
}

export function getLockers(): Locker[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LOCKERS_KEY) || "[]"); } catch { return []; }
}
export function saveLockers(list: Locker[]) {
  localStorage.setItem(LOCKERS_KEY, JSON.stringify(list));
  pushToCloud("lockers", list);
}

export function getCheckIns(): CheckIn[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHECKINS_KEY) || "[]"); } catch { return []; }
}
export function saveCheckIns(list: CheckIn[]) {
  localStorage.setItem(CHECKINS_KEY, JSON.stringify(list));
  pushToCloud("checkIns", list);
}

/** 전체 회원 패키지 + 일반 회원권에서 결제 수수료 합산 → 해당 월 비용에 반영 */
export function syncPaymentFeeToCosts(members: Member[], month: string) {
  const ptFee = members.flatMap((m) => m.packages ?? [])
    .filter((p) => p.registeredAt?.slice(0, 7) === month)
    .reduce((s, p) => s + (p.paymentFee ?? 0), 0);
  const gymFee = members.flatMap((m) => m.gymMemberships ?? [])
    .filter((g) => g.registeredAt?.slice(0, 7) === month)
    .reduce((s, g) => s + (g.paymentFee ?? 0), 0);
  const totalFee = ptFee + gymFee;

  const allCosts = getCosts();
  const existing = allCosts.find((c) => c.month === month && (c.branch ?? "") === "") ?? emptyCosts(month, "");
  const updated  = { ...existing, paymentFee: totalFee };
  saveCosts([...allCosts.filter((c) => !(c.month === month && (c.branch ?? "") === "")), updated]);
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
