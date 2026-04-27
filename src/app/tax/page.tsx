"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMembers, getSettlements, getTrainers, getCosts, getSchedules,
  getTaxInvoices, saveTaxInvoices,
  currentMonth, TaxInvoice,
} from "../lib/store";
import { shareKakao } from "../lib/share";
import { KakaoStore, initKakao, sendKakaoMemo } from "../lib/kakao";

// ── 상수 ───────────────────────────────────────────────────────────────────
const INS_RATE_EMPLOYER = 0.1065; // 사업주 4대보험+산재
const INS_RATE_EMPLOYEE = 0.0908; // 근로자 부담 (국민연금4.5%+건강3.545%+고용0.9%)

// 간이과세 업종 부가가치율 (피트니스/서비스업 = 40%)
const SIMPLIFIED_VALUE_RATE = 0.40;

type BizType = "법인" | "개인일반" | "간이";

const BIZ_CONFIG: Record<BizType, {
  label: string;
  vatLabel: string;
  vatRate: number | null;  // null = 간이과세 별도 계산
  vatFreq: string;
  vatDeadline: string;
  incomeTaxName: string;
  incomeTaxDeadline: string;
  bookkeepingNote: string;
  color: string;
  bg: string;
}> = {
  법인: {
    label: "법인사업자",
    vatLabel: "부가세 10%",
    vatRate: 0.10,
    vatFreq: "분기별 4회 (예정·확정 신고)",
    vatDeadline: "각 분기 말 다음달 25일",
    incomeTaxName: "법인세",
    incomeTaxDeadline: "사업연도 종료 후 3개월 이내 (3월 31일)",
    bookkeepingNote: "법인은 복식부기 의무 — 세무사 기장 필수",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  개인일반: {
    label: "개인사업자 (일반과세)",
    vatLabel: "부가세 10%",
    vatRate: 0.10,
    vatFreq: "반기별 2회 (6개월 1회, 연 2회 신고)",
    vatDeadline: "1기(1~6월) → 7월 25일 · 2기(7~12월) → 다음해 1월 25일",
    incomeTaxName: "종합소득세",
    incomeTaxDeadline: "다음해 5월 31일",
    bookkeepingNote: "연매출 3억↑ 복식부기 의무, 3억↓ 간편장부 가능",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  간이: {
    label: "개인사업자 (간이과세)",
    vatLabel: `부가세 ~${Math.round(SIMPLIFIED_VALUE_RATE * 10)}% (서비스업 부가가치율 ${SIMPLIFIED_VALUE_RATE * 100}%)`,
    vatRate: null,
    vatFreq: "연 1회 (1월 25일)",
    vatDeadline: "매년 1월 25일",
    incomeTaxName: "종합소득세",
    incomeTaxDeadline: "다음해 5월 31일",
    bookkeepingNote: "연매출 1억 400만원 미만 해당 · 세금계산서 발행 불가",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
};

const VAT_EXEMPT_THRESHOLD = 48_000_000; // 간이과세 납부 면제 기준 (연 4,800만원 미만)

const QUARTER_LABELS: Record<number, string> = { 1:"1분기(1~3월)", 2:"2분기(4~6월)", 3:"3분기(7~9월)", 4:"4분기(10~12월)" };
const VAT_DUE: Record<number, string> = { 1:"4월 25일", 2:"7월 25일", 3:"10월 25일", 4:"다음해 1월 25일" };

// 개인사업자 반기 (1기=1~6월, 2기=7~12월)
const HALF_LABELS: Record<number, string> = { 1:"1기 (1~6월)", 2:"2기 (7~12월)" };
const HALF_DUE:   Record<number, string> = { 1:"7월 25일", 2:"다음해 1월 25일" };

// ── 유틸 ───────────────────────────────────────────────────────────────────
function fmtW(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }
function getCurrentQ() { const n = new Date(); return Math.ceil((n.getMonth() + 1) / 3); }
function getCurrentHalf() { return new Date().getMonth() < 6 ? 1 : 2; }
function getQMonths(q: number, y: number) {
  const s = (q - 1) * 3 + 1;
  return [s, s + 1, s + 2].map((m) => `${y}-${String(m).padStart(2, "0")}`);
}
// 개인사업자 반기 (6개월)
function getHalfMonths(half: number, y: number) {
  const s = (half - 1) * 6 + 1;
  return Array.from({ length: 6 }, (_, i) => `${y}-${String(s + i).padStart(2, "0")}`);
}
function getYearMonths(y: number) {
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}
function monthLabel(m: string) { return `${Number(m.split("-")[1])}월`; }

// ── 컴포넌트 ───────────────────────────────────────────────────────────────
function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
      <p className={`font-bold text-zinc-900 ${accent ?? ""}`}>{title}</p>
      {children}
    </div>
  );
}
function Row2({ label, value, bold, red, green, sub }: { label: string; value: string; bold?: boolean; red?: boolean; green?: boolean; sub?: string }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? "font-bold border-t border-zinc-100 pt-2 mt-1" : ""}`}>
      <span className="text-zinc-500">{label}</span>
      <div className="text-right">
        <span className={red ? "text-red-600 font-semibold" : green ? "text-emerald-600 font-semibold" : "text-zinc-800 font-semibold"}>{value}</span>
        {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── 메인 ───────────────────────────────────────────────────────────────────
export default function TaxPage() {
  const now = new Date();
  const [mainTab,   setMainTab]   = useState<"세무계산" | "발행내역" | "세금 캘린더">("세무계산");
  const [calYear,   setCalYear]   = useState(now.getFullYear());
  const [calSending, setCalSending] = useState(false);
  const [bizType, setBizType] = useState<BizType>("개인일반");
  const [viewMonth, setViewMonth] = useState(currentMonth());
  const [selectedQ,    setSelectedQ]    = useState(getCurrentQ());      // 법인: 분기 1~4
  const [selectedHalf, setSelectedHalf] = useState(getCurrentHalf());   // 개인일반: 반기 1~2
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [annualRevInput, setAnnualRevInput] = useState(""); // 간이과세자 연매출 입력

  // ── 세금계산서 상태 ────────────────────────────────────────────────────────
  const [invoices,   setInvoices]   = useState<TaxInvoice[]>([]);
  const [showInvForm, setShowInvForm] = useState(false);
  const [invToast,   setInvToast]   = useState("");
  // 폼
  const [iDate,   setIDate]   = useState(currentMonth().slice(0, 7) + "-01");
  const [iBuyer,  setIBuyer]  = useState("");
  const [iBizNo,  setIBizNo]  = useState("");
  const [iSupply, setISupply] = useState("");
  const [iType,   setIType]   = useState<TaxInvoice["invoiceType"]>("세금계산서");
  const [iNote,   setINote]   = useState("");

  const [members,     setMembers]     = useState([] as ReturnType<typeof getMembers>);
  const [settlements, setSettlements] = useState([] as ReturnType<typeof getSettlements>);
  const [allCosts,    setAllCosts]    = useState([] as ReturnType<typeof getCosts>);
  const [schedules,   setSchedules]   = useState([] as ReturnType<typeof getSchedules>);

  useEffect(() => {
    setMembers(getMembers());
    setSettlements(getSettlements());
    setAllCosts(getCosts());
    setSchedules(getSchedules());
    setInvoices(getTaxInvoices());
    // localStorage에서 사업자 유형 복원
    const saved = localStorage.getItem("biz_type") as BizType | null;
    if (saved && ["법인", "개인일반", "간이"].includes(saved)) setBizType(saved);
    const savedRev = localStorage.getItem("annual_rev_input");
    if (savedRev) setAnnualRevInput(savedRev);
    // 발행 내역 탭 초기 날짜
    const td = new Date();
    setIDate(`${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,"0")}-${String(td.getDate()).padStart(2,"0")}`);
  }, []);

  const saveBizType = (t: BizType) => {
    setBizType(t);
    localStorage.setItem("biz_type", t);
  };

  const cfg = BIZ_CONFIG[bizType];
  // 법인=분기(3개월), 개인일반=반기(6개월), 간이=연간(12개월)
  const qMonths = useMemo(() => {
    if (bizType === "개인일반") return getHalfMonths(selectedHalf, selectedYear);
    if (bizType === "간이")     return getYearMonths(selectedYear);
    return getQMonths(selectedQ, selectedYear);
  }, [bizType, selectedQ, selectedHalf, selectedYear]);
  const yearMonths = useMemo(() => getYearMonths(selectedYear), [selectedYear]);

  // ── 월별 기장 데이터 자동 집계 ─────────────────────────────────────────
  const bookData = useMemo(() => {
    const m = viewMonth;

    // 매출: 이 달 등록된 패키지
    const pkgs = members.flatMap((mb) => mb.packages ?? [])
      .filter((p) => (p.registeredAt ?? "").startsWith(m));
    const revenue      = pkgs.reduce((s, p) => s + p.netAmount, 0);   // 실수령(수수료 제외)
    const revenueGross = pkgs.reduce((s, p) => s + p.paymentAmount, 0); // 총 결제
    const paymentFee   = pkgs.reduce((s, p) => s + (p.paymentFee ?? 0), 0); // 결제수수료
    const cardRev      = pkgs.filter(p => p.paymentMethod === "카드").reduce((s, p) => s + p.paymentAmount, 0);
    const cashRev      = pkgs.filter(p => p.paymentMethod === "현금").reduce((s, p) => s + p.paymentAmount, 0);
    const localRev     = pkgs.filter(p => p.paymentMethod === "지역화폐").reduce((s, p) => s + p.paymentAmount, 0);
    const otherRev     = revenueGross - cardRev - cashRev - localRev;

    // 완료 수업 수 (이 달)
    const doneCount = schedules.filter((s) => s.date.startsWith(m) && s.done).length;

    // 비용 (비용 관리에서)
    const costs = allCosts.find((c) => c.month === m && (c.branch ?? "") === "") ??
                  { rent:0, managementFee:0, trainerSalary:0, freelanceSalary:0, utilities:0,
                    communication:0, depreciation:0, otherFixed:0, supplies:0, marketing:0,
                    parkingFee:0, paymentFee:0, otherVariable:0, isVat:false };

    // 급여 (이 달 정산 완료)
    const monthSettled = settlements.filter((s) => s.month === m && s.settled);
    const regularSalary   = monthSettled.filter(s => s.empType === "정규직").reduce((sum, s) => sum + s.grossSalary, 0);
    const freelanceSalary = monthSettled.filter(s => s.empType === "프리랜서").reduce((sum, s) => sum + s.grossSalary, 0);
    const withholding     = monthSettled.filter(s => s.empType === "프리랜서").reduce((sum, s) => sum + (s.withholdingTax ?? 0), 0);
    const insuranceEmp    = regularSalary * INS_RATE_EMPLOYER;
    const insuranceEmpee  = regularSalary * INS_RATE_EMPLOYEE;
    const netSalaryTotal  = monthSettled.reduce((sum, s) => sum + s.netSalary, 0);

    const totalExpense =
      (costs.rent ?? 0) + (costs.managementFee ?? 0) +
      regularSalary * (1 + INS_RATE_EMPLOYER) +
      freelanceSalary +
      (costs.utilities ?? 0) + (costs.communication ?? 0) +
      (costs.depreciation ?? 0) + (costs.otherFixed ?? 0) +
      (costs.supplies ?? 0) + (costs.marketing ?? 0) +
      (costs.parkingFee ?? 0) + paymentFee + (costs.otherVariable ?? 0);

    const operatingProfit = revenueGross - totalExpense;

    return {
      m, revenueGross, revenue, paymentFee, cardRev, cashRev, localRev, otherRev,
      doneCount, costs, regularSalary, freelanceSalary, withholding,
      insuranceEmp, insuranceEmpee, netSalaryTotal, totalExpense, operatingProfit,
    };
  }, [viewMonth, members, settlements, allCosts, schedules]);

  // ── 부가세 계산 ────────────────────────────────────────────────────────
  const quarterRevenue = useMemo(() => {
    return members.flatMap((m) => m.packages ?? [])
      .filter((p) => qMonths.includes((p.registeredAt ?? "").slice(0, 7)))
      .reduce((s, p) => s + p.paymentAmount, 0);
  }, [members, qMonths]);

  const annualRevEst = useMemo(() => {
    // 연간 매출 추정: 연간 등록 패키지 합산
    return members.flatMap((m) => m.packages ?? [])
      .filter((p) => (p.registeredAt ?? "").startsWith(String(selectedYear)))
      .reduce((s, p) => s + p.paymentAmount, 0);
  }, [members, selectedYear]);

  const annualRevManual = Number(annualRevInput.replace(/[^0-9]/g, "")) || 0;
  const annualRev = annualRevManual > 0 ? annualRevManual : annualRevEst;

  // 간이과세자 납부 면제 여부
  const simplifiedExempt = bizType === "간이" && annualRev < VAT_EXEMPT_THRESHOLD;

  // 부가세 금액 계산
  const vatAmount = useMemo(() => {
    if (bizType === "간이") {
      // 간이과세: 매출 × 부가가치율(40%) × 10%
      return Math.round(quarterRevenue * SIMPLIFIED_VALUE_RATE * 0.10);
    }
    return Math.round(quarterRevenue * (cfg.vatRate ?? 0));
  }, [bizType, quarterRevenue, cfg.vatRate]);

  // ── 원천징수 / 4대보험 ────────────────────────────────────────────────
  const withholdingByMonth = useMemo(() =>
    yearMonths.map((m) => ({
      month: m,
      amount: settlements
        .filter((s) => s.month === m && s.settled && s.empType === "프리랜서")
        .reduce((sum, s) => sum + (s.withholdingTax ?? 0), 0),
    }))
  , [settlements, yearMonths]);

  const insuranceByMonth = useMemo(() =>
    yearMonths.map((m) => {
      const gross = settlements
        .filter((s) => s.month === m && s.settled && s.empType === "정규직")
        .reduce((sum, s) => sum + s.grossSalary, 0);
      return { month: m, gross, employer: gross * INS_RATE_EMPLOYER, employee: gross * INS_RATE_EMPLOYEE };
    })
  , [settlements, yearMonths]);

  const quarterWithholding = withholdingByMonth.filter(w => qMonths.includes(w.month)).reduce((s, w) => s + w.amount, 0);
  const yearWithholding = withholdingByMonth.reduce((s, w) => s + w.amount, 0);
  const quarterInsurance = insuranceByMonth.filter(w => qMonths.includes(w.month)).reduce((s, w) => s + w.employer + w.employee, 0);

  const thisMonth = currentMonth();
  const thisMonthW   = withholdingByMonth.find(w => w.month === thisMonth);
  const thisMonthIns = insuranceByMonth.find(w => w.month === thisMonth);

  // ── 연간 소득세/법인세 추정 ────────────────────────────────────────────
  const yearTotalRevenue = useMemo(() =>
    members.flatMap(m => m.packages ?? [])
      .filter(p => (p.registeredAt ?? "").startsWith(String(selectedYear)))
      .reduce((s, p) => s + p.paymentAmount, 0)
  , [members, selectedYear]);

  const yearTotalCost = useMemo(() =>
    allCosts.filter(c => (c.month ?? "").startsWith(String(selectedYear)))
      .reduce((s, c) => s + c.rent + c.trainerSalary + c.freelanceSalary +
        c.utilities + c.depreciation + c.otherFixed + c.supplies + c.marketing + c.otherVariable, 0)
  , [allCosts, selectedYear]);

  const estimatedIncome = Math.max(yearTotalRevenue - yearTotalCost, 0);

  // 종합소득세 누진세율 (2024년 기준)
  function calcIncomeTax(income: number): number {
    const brackets = [
      { limit: 14_000_000,  rate: 0.06,  deduct: 0 },
      { limit: 50_000_000,  rate: 0.15,  deduct: 1_260_000 },
      { limit: 88_000_000,  rate: 0.24,  deduct: 5_760_000 },
      { limit: 150_000_000, rate: 0.35,  deduct: 15_440_000 },
      { limit: 300_000_000, rate: 0.38,  deduct: 19_940_000 },
      { limit: 500_000_000, rate: 0.40,  deduct: 25_940_000 },
      { limit: 1_000_000_000, rate: 0.42, deduct: 35_940_000 },
      { limit: Infinity,    rate: 0.45,  deduct: 65_940_000 },
    ];
    for (const b of brackets) {
      if (income <= b.limit) return Math.max(income * b.rate - b.deduct, 0);
    }
    return 0;
  }

  // 법인세 (2024년 기준)
  function calcCorpTax(income: number): number {
    if (income <= 200_000_000) return income * 0.09;
    if (income <= 20_000_000_000) return 18_000_000 + (income - 200_000_000) * 0.19;
    return income * 0.21;
  }

  const incomeTaxEst = bizType === "법인"
    ? calcCorpTax(estimatedIncome)
    : calcIncomeTax(estimatedIncome);

  // ── 신고 캘린더 (이달 기준 다가오는 항목) ─────────────────────────────
  const upcomingDeadlines = useMemo(() => {
    const list: { date: string; label: string; amount?: number; color: string }[] = [];
    const y = now.getFullYear(), mo = now.getMonth() + 1;
    const nextMo = mo === 12 ? 1 : mo + 1;
    const nextY  = mo === 12 ? y + 1 : y;

    // 다음달 10일 — 원천징수 납부
    if ((thisMonthW?.amount ?? 0) > 0) {
      list.push({ date: `${nextY}-${String(nextMo).padStart(2,"0")}-10`, label: "원천징수세 납부 (프리랜서)", amount: thisMonthW?.amount, color: "text-orange-600" });
    }
    // 다음달 10일 — 4대보험
    if ((thisMonthIns?.employer ?? 0) > 0) {
      list.push({ date: `${nextY}-${String(nextMo).padStart(2,"0")}-10`, label: "4대보험 납부", amount: (thisMonthIns?.employer ?? 0) + (thisMonthIns?.employee ?? 0), color: "text-blue-600" });
    }
    // 다음 부가세 신고일
    if (bizType !== "간이") {
      const q = getCurrentQ();
      const qDue = [`${y}-04-25`, `${y}-07-25`, `${y}-10-25`, `${y+1}-01-25`];
      list.push({ date: qDue[q - 1], label: `부가세 ${q}분기 신고·납부`, amount: vatAmount, color: "text-red-600" });
    } else {
      list.push({ date: `${y+1}-01-25`, label: "간이과세자 부가세 연 1회 신고", color: "text-purple-600" });
    }
    // 종합소득세/법인세
    if (bizType === "법인") {
      list.push({ date: `${y+1}-03-31`, label: "법인세 신고 납부", color: "text-blue-800" });
    } else {
      list.push({ date: `${y+1}-05-31`, label: "종합소득세 신고 납부", amount: incomeTaxEst, color: "text-indigo-600" });
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [bizType, thisMonthW, thisMonthIns, vatAmount, incomeTaxEst]);

  // ── 세금계산서 CRUD ───────────────────────────────────────────────────────
  function saveInv(list: TaxInvoice[]) { setInvoices(list); saveTaxInvoices(list); }
  function showInvToast(msg: string) { setInvToast(msg); setTimeout(() => setInvToast(""), 3000); }

  function addInvoice() {
    const supply = Number(iSupply.replace(/[^0-9]/g, ""));
    if (!iBuyer || supply <= 0) return;
    const vat   = iType === "세금계산서" ? Math.round(supply * 0.1) : 0;
    const total = supply + vat;
    const newInv: TaxInvoice = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      issueDate: iDate, buyerName: iBuyer, buyerBizNo: iBizNo,
      supplyAmount: supply, vatAmount: vat, total,
      invoiceType: iType, note: iNote,
    };
    saveInv([...invoices, newInv]);
    setShowInvForm(false);
    setIBuyer(""); setIBizNo(""); setISupply(""); setINote("");
    showInvToast("✅ 발행 내역이 등록됐습니다.");
  }
  function delInvoice(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    saveInv(invoices.filter((inv) => inv.id !== id));
  }

  // 세금계산서 발행 내역 카카오 공유
  async function handleInvShare() {
    const thisM = invoices.filter((inv) => inv.issueDate.startsWith(viewMonth));
    const total = thisM.reduce((s, inv) => s + inv.total, 0);
    const lines = [
      `🧾 ${viewMonth} 세금계산서 발행 현황`,
      "━━━━━━━━━━━━━━━━━━━",
      `총 ${thisM.length}건 / ${fmtW(total)}`,
      "━━━━━━━━━━━━━━━━━━━",
      ...thisM.map((inv) => `· ${inv.issueDate} | ${inv.buyerName} | ${inv.invoiceType} | ${fmtW(inv.total)}`),
      "━━━━━━━━━━━━━━━━━━━",
      "📱 피트니스 경영 관리 시스템",
    ];
    const result = await shareKakao(lines.join("\n"), "세금계산서 발행 현황");
    if (result === "copied") showInvToast("📋 복사됐습니다. 카카오톡에 붙여넣기 하세요.");
    else if (result === "shared") showInvToast("✅ 공유 완료!");
  }

  // ── 렌더링 ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">🧾 세무 자동화 도우미</h1>
          <p className="text-sm text-zinc-500 mt-0.5">사업자 유형별 세금 자동 계산 · 세무사 기장 자료 자동화</p>
        </div>

        {/* ── 메인 탭: 세무계산 / 발행 내역 / 세금 캘린더 ─────────────────── */}
        <div className="flex gap-2">
          {(["세무계산", "발행내역", "세금 캘린더"] as const).map((t) => (
            <button key={t} onClick={() => setMainTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                mainTab === t ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-500"
              }`}>
              {t === "세무계산" ? "📊 세무 계산"
               : t === "발행내역" ? `🧾 발행 내역`
               : "📅 세금 캘린더"}
            </button>
          ))}
        </div>

        {/* ══════════════════ 발행 내역 탭 ══════════════════ */}
        {mainTab === "발행내역" && (
          <>
            {/* 발행 내역 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="month" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleInvShare}
                  className="flex items-center gap-1 bg-yellow-400 text-zinc-900 text-xs font-black px-3 py-2 rounded-xl hover:bg-yellow-300 transition">
                  💬 카카오
                </button>
                <button onClick={() => setShowInvForm(true)}
                  className="bg-zinc-900 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-zinc-700 transition">
                  + 발행 등록
                </button>
              </div>
            </div>

            {/* 이번달 요약 */}
            {(() => {
              const thisM = invoices.filter((inv) => inv.issueDate.startsWith(viewMonth));
              const totalSupply = thisM.reduce((s, inv) => s + inv.supplyAmount, 0);
              const totalVat    = thisM.reduce((s, inv) => s + inv.vatAmount, 0);
              const totalAmt    = thisM.reduce((s, inv) => s + inv.total, 0);
              return thisM.length > 0 ? (
                <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
                  <p className="text-xs text-zinc-400">{viewMonth} 발행 현황</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xl font-black text-blue-300">{thisM.length}건</p>
                      <p className="text-xs text-zinc-400 mt-0.5">발행 건수</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-emerald-300">{fmtW(totalSupply)}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">공급가액</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-white">{fmtW(totalAmt)}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">합계 (VAT {fmtW(totalVat)})</p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* 발행 내역 목록 */}
            <div className="space-y-3">
              {invoices.filter((inv) => inv.issueDate.startsWith(viewMonth)).length === 0 ? (
                <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
                  <p className="text-4xl mb-3">🧾</p>
                  <p className="text-zinc-500 text-sm font-medium">이번달 발행 내역 없음</p>
                  <p className="text-zinc-400 text-xs mt-1">+ 발행 등록 버튼으로 추가하세요</p>
                </div>
              ) : (
                invoices
                  .filter((inv) => inv.issueDate.startsWith(viewMonth))
                  .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
                  .map((inv) => (
                    <div key={inv.id} className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-zinc-900">{inv.buyerName}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              inv.invoiceType === "세금계산서" ? "bg-blue-100 text-blue-700"
                              : inv.invoiceType === "현금영수증" ? "bg-emerald-100 text-emerald-700"
                              : "bg-zinc-100 text-zinc-600"
                            }`}>{inv.invoiceType}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{inv.issueDate}{inv.buyerBizNo && ` · ${inv.buyerBizNo}`}</p>
                          {inv.note && <p className="text-xs text-zinc-500 mt-0.5">{inv.note}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-zinc-900">{fmtW(inv.total)}</p>
                          <p className="text-xs text-zinc-400">공급: {fmtW(inv.supplyAmount)} + VAT: {fmtW(inv.vatAmount)}</p>
                        </div>
                      </div>
                      <button onClick={() => delInvoice(inv.id)}
                        className="w-full py-2 bg-zinc-50 text-zinc-400 text-xs font-semibold rounded-xl hover:bg-red-50 hover:text-red-500 transition">
                        삭제
                      </button>
                    </div>
                  ))
              )}

              {/* 전체 내역 (다른 월 포함) */}
              {invoices.filter((inv) => !inv.issueDate.startsWith(viewMonth)).length > 0 && (
                <div className="bg-zinc-50 rounded-xl p-3">
                  <p className="text-xs text-zinc-400 font-semibold mb-2">이전 발행 내역 ({invoices.filter(inv => !inv.issueDate.startsWith(viewMonth)).length}건)</p>
                  {invoices
                    .filter((inv) => !inv.issueDate.startsWith(viewMonth))
                    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
                    .slice(0, 5)
                    .map((inv) => (
                      <div key={inv.id} className="flex justify-between items-center text-sm py-1.5 border-b border-zinc-100 last:border-0">
                        <div>
                          <p className="text-zinc-600 font-semibold">{inv.buyerName}</p>
                          <p className="text-xs text-zinc-400">{inv.issueDate} · {inv.invoiceType}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-700">{fmtW(inv.total)}</p>
                          <button onClick={() => delInvoice(inv.id)} className="text-zinc-300 hover:text-red-400 text-xs transition">✕</button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* 발행 등록 모달 */}
            {showInvForm && (
              <div className="fixed inset-0 bg-black/50 flex items-end z-50"
                onClick={() => setShowInvForm(false)}>
                <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
                  onClick={(e) => e.stopPropagation()}>
                  <p className="font-black text-zinc-900 text-lg">세금계산서 발행 등록</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 font-semibold block mb-1">발행일 *</label>
                        <input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 font-semibold block mb-1">종류</label>
                        <select value={iType} onChange={(e) => setIType(e.target.value as TaxInvoice["invoiceType"])}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400 bg-white">
                          <option value="세금계산서">세금계산서</option>
                          <option value="계산서">계산서 (면세)</option>
                          <option value="현금영수증">현금영수증</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 font-semibold block mb-1">거래처 (공급받는자) *</label>
                      <input type="text" value={iBuyer} onChange={(e) => setIBuyer(e.target.value)}
                        placeholder="회사명 또는 개인명"
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 font-semibold block mb-1">사업자등록번호 (선택)</label>
                      <input type="text" value={iBizNo} onChange={(e) => setIBizNo(e.target.value)}
                        placeholder="000-00-00000"
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 font-semibold block mb-1">공급가액 *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                        <input type="number" value={iSupply} onChange={(e) => setISupply(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border border-zinc-200 pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                      </div>
                      {iType === "세금계산서" && Number(iSupply) > 0 && (
                        <p className="text-xs text-zinc-400 mt-1">
                          VAT: {fmtW(Math.round(Number(iSupply) * 0.1))} → 합계: {fmtW(Math.round(Number(iSupply) * 1.1))}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 font-semibold block mb-1">메모 (선택)</label>
                      <input type="text" value={iNote} onChange={(e) => setINote(e.target.value)}
                        placeholder="품목, 계약 내용 등"
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowInvForm(false)}
                      className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition">
                      취소
                    </button>
                    <button onClick={addInvoice} disabled={!iBuyer || !iSupply}
                      className="flex-1 py-3 bg-zinc-900 text-white font-bold rounded-xl disabled:opacity-40 hover:bg-zinc-700 transition">
                      등록
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ 세무계산 탭 (기존 내용) ══════════════════ */}
        {mainTab === "세무계산" && (<>

        {/* ── 1. 사업자 유형 선택 ─────────────────────────────────────────── */}
        <Section title="사업자 유형 선택">
          <div className="grid grid-cols-3 gap-2">
            {(["법인", "개인일반", "간이"] as BizType[]).map((t) => (
              <button key={t} onClick={() => saveBizType(t)}
                className={`py-3 rounded-xl border-2 text-sm font-bold transition flex flex-col items-center gap-1 ${
                  bizType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                }`}>
                <span>{t === "법인" ? "🏢" : t === "개인일반" ? "👤" : "🏪"}</span>
                <span className="text-xs leading-tight text-center">
                  {t === "법인" ? "법인\n사업자" : t === "개인일반" ? "개인\n(일반과세)" : "개인\n(간이과세)"}
                </span>
              </button>
            ))}
          </div>

          {/* 사업자 유형 설명 */}
          <div className={`rounded-xl border p-4 space-y-2 text-sm ${cfg.bg}`}>
            <p className={`font-bold ${cfg.color}`}>{cfg.label}</p>
            <div className="space-y-1 text-xs text-zinc-600">
              <p>· <strong>부가세:</strong> {cfg.vatLabel} · {cfg.vatFreq}</p>
              <p>· <strong>소득세:</strong> {cfg.incomeTaxName} ({cfg.incomeTaxDeadline})</p>
              <p>· <strong>기장 의무:</strong> {cfg.bookkeepingNote}</p>
            </div>
          </div>

          {/* 간이과세자: 연매출 입력 */}
          {bizType === "간이" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500">연 예상 매출액 입력 (납부면제 판정용)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                <input
                  type="text" inputMode="numeric"
                  placeholder="직접 입력 (미입력시 패키지 등록액 자동 집계)"
                  value={annualRevInput}
                  onChange={(e) => {
                    setAnnualRevInput(e.target.value);
                    localStorage.setItem("annual_rev_input", e.target.value);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className={`rounded-xl px-4 py-3 text-sm font-bold ${
                simplifiedExempt
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {simplifiedExempt
                  ? `✅ 납부 면제 대상 (연매출 ${fmtW(annualRev)} · 4,800만원 미만) — 신고는 해야 합니다`
                  : `💰 납부 대상 (연매출 ${fmtW(annualRev)} · 4,800만원 이상)`}
              </div>
            </div>
          )}
        </Section>

        {/* ── 2. 월별 기장 자료 자동화 (세무사 기장용) ───────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-900">📋 월별 기장 자료 자동화</p>
            <input type="month" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:border-blue-500" />
          </div>
          <p className="text-xs text-zinc-400 -mt-2">세무사 기장에 필요한 항목을 자동으로 집계합니다</p>

          {/* ■ 수입 */}
          <div className="rounded-xl bg-emerald-50 p-4 space-y-2">
            <p className="text-xs font-black text-emerald-700">■ 수입 (매출)</p>
            <Row2 label="총 결제 매출" value={fmtW(bookData.revenueGross)} />
            <Row2 label="└ 카드 수입" value={fmtW(bookData.cardRev)} />
            {bookData.cashRev > 0 && <Row2 label="└ 현금 수입" value={fmtW(bookData.cashRev)} />}
            {bookData.localRev > 0 && <Row2 label="└ 지역화폐 수입" value={fmtW(bookData.localRev)} />}
            {bookData.paymentFee > 0 && <Row2 label="결제 수수료 차감" value={`− ${fmtW(bookData.paymentFee)}`} red />}
            <Row2 label="실수령 매출 (수수료 차감 후)" value={fmtW(bookData.revenue)} green bold />
            {bookData.doneCount > 0 && (
              <p className="text-xs text-emerald-600 mt-1">· 이번달 완료 수업: {bookData.doneCount}회</p>
            )}
            {bookData.revenueGross === 0 && (
              <p className="text-xs text-zinc-400">이 달 등록된 패키지 매출이 없습니다</p>
            )}
          </div>

          {/* ■ 지출 */}
          <div className="rounded-xl bg-red-50 p-4 space-y-2">
            <p className="text-xs font-black text-red-700">■ 지출 (비용)</p>
            {(bookData.costs.rent ?? 0) > 0 && <Row2 label="임대료" value={fmtW(bookData.costs.rent)} />}
            {(bookData.costs.managementFee ?? 0) > 0 && <Row2 label="관리비" value={fmtW(bookData.costs.managementFee ?? 0)} />}
            {bookData.regularSalary > 0 && (
              <>
                <Row2 label="정규직 급여 (세전)" value={fmtW(bookData.regularSalary)} />
                <Row2 label="└ 4대보험 사업주분" value={fmtW(bookData.insuranceEmp)} />
              </>
            )}
            {bookData.freelanceSalary > 0 && <Row2 label="프리랜서 지급액 (세전)" value={fmtW(bookData.freelanceSalary)} />}
            {(bookData.costs.utilities + bookData.costs.communication) > 0 &&
              <Row2 label="공과금·통신비" value={fmtW(bookData.costs.utilities + bookData.costs.communication)} />}
            {(bookData.costs.depreciation ?? 0) > 0 && <Row2 label="감가상각비" value={fmtW(bookData.costs.depreciation)} />}
            {(bookData.costs.supplies ?? 0) > 0 && <Row2 label="소모품비" value={fmtW(bookData.costs.supplies)} />}
            {(bookData.costs.marketing ?? 0) > 0 && <Row2 label="마케팅·광고비" value={fmtW(bookData.costs.marketing)} />}
            {(bookData.costs.parkingFee ?? 0) > 0 && <Row2 label="주차비" value={fmtW(bookData.costs.parkingFee ?? 0)} />}
            {bookData.paymentFee > 0 && <Row2 label="결제 수수료" value={fmtW(bookData.paymentFee)} />}
            {(bookData.costs.otherFixed + bookData.costs.otherVariable) > 0 &&
              <Row2 label="기타 비용" value={fmtW(bookData.costs.otherFixed + bookData.costs.otherVariable)} />}
            <Row2 label="총 지출 합계" value={fmtW(bookData.totalExpense)} red bold />
          </div>

          {/* ■ 원천징수 납부 */}
          <div className="rounded-xl bg-orange-50 p-4 space-y-2">
            <p className="text-xs font-black text-orange-700">■ 원천징수 납부 (다음달 10일)</p>
            <Row2 label="프리랜서 원천징수 (3.3%)" value={fmtW(bookData.withholding)} />
            {bookData.withholding === 0 && (
              <p className="text-xs text-orange-400">정산 완료된 프리랜서가 없습니다</p>
            )}
            <p className="text-xs text-orange-600">· 납부처: 홈택스 원천세 신고</p>
          </div>

          {/* ■ 4대보험 */}
          {bookData.regularSalary > 0 && (
            <div className="rounded-xl bg-blue-50 p-4 space-y-2">
              <p className="text-xs font-black text-blue-700">■ 4대보험 납부 (다음달 10일)</p>
              <Row2 label="사업주 부담 (10.65%)" value={fmtW(bookData.insuranceEmp)} />
              <Row2 label="근로자 부담 (~9.08%)" value={fmtW(bookData.insuranceEmpee)} />
              <Row2 label="합계 납부액" value={fmtW(bookData.insuranceEmp + bookData.insuranceEmpee)} bold />
              <p className="text-xs text-blue-600">· 납부처: EDI / 4대보험 포털</p>
            </div>
          )}

          {/* ■ 월 손익 요약 */}
          <div className={`rounded-xl p-4 space-y-2 ${bookData.operatingProfit >= 0 ? "bg-zinc-900" : "bg-red-900"}`}>
            <p className="text-xs font-black text-zinc-300">■ 월 손익 요약</p>
            <div className="flex justify-between text-sm text-zinc-300">
              <span>총 매출</span><span>{fmtW(bookData.revenueGross)}</span>
            </div>
            <div className="flex justify-between text-sm text-zinc-400">
              <span>총 지출</span><span>− {fmtW(bookData.totalExpense)}</span>
            </div>
            <div className="flex justify-between font-black text-base border-t border-zinc-700 pt-2">
              <span className="text-white">영업이익</span>
              <span className={bookData.operatingProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmtW(bookData.operatingProfit)}
              </span>
            </div>
          </div>

          <div className="text-xs text-zinc-400 bg-zinc-50 rounded-xl p-3 space-y-0.5">
            <p className="font-semibold text-zinc-500">📌 세무사 기장 전달 체크리스트</p>
            <p>{bookData.revenueGross > 0 ? "✅" : "⬜"} 매출 전표 (카드 매출 내역, 현금영수증)</p>
            <p>{bookData.regularSalary > 0 ? "✅" : "⬜"} 급여 대장 (정규직)</p>
            <p>{bookData.freelanceSalary > 0 ? "✅" : "⬜"} 프리랜서 계약서 / 지급 명세</p>
            <p>{bookData.costs.rent > 0 ? "✅" : "⬜"} 임대료 계좌이체 내역</p>
            <p>⬜ 각종 영수증 (소모품, 마케팅, 공과금 등)</p>
            <p>⬜ 법인카드/사업용 계좌 거래내역</p>
          </div>
        </div>

        {/* ── 3. 부가세 ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-bold text-zinc-900">💰 부가세</p>
            <div className="flex gap-1">
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-700 focus:outline-none">
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              {/* 법인: 분기 4개 / 개인일반: 1기·2기 / 간이: 없음 */}
              {bizType === "법인" && (
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((q) => (
                    <button key={q} onClick={() => setSelectedQ(q)}
                      className={`w-12 py-1.5 rounded-xl text-xs font-bold border transition ${
                        selectedQ === q ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-500 border-zinc-200"
                      }`}>
                      {q}분기
                    </button>
                  ))}
                </div>
              )}
              {bizType === "개인일반" && (
                <div className="flex gap-1">
                  {[1, 2].map((h) => (
                    <button key={h} onClick={() => setSelectedHalf(h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        selectedHalf === h ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-zinc-500 border-zinc-200"
                      }`}>
                      {h}기
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {bizType === "간이" ? (
            /* 간이과세자 부가세 */
            <div className="space-y-3">
              <div className="rounded-xl bg-purple-50 p-4 space-y-2">
                <p className="text-xs font-bold text-purple-700">간이과세자 부가세 (연 1회 신고)</p>
                <Row2 label="연간 총 매출 (자동 집계)" value={fmtW(annualRev)} />
                <Row2 label={`업종 부가가치율 (서비스업 ${SIMPLIFIED_VALUE_RATE * 100}%)`} value={fmtW(annualRev * SIMPLIFIED_VALUE_RATE)} />
                <Row2 label="부가세율 10%" value="" />
                <Row2 label="산출 부가세" value={fmtW(annualRev * SIMPLIFIED_VALUE_RATE * 0.10)} bold />
                {simplifiedExempt
                  ? <div className="bg-emerald-100 rounded-lg p-2 text-xs text-emerald-700 font-bold">✅ 연매출 4,800만원 미만 → 납부 면제 (신고는 필수)</div>
                  : <div className="bg-red-100 rounded-lg p-2 text-xs text-red-700 font-bold">💰 납부 예정액: {fmtW(annualRev * SIMPLIFIED_VALUE_RATE * 0.10)}</div>
                }
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 space-y-1">
                <p className="font-semibold">간이과세자 주요 제한사항</p>
                <p>· 세금계산서 발행 불가 (영수증만 가능)</p>
                <p>· 연매출 1억 400만원 초과 시 일반과세자 전환</p>
                <p>· 신고 기한: 매년 1월 25일 (전년도 1~12월 합산)</p>
              </div>
            </div>
          ) : bizType === "개인일반" ? (
            /* 개인사업자 일반과세 — 반기 2회 */
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700">
                  {HALF_LABELS[selectedHalf]} · 신고기한: {selectedYear}년 {HALF_DUE[selectedHalf]}
                </p>
                <Row2 label="반기 총 매출 (등록 기준)" value={fmtW(quarterRevenue)} />
                <Row2 label="부가세율" value="10%" />
                <Row2 label="납부 예정액" value={fmtW(vatAmount)} red bold />
              </div>
              {vatAmount > 0 && (
                <div className="bg-emerald-700 rounded-xl p-3 text-white text-sm font-bold">
                  📅 {HALF_LABELS[selectedHalf]} 부가세 납부 예정: {fmtW(vatAmount)}
                  <p className="text-xs font-normal mt-0.5 text-emerald-200">신고 기한: {selectedYear}년 {HALF_DUE[selectedHalf]}</p>
                </div>
              )}
              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 space-y-1">
                <p className="font-semibold text-zinc-600">📌 개인사업자 부가세 신고 일정</p>
                <p>· <strong>1기 확정신고</strong> (1~6월 매출): 7월 25일</p>
                <p>· <strong>2기 확정신고</strong> (7~12월 매출): 다음해 1월 25일</p>
                <p className="text-zinc-400 mt-1">※ 예정고지: 4월·10월 25일 (전기 납부세액 50% 자동고지 — 별도 신고 불필요)</p>
                <p>· 매출세액 − 매입세액(세금계산서) = 납부세액</p>
                <p>· 신고처: 홈택스 부가가치세 신고</p>
              </div>
            </div>
          ) : (
            /* 법인사업자 — 분기 4회 */
            <div className="space-y-3">
              <div className="rounded-xl bg-red-50 p-4 space-y-2">
                <p className="text-xs font-bold text-red-700">{QUARTER_LABELS[selectedQ]} · 신고기한: {selectedYear}년 {VAT_DUE[selectedQ]}</p>
                <Row2 label="분기 총 매출 (등록 기준)" value={fmtW(quarterRevenue)} />
                <Row2 label="부가세율" value="10%" />
                <Row2 label="납부 예정액" value={fmtW(vatAmount)} red bold />
              </div>
              {vatAmount > 0 && (
                <div className="bg-red-600 rounded-xl p-3 text-white text-sm font-bold">
                  📅 {selectedQ}분기 부가세 납부 예정: {fmtW(vatAmount)}
                  <p className="text-xs font-normal mt-0.5 text-red-200">신고 기한: {selectedYear}년 {VAT_DUE[selectedQ]}</p>
                </div>
              )}
              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 space-y-1">
                <p className="font-semibold text-zinc-600">📌 법인사업자 부가세 신고 일정</p>
                <p>· 1분기 예정(1~3월): 4월 25일</p>
                <p>· 1기 확정(1~6월): 7월 25일</p>
                <p>· 2분기 예정(7~9월): 10월 25일</p>
                <p>· 2기 확정(7~12월): 다음해 1월 25일</p>
                <p className="text-zinc-400 mt-1">· 매출세액 − 매입세액 = 납부세액 | 신고처: 홈택스</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. 원천징수 ─────────────────────────────────────────────────── */}
        <Section title="🧾 원천징수 (프리랜서 3.3%)">
          <div className="bg-orange-50 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-bold text-orange-700">이번달 납부 예정 (다음달 10일까지)</p>
            <p className="text-2xl font-black text-orange-700">{fmtW(thisMonthW?.amount ?? 0)}</p>
            {(thisMonthW?.amount ?? 0) === 0 && <p className="text-xs text-orange-400">정산 완료된 프리랜서 데이터가 없습니다</p>}
          </div>
          <Row2 label={`${selectedQ}분기 합산`} value={fmtW(quarterWithholding)} />
          <Row2 label={`${selectedYear}년 연간 합산`} value={fmtW(yearWithholding)} />

          <details className="group">
            <summary className="text-xs text-blue-500 font-semibold cursor-pointer">월별 내역 보기 ▼</summary>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {withholdingByMonth.map((w) => (
                <div key={w.month} className={`rounded-lg p-2 text-center text-xs ${w.amount > 0 ? "bg-orange-50" : "bg-zinc-50"}`}>
                  <p className="text-zinc-400">{monthLabel(w.month)}</p>
                  <p className={`font-bold ${w.amount > 0 ? "text-orange-700" : "text-zinc-300"}`}>
                    {w.amount > 0 ? (w.amount / 10000).toFixed(0) + "만" : "—"}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </Section>

        {/* ── 5. 4대보험 ──────────────────────────────────────────────────── */}
        <Section title="🏥 4대보험 (정규직)">
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-blue-700">이번달 납부 기준 (다음달 10일까지)</p>
            {(thisMonthIns?.gross ?? 0) > 0 ? (
              <>
                <Row2 label="정규직 급여 합산" value={fmtW(thisMonthIns?.gross ?? 0)} />
                <Row2 label="사업주 부담 (10.65%)" value={fmtW(thisMonthIns?.employer ?? 0)} />
                <Row2 label="근로자 부담 (~9.08%)" value={fmtW(thisMonthIns?.employee ?? 0)} />
                <Row2 label="합계 납부액" value={fmtW((thisMonthIns?.employer ?? 0) + (thisMonthIns?.employee ?? 0))} bold />
              </>
            ) : (
              <p className="text-xs text-blue-400">정산 완료된 정규직 데이터가 없습니다</p>
            )}
          </div>
          <Row2 label={`${selectedQ}분기 4대보험 합산`} value={fmtW(quarterInsurance)} />
          <div className="rounded-xl bg-zinc-50 p-3 space-y-1 text-xs text-zinc-400">
            <p className="font-semibold text-zinc-500">4대보험 사업주 부담 요율</p>
            <p>· 국민연금 4.5% · 건강보험 3.545% · 장기요양 0.46%</p>
            <p>· 고용보험 1.15% · 산재보험 ~1.0% = 합계 약 10.65%</p>
          </div>
        </Section>

        {/* ── 6. 연간 소득세 / 법인세 예상 ───────────────────────────────── */}
        <Section title={`📊 ${cfg.incomeTaxName} 예상 (${selectedYear}년)`}>
          <div className="space-y-2">
            <Row2 label={`${selectedYear}년 패키지 매출 합산`} value={fmtW(yearTotalRevenue)} />
            <Row2 label="연간 비용 합산 (비용관리 기준)" value={`− ${fmtW(yearTotalCost)}`} />
            <Row2 label="추정 과세 소득" value={fmtW(estimatedIncome)} bold />
          </div>
          <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-indigo-700">{cfg.incomeTaxName} 예상액 ({cfg.incomeTaxDeadline})</p>
            <p className="text-2xl font-black text-indigo-700">{fmtW(incomeTaxEst)}</p>
            {bizType !== "법인" && (
              <p className="text-xs text-indigo-500">
                적용 세율: {estimatedIncome <= 14_000_000 ? "6%" :
                            estimatedIncome <= 50_000_000 ? "15%" :
                            estimatedIncome <= 88_000_000 ? "24%" :
                            estimatedIncome <= 150_000_000 ? "35%" : "38%↑"} 구간
              </p>
            )}
            {bizType === "법인" && (
              <p className="text-xs text-indigo-500">
                적용 세율: {estimatedIncome <= 200_000_000 ? "9%" :
                            estimatedIncome <= 20_000_000_000 ? "19%" : "21%"} 구간
              </p>
            )}
            <p className="text-xs text-zinc-400">※ 각종 공제·필요경비 미적용 추정액입니다</p>
          </div>
        </Section>

        {/* ── 7. 세금 신고 캘린더 ─────────────────────────────────────────── */}
        <Section title="📅 다가오는 세금 신고 일정">
          <div className="space-y-2">
            {upcomingDeadlines.map((d, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50">
                <div className="text-center min-w-[52px]">
                  <p className="text-xs text-zinc-400">{d.date.slice(0, 7)}</p>
                  <p className="text-base font-black text-zinc-700">{Number(d.date.split("-")[2])}일</p>
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${d.color}`}>{d.label}</p>
                  {d.amount !== undefined && d.amount > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5">예상 금액: {fmtW(d.amount)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-zinc-50 rounded-xl p-3 text-xs text-zinc-400 space-y-0.5">
            <p className="font-semibold text-zinc-500">매월 반복 일정</p>
            <p>· 매월 10일: 원천징수세 납부 (전월분)</p>
            <p>· 매월 10일: 4대보험 납부 (당월분)</p>
          </div>
        </Section>

        {/* ── 8. 분기 총 세금 부담 ─────────────────────────────────────────── */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
          <p className="text-xs text-zinc-400">{selectedQ}분기 세금 총 부담 예상 ({selectedYear}년)</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-300">부가세</span>
              <span className="font-bold text-red-400">
                {simplifiedExempt ? "면제" : fmtW(vatAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-300">원천징수 (프리랜서)</span>
              <span className="font-bold text-orange-400">{fmtW(quarterWithholding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-300">4대보험 (사업주+근로자)</span>
              <span className="font-bold text-blue-400">{fmtW(quarterInsurance)}</span>
            </div>
            <div className="flex justify-between font-black text-base border-t border-zinc-700 pt-2">
              <span>합계</span>
              <span>{fmtW((simplifiedExempt ? 0 : vatAmount) + quarterWithholding + quarterInsurance)}</span>
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-500">⚠️ 안내</p>
          <p>· 본 계산은 참고용이며 실제 신고는 반드시 세무사와 확인하세요</p>
          <p>· 원천징수·4대보험은 급여 정산 완료 데이터 기준으로 계산됩니다</p>
          <p>· 부가세 매출은 회원 패키지 등록 금액 기준입니다</p>
          <p>· 소득세는 각종 공제 전 추정액으로 실제와 다를 수 있습니다</p>
        </div>

        {/* 세무계산 탭 닫기 */}
        </>)}

        {/* ══════════════════ 세금 캘린더 탭 ══════════════════ */}
        {mainTab === "세금 캘린더" && (() => {
          // ── ICS 생성 유틸 ───────────────────────────────────────────────
          function nextDayStr(date: string) {
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            return d.toISOString().slice(0, 10).replace(/-/g, "");
          }
          interface CalEvent { date: string; title: string; desc: string; tag: "vat"|"income"|"withholding"|"insurance"|"etc"; }

          function buildEvents(y: number): CalEvent[] {
            const evts: CalEvent[] = [];
            // 매월 10일: 원천징수·4대보험
            for (let m = 1; m <= 12; m++) {
              const prevM = m === 1 ? 12 : m - 1;
              const prevY = m === 1 ? y - 1 : y;
              const prevMStr = `${prevY}-${String(prevM).padStart(2, "0")}`;
              const wht = settlements.filter((s) => s.month === prevMStr && s.settled && s.empType === "프리랜서")
                .reduce((sum, s) => sum + (s.withholdingTax ?? 0), 0);
              const mStr = `${y}-${String(m).padStart(2, "0")}`;
              const ins  = settlements.filter((s) => s.month === mStr && s.settled && s.empType === "정규직")
                .reduce((sum, s) => sum + s.grossSalary, 0);
              evts.push({
                date: `${y}-${String(m).padStart(2, "0")}-10`,
                title: `원천징수세 납부 (${prevM}월분)`,
                desc: `프리랜서 원천징수세 납부 (다음달 10일)${wht > 0 ? `\\n예정액: ${fmtW(wht)}` : ""}`,
                tag: "withholding",
              });
              evts.push({
                date: `${y}-${String(m).padStart(2, "0")}-10`,
                title: `4대보험 납부 (${m}월분)`,
                desc: `정규직 4대보험 사업주+근로자분 납부${ins > 0 ? `\\n예정액: ${fmtW(Math.round(ins * (0.1065 + 0.0908)))}` : ""}\\n납부처: EDI / 4대보험 포털`,
                tag: "insurance",
              });
            }
            // VAT / 소득세 / 법인세
            if (bizType === "법인") {
              evts.push(
                { date: `${y}-04-25`, title: "부가세 1분기 신고·납부", desc: "1~3월 매출 부가세 신고\\n홈택스 부가가치세 신고", tag: "vat" },
                { date: `${y}-07-25`, title: "부가세 2분기 신고·납부 (1기 확정)", desc: "4~6월 매출 부가세 신고\\n홈택스 부가가치세 신고", tag: "vat" },
                { date: `${y}-10-25`, title: "부가세 3분기 신고·납부", desc: "7~9월 매출 부가세 신고\\n홈택스 부가가치세 신고", tag: "vat" },
                { date: `${y + 1}-01-25`, title: "부가세 4분기 신고·납부 (2기 확정)", desc: "10~12월 매출 부가세 신고\\n홈택스 부가가치세 신고", tag: "vat" },
                { date: `${y + 1}-03-31`, title: "법인세 신고·납부", desc: `${y}년 귀속 법인세\\n사업연도 종료 후 3개월 이내`, tag: "income" },
              );
            } else if (bizType === "개인일반") {
              evts.push(
                { date: `${y}-04-25`, title: "부가세 예정고지 1기 (자동)", desc: "전기 납부액의 50% 자동고지\\n별도 신고 불필요", tag: "etc" },
                { date: `${y}-07-25`, title: "부가세 1기 확정신고 (1~6월)", desc: "1~6월 매출 부가세 확정 신고\\n홈택스 부가가치세 신고", tag: "vat" },
                { date: `${y}-10-25`, title: "부가세 예정고지 2기 (자동)", desc: "전기 납부액의 50% 자동고지\\n별도 신고 불필요", tag: "etc" },
                { date: `${y + 1}-01-25`, title: "부가세 2기 확정신고 (7~12월)", desc: "7~12월 매출 부가세 확정 신고\\n홈택스 부가가치세 신고", tag: "vat" },
                { date: `${y + 1}-05-31`, title: "종합소득세 신고·납부", desc: `${y}년 귀속 종합소득세\\n홈택스 종합소득세 신고`, tag: "income" },
              );
            } else {
              evts.push(
                { date: `${y + 1}-01-25`, title: "간이과세 부가세 신고 (연 1회)", desc: `${y}년 귀속 간이과세 부가세\\n홈택스 부가가치세 신고`, tag: "vat" },
                { date: `${y + 1}-05-31`, title: "종합소득세 신고·납부", desc: `${y}년 귀속 종합소득세\\n홈택스 종합소득세 신고`, tag: "income" },
              );
            }
            return evts.sort((a, b) => a.date.localeCompare(b.date));
          }

          function generateICS(evts: CalEvent[]): string {
            const lines = [
              "BEGIN:VCALENDAR",
              "VERSION:2.0",
              "PRODID:-//피트니스 경영 관리 시스템//KO",
              "CALSCALE:GREGORIAN",
              "METHOD:PUBLISH",
              "X-WR-CALNAME:세금 신고 일정",
              "X-WR-TIMEZONE:Asia/Seoul",
            ];
            for (const e of evts) {
              const d = e.date.replace(/-/g, "");
              lines.push(
                "BEGIN:VEVENT",
                `DTSTART;VALUE=DATE:${d}`,
                `DTEND;VALUE=DATE:${nextDayStr(e.date)}`,
                `SUMMARY:${e.title}`,
                `DESCRIPTION:${e.desc}`,
                `UID:${d}-${e.title.replace(/\s/g, "")}-gym@system`,
                "STATUS:CONFIRMED",
                "END:VEVENT",
              );
            }
            lines.push("END:VCALENDAR");
            return lines.join("\r\n");
          }

          function downloadICS(content: string, fname: string) {
            const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href = url; a.download = fname; a.click();
            URL.revokeObjectURL(url);
          }

          async function handleCalKakao() {
            const evts = buildEvents(calYear);
            // VAT / income 이벤트만 카카오로 전송 (매월 반복 항목 제외)
            const important = evts.filter((e) => e.tag === "vat" || e.tag === "income");
            const lines = [
              `📅 ${calYear}년 세금 신고 일정 (${bizType === "법인" ? "법인사업자" : bizType === "개인일반" ? "개인일반과세" : "간이과세"})`,
              "━━━━━━━━━━━━━━━━━━━━━",
              ...important.map((e) => `· ${e.date} — ${e.title}`),
              "━━━━━━━━━━━━━━━━━━━━━",
              "📌 매월 10일: 원천징수세 납부 · 4대보험 납부",
              "━━━━━━━━━━━━━━━━━━━━━",
              "📱 피트니스 경영 관리 시스템",
            ];
            const text = lines.join("\n");
            const appKey = KakaoStore.getAppKey();
            const token  = KakaoStore.getToken();
            setCalSending(true);
            try {
              if (appKey && token) {
                await initKakao(appKey);
                await sendKakaoMemo(text);
                setInvToast("✅ 카카오톡으로 전송됐습니다");
              } else if (typeof navigator !== "undefined" && navigator.share) {
                await navigator.share({ title: `${calYear}년 세금 일정`, text });
                setInvToast("✅ 공유 완료");
              } else {
                await navigator.clipboard.writeText(text);
                setInvToast("📋 복사됐습니다. 카카오톡에 붙여넣기 하세요.");
              }
            } catch (e) {
              setInvToast(`❌ ${(e as Error).message}`);
            } finally {
              setCalSending(false);
            }
          }

          const calEvents = buildEvents(calYear);

          // 월별로 그룹화
          const grouped: Record<string, CalEvent[]> = {};
          for (const e of calEvents) {
            const key = e.date.slice(0, 7);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(e);
          }

          const TAG_COLOR: Record<string, string> = {
            vat:          "text-red-600 bg-red-50 border-red-200",
            income:       "text-indigo-700 bg-indigo-50 border-indigo-200",
            withholding:  "text-orange-600 bg-orange-50 border-orange-200",
            insurance:    "text-blue-600 bg-blue-50 border-blue-200",
            etc:          "text-zinc-400 bg-zinc-50 border-zinc-200",
          };
          const TAG_LABEL: Record<string, string> = {
            vat:         "부가세",
            income:      "소득·법인세",
            withholding: "원천징수",
            insurance:   "4대보험",
            etc:         "자동",
          };

          const korMonths = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

          return (
            <>
              {/* 헤더 + 내보내기 */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <select value={calYear} onChange={(e) => setCalYear(Number(e.target.value))}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none">
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                  <span className={`text-xs px-2 py-1 rounded-lg font-bold ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadICS(generateICS(calEvents), `세금일정_${calYear}.ics`)}
                    className="flex items-center gap-1 bg-blue-600 text-white text-xs font-black px-3 py-2 rounded-xl hover:bg-blue-700 transition">
                    📅 구글 캘린더
                  </button>
                  <button onClick={handleCalKakao} disabled={calSending}
                    className="flex items-center gap-1 bg-yellow-400 text-zinc-900 text-xs font-black px-3 py-2 rounded-xl hover:bg-yellow-300 transition disabled:opacity-40">
                    {calSending ? "⏳" : "💬 카카오"}
                  </button>
                </div>
              </div>

              {/* 내보내기 안내 */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">📅 구글 캘린더 저장 방법</p>
                <p>① 위 버튼 클릭 → .ics 파일 다운로드</p>
                <p>② 구글 캘린더 앱/웹 → 설정 → 다른 캘린더 가져오기 → 파일 선택</p>
                <p>③ 또는 다운받은 파일을 더블클릭 (자동으로 캘린더 앱 연동)</p>
              </div>

              {/* 매월 반복 항목 배너 */}
              <div className="bg-zinc-100 rounded-xl p-3 text-xs text-zinc-600 space-y-1">
                <p className="font-black text-zinc-700">📌 매월 반복 납부 (10일)</p>
                <div className="flex gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    원천징수세 납부 (전월 프리랜서분)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                    4대보험 납부 (당월 정규직분)
                  </span>
                </div>
              </div>

              {/* 월별 주요 일정 */}
              <div className="space-y-3">
                {Object.entries(grouped)
                  .filter(([, evts]) => evts.length > 0)
                  .map(([monthKey, evts]) => {
                    const [y, m] = monthKey.split("-");
                    const important = evts; // 원천징수·4대보험 포함 전체 표시
                    if (important.length === 0) return null;
                    const isNextYear = Number(y) > calYear;
                    return (
                      <div key={monthKey} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
                        <div className={`px-4 py-2 flex items-center justify-between ${isNextYear ? "bg-zinc-50" : "bg-white"}`}>
                          <p className="font-black text-zinc-800 text-sm">
                            {isNextYear ? `${y}년 ` : ""}{korMonths[Number(m) - 1]}
                          </p>
                          {isNextYear && <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">내년</span>}
                        </div>
                        <div className="px-4 pb-4 space-y-2">
                          {important.map((e, i) => (
                            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${TAG_COLOR[e.tag]}`}>
                              <div className="text-center min-w-[36px]">
                                <p className="text-lg font-black">{Number(e.date.split("-")[2])}</p>
                                <p className="text-xs opacity-60">일</p>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-bold">{e.title}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold border ${TAG_COLOR[e.tag]}`}>
                                    {TAG_LABEL[e.tag]}
                                  </span>
                                </div>
                                <p className="text-xs opacity-70 mt-0.5 whitespace-pre-line">
                                  {e.desc.replace(/\\n/g, "\n")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 월별 원천징수·4대보험 상세 (접기) */}
              <details className="group bg-white rounded-2xl border border-zinc-100">
                <summary className="px-4 py-3 text-sm font-bold text-zinc-700 cursor-pointer flex justify-between items-center">
                  <span>📋 월별 원천징수·4대보험 납부 내역</span>
                  <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = i + 1;
                    const mStr = `${calYear}-${String(m).padStart(2, "0")}`;
                    const prevMStr = m === 1 ? `${calYear - 1}-12` : `${calYear}-${String(m - 1).padStart(2, "0")}`;
                    const wht = settlements.filter((s) => s.month === prevMStr && s.settled && s.empType === "프리랜서")
                      .reduce((sum, s) => sum + (s.withholdingTax ?? 0), 0);
                    const ins = settlements.filter((s) => s.month === mStr && s.settled && s.empType === "정규직")
                      .reduce((sum, s) => sum + s.grossSalary, 0) * (0.1065 + 0.0908);
                    return (
                      <div key={m} className="bg-zinc-50 rounded-xl p-3 text-xs space-y-1">
                        <p className="font-bold text-zinc-700">{korMonths[i]} 10일</p>
                        <p className={`${wht > 0 ? "text-orange-600" : "text-zinc-300"}`}>
                          원천: {wht > 0 ? fmtW(wht) : "—"}
                        </p>
                        <p className={`${ins > 0 ? "text-blue-600" : "text-zinc-300"}`}>
                          4대보험: {ins > 0 ? fmtW(Math.round(ins)) : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* 사업자 유형 변경 안내 */}
              <div className="bg-zinc-50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
                <p className="font-semibold text-zinc-600">📌 캘린더는 세무계산 탭의 사업자 유형 기준으로 생성됩니다</p>
                <p>· 법인: 분기 4회 부가세 신고 + 법인세 (3월 31일)</p>
                <p>· 개인일반: 반기 2회 부가세 신고 + 종합소득세 (5월 31일)</p>
                <p>· 간이: 연 1회 부가세 신고 + 종합소득세 (5월 31일)</p>
              </div>
            </>
          );
        })()}

        {/* Toast (발행 내역 탭) */}
        {invToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
            {invToast}
          </div>
        )}
      </div>
    </div>
  );
}
