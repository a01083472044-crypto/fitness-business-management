"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMembers, getCosts, getSchedules, getSettlements, getTrainers, getBranches,
  getReceivables, getConsultations, calcGymMembershipRevenue,
  emptyCosts, currentMonth, setPrefill,
  MonthlyCosts, ScheduleEntry, Member, TrainerSettlement,
} from "../../lib/store";
import { getSession } from "../../lib/auth";
import { getSubscription, trialDaysLeft, Subscription } from "../../lib/subscription";

const INS_RATE = 0.1065;
const GOAL_KEY           = "gym_monthly_goals";
const SETTLEMENT_DAY_KEY = "gym_settlement_day"; // 1~28

/* ── 유틸 ── */
function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}
function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function today()     { return dateStr(new Date()); }
function yesterday() { const d = new Date(); d.setDate(d.getDate()-1); return dateStr(d); }
function daysAfter(n: number) { const d = new Date(); d.setDate(d.getDate()+n); return dateStr(d); }

/** 정산일 기준으로 이번 정산 기간(시작~끝) 계산 */
function getSettlementPeriod(day: number): { start: string; end: string; label: string } {
  const now      = new Date();
  const todayDay = now.getDate();

  // 시작: 이번 달 day 이전이면 지난달 day, 이후면 이번달 day
  const startDate = todayDay >= day
    ? new Date(now.getFullYear(), now.getMonth(), day)
    : new Date(now.getFullYear(), now.getMonth() - 1, day);

  // 끝: 다음 정산일 전날
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, day - 1);

  const label = `${startDate.getMonth()+1}/${startDate.getDate()} ~ ${endDate.getMonth()+1}/${endDate.getDate()}`;
  return { start: dateStr(startDate), end: dateStr(endDate), label };
}

/** 정산 기간 내 총 결제금액 계산 */
function calcPeriodPayment(members: Member[], start: string, end: string): number {
  let total = 0;
  for (const m of members) {
    for (const p of m.packages ?? []) {
      if (p.registeredAt >= start && p.registeredAt <= end) total += p.paymentAmount;
    }
    for (const g of m.gymMemberships ?? []) {
      if (g.registeredAt >= start && g.registeredAt <= end) total += g.paymentAmount;
    }
  }
  return total;
}

function calcPTRevenue(schedules: ScheduleEntry[], members: Member[], month: string) {
  let revenue = 0; let sessions = 0;
  for (const s of schedules) {
    if (!s.date.startsWith(month) || !s.done) continue;
    sessions++;
    if (s.packageId) {
      for (const m of members) {
        const pkg = m.packages?.find((p) => p.id === s.packageId);
        if (pkg && pkg.totalSessions > 0) { revenue += pkg.paymentAmount / pkg.totalSessions; break; }
      }
    }
  }
  return { revenue, sessions };
}

function calcYesterdayConsumed(schedules: ScheduleEntry[], members: Member[]) {
  const yd = yesterday();
  let consumed = 0;
  for (const s of schedules) {
    if (s.date !== yd || !s.done || !s.packageId) continue;
    for (const m of members) {
      const pkg = m.packages?.find((p) => p.id === s.packageId);
      if (pkg && pkg.totalSessions > 0) { consumed += pkg.paymentAmount / pkg.totalSessions; break; }
    }
  }
  return consumed;
}

function Row({ label, value, sub, plus }: { label: string; value: string; sub?: string; plus?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <div className="text-right">
        <span className={`font-semibold ${plus ? "text-blue-600" : "text-zinc-800"}`}>{value}</span>
        {sub && <p className="text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ── 알림 카드 ── */
function AlertCard({ icon, title, count, desc, href, color }: {
  icon: string; title: string; count: number; desc: string; href: string;
  color: "red" | "orange" | "blue" | "emerald";
}) {
  const colors = {
    red:     "bg-red-50 border-red-200 text-red-700",
    orange:  "bg-orange-50 border-orange-200 text-orange-700",
    blue:    "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <Link href={href} className={`flex items-center gap-3 border rounded-2xl px-4 py-3 hover:opacity-80 transition ${colors[color]}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold opacity-70">{title}</p>
        <p className="font-black text-lg leading-tight">{count}명</p>
        <p className="text-xs opacity-60 truncate">{desc}</p>
      </div>
      <span className="text-sm font-bold shrink-0">→</span>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [month, setMonth]             = useState(currentMonth());
  const [costs, setCosts]             = useState<MonthlyCosts>(emptyCosts(currentMonth()));
  const [schedules, setSchedules]     = useState<ScheduleEntry[]>([]);
  const [members, setMembers]         = useState<Member[]>([]);
  const [settlements, setSettlements] = useState<TrainerSettlement[]>([]);
  const [trainerCount, setTrainerCount] = useState(0);
  const [sent, setSent]               = useState(false);
  const [savedBranches, setSavedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("전체");
  const [allTrainers, setAllTrainers] = useState<ReturnType<typeof getTrainers>>([]);
  const [subscription, setSubscription]   = useState<Subscription | null>(null);
  const [goalRevenue, setGoalRevenue]     = useState(0);
  const [settlementDay, setSettlementDay] = useState(1);       // 정산 기준일
  const [showDayPicker, setShowDayPicker] = useState(false);   // 정산일 선택 UI
  const [periodPayment, setPeriodPayment] = useState(0);       // 이번 정산기간 누적
  const [periodLabel, setPeriodLabel]     = useState("");

  /* ── 브리핑용 상태 ── */
  const [briefing, setBriefing] = useState({
    yesterdayPayment:  0,
    yesterdayConsumed: 0,
    expiringToday:     [] as { name: string; type: string }[],
    expiringIn3Days:   [] as { name: string; type: string; endDate: string }[],
    unpaidMembers:     [] as { name: string; amount: number }[],
    atRiskMembers:     [] as { name: string; daysSince: number }[],
    yesterdayConsults: 0,
    yesterdayConverted: 0,
    monthConversionRate: 0,
    /* 어제 상담 목록 */
    yesterdayConsultList: [] as { name: string; source: string; interest: string; status: string }[],
    /* 오늘 재상담 예정 */
    followUpToday: [] as { name: string; counselor: string }[],
    /* 어제 미등록 → 팔로업 필요 */
    noRegisterFollowUp: [] as { name: string; interest: string }[],
  });

  /* ── 구독 조회 ── */
  useEffect(() => {
    getSession().then((s) => {
      if (s) getSubscription(s.user.id).then(setSubscription);
    });
  }, []);

  /* ── 정산일 로드 ── */
  useEffect(() => {
    const saved = parseInt(localStorage.getItem(SETTLEMENT_DAY_KEY) ?? "1", 10);
    setSettlementDay(isNaN(saved) ? 1 : saved);
  }, []);

  /* ── 목표 조회 ── */
  useEffect(() => {
    try {
      const goals = JSON.parse(localStorage.getItem(GOAL_KEY) ?? "{}");
      setGoalRevenue(goals[month] ?? 0);
    } catch { setGoalRevenue(0); }
  }, [month]);

  /* ── 정산기간 누적 결제 계산 (settlementDay 또는 members 바뀔 때) ── */
  useEffect(() => {
    const allMembers = getMembers();
    const { start, end, label } = getSettlementPeriod(settlementDay);
    setPeriodPayment(calcPeriodPayment(allMembers, start, end));
    setPeriodLabel(label);
  }, [settlementDay]);

  /* ── 데이터 로드 ── */
  useEffect(() => {
    const trainers    = getTrainers();
    const allSchedules = getSchedules();
    const allMembers   = getMembers();
    const rcvs         = getReceivables();
    const consults     = getConsultations();
    const yd           = yesterday();
    const td           = today();

    setAllTrainers(trainers);
    setSchedules(allSchedules);
    setMembers(allMembers);
    setSettlements(getSettlements());
    setTrainerCount(trainers.filter((t) => t.status === "재직").length);
    setSavedBranches(getBranches());

    /* ── 어제 결제 총금액 ── */
    const ydPTPayment  = allMembers.flatMap((m) => m.packages ?? [])
      .filter((p) => p.registeredAt === yd)
      .reduce((s, p) => s + p.paymentAmount, 0);
    const ydGymPayment = allMembers.flatMap((m) => m.gymMemberships ?? [])
      .filter((g) => g.registeredAt === yd)
      .reduce((s, g) => s + g.paymentAmount, 0);

    /* ── 어제 소진 금액 ── */
    const ydConsumed = calcYesterdayConsumed(allSchedules, allMembers);

    /* ── 오늘/3일내 만료 회원 (헬스 회원권 기준) ── */
    const expiringToday: { name: string; type: string }[] = [];
    const expiringIn3Days: { name: string; type: string; endDate: string }[] = [];
    /* PT 패키지 잔여 1~2회 경고 회원 */
    for (const m of allMembers) {
      for (const g of m.gymMemberships ?? []) {
        if (g.endDate === td)
          expiringToday.push({ name: m.name, type: "헬스 회원권" });
        else if (g.endDate > td && g.endDate <= daysAfter(3))
          expiringIn3Days.push({ name: m.name, type: "헬스 회원권", endDate: g.endDate });
      }
      /* PT: 잔여 횟수 2회 이하이면 만료임박으로 분류 */
      for (const p of m.packages ?? []) {
        const remaining = p.totalSessions - p.conductedSessions;
        if (remaining === 0)
          expiringToday.push({ name: m.name, type: "PT 잔여 0회" });
        else if (remaining <= 2)
          expiringIn3Days.push({ name: m.name, type: `PT 잔여 ${remaining}회`, endDate: "" });
      }
    }

    /* ── 미수금 회원 ── */
    const unpaidMap = new Map<string, number>();
    for (const r of rcvs.filter((r) => !r.paid)) {
      unpaidMap.set(r.memberName, (unpaidMap.get(r.memberName) ?? 0) + r.amount);
    }
    const unpaidMembers = Array.from(unpaidMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    /* ── 위험 회원: 14일 이상 수업 없는 활성 회원 ── */
    const cutoff = dateStr(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
    const atRiskMembers: { name: string; daysSince: number }[] = [];
    for (const m of allMembers) {
      const hasActivePackage = (m.packages ?? []).some(
        (p) => (p.totalSessions - p.conductedSessions) > 0
      );
      if (!hasActivePackage) continue;
      const lastSession = allSchedules
        .filter((s) => s.memberName === m.name && s.done)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!lastSession || lastSession.date < cutoff) {
        const daysSince = lastSession
          ? Math.floor((Date.now() - new Date(lastSession.date).getTime()) / 86400000)
          : 999;
        atRiskMembers.push({ name: m.name, daysSince });
      }
    }
    atRiskMembers.sort((a, b) => b.daysSince - a.daysSince);

    /* ── 어제 상담 데이터 ── */
    const ydConsults  = consults.filter((c) => c.date === yd);
    const ydConverted = ydConsults.filter((c) => c.status === "완료-등록").length;
    const ydConsultList = ydConsults.map((c) => ({
      name:     c.name,
      source:   c.source || "경로 미입력",
      interest: c.interest || "미입력",
      status:   c.status,
    }));

    /* ── 오늘 재상담 예정 ── */
    const followUpToday = consults
      .filter((c) => c.followUpDate === td && c.status === "재상담")
      .map((c) => ({ name: c.name, counselor: c.counselor }));

    /* ── 어제 미등록 → 팔로업 필요 ── */
    const noRegisterFollowUp = ydConsults
      .filter((c) => c.status === "완료-미등록")
      .map((c) => ({ name: c.name, interest: c.interest || "미입력" }));

    /* ── 이달 마케팅 전환율 ── */
    const thisMonthConsults = consults.filter((c) => c.date.startsWith(month));
    const completedConsults = thisMonthConsults.filter(
      (c) => c.status === "완료-등록" || c.status === "완료-미등록"
    );
    const convertedConsults = thisMonthConsults.filter((c) => c.status === "완료-등록");
    const convRate = completedConsults.length > 0
      ? Math.round((convertedConsults.length / completedConsults.length) * 100)
      : 0;

    setBriefing({
      yesterdayPayment:    ydPTPayment + ydGymPayment,
      yesterdayConsumed:   ydConsumed,
      expiringToday,
      expiringIn3Days,
      unpaidMembers,
      atRiskMembers,
      yesterdayConsults:   ydConsults.length,
      yesterdayConverted:  ydConverted,
      monthConversionRate: convRate,
      yesterdayConsultList: ydConsultList,
      followUpToday,
      noRegisterFollowUp,
    });
  }, [month]);

  useEffect(() => {
    const all      = getCosts();
    const branchKey = selectedBranch === "전체" ? "" : selectedBranch;
    const found    = all.find((c) => c.month === month && (c.branch ?? "") === branchKey);
    const global   = all.find((c) => c.month === month && (c.branch ?? "") === "");
    setCosts(found ?? global ?? emptyCosts(month));
    setSent(false);
  }, [month, selectedBranch]);

  /* ── 지점 필터 ── */
  const branches = useMemo(() => {
    const set = new Set<string>();
    allTrainers.forEach((t) => { if (t.branch) set.add(t.branch); });
    savedBranches.forEach((b) => set.add(b));
    return Array.from(set);
  }, [allTrainers, savedBranches]);

  const trainerBranchMap = useMemo(() => {
    const map: Record<string, string> = {};
    allTrainers.forEach((t) => { map[t.name] = t.branch; });
    return map;
  }, [allTrainers]);

  const branchMembers = useMemo(() => {
    if (selectedBranch === "전체") return members;
    return members.filter((m) =>
      trainerBranchMap[m.trainer] === selectedBranch ||
      m.packages?.some((pkg) => trainerBranchMap[pkg.trainerName] === selectedBranch)
    );
  }, [members, selectedBranch, trainerBranchMap]);

  const branchSchedules = useMemo(() => {
    if (selectedBranch === "전체") return schedules;
    return schedules.filter((s) => trainerBranchMap[s.trainerName] === selectedBranch);
  }, [schedules, selectedBranch, trainerBranchMap]);

  const branchTrainerCount = useMemo(() => {
    if (selectedBranch === "전체") return trainerCount;
    return allTrainers.filter((t) => t.status === "재직" && t.branch === selectedBranch).length;
  }, [allTrainers, selectedBranch, trainerCount]);

  const { revenue: ptScheduleRevenue, sessions: doneSessions } = useMemo(
    () => calcPTRevenue(branchSchedules, branchMembers, month),
    [branchSchedules, branchMembers, month]
  );
  const { consumed: gymConsumed, deferred: gymDeferred } = useMemo(
    () => calcGymMembershipRevenue(branchMembers, month),
    [branchMembers, month]
  );

  const totalMembers    = branchMembers.length;
  const totalPaid       = branchMembers.reduce((s, m) => s + m.totalPayment, 0);
  const totalSessions   = branchMembers.reduce((s, m) => s + m.totalSessions, 0);
  const conductedTotal  = branchMembers.reduce((s, m) => s + m.conductedSessions, 0);
  const allTimeRatio    = totalSessions > 0 ? conductedTotal / totalSessions : 0;
  const ptActualRevenue = ptScheduleRevenue > 0 ? ptScheduleRevenue : totalPaid * allTimeRatio;
  const ptRevenueSource = ptScheduleRevenue > 0 ? "스케줄 완료 기준" : "누적 소진률 추정";
  const gymMemTotal     = branchMembers.reduce((s, m) =>
    s + (m.gymMemberships ?? []).reduce((ss, g) => ss + g.paymentAmount, 0), 0);
  const activeGymMems   = branchMembers.reduce((s, m) =>
    s + (m.gymMemberships ?? []).filter((g) => new Date(g.endDate) >= new Date()).length, 0);
  const actualRevenue   = ptActualRevenue + gymConsumed;

  const monthSettlements = useMemo(() => {
    const allSettled = settlements.filter((s) => s.month === month && s.settled);
    if (selectedBranch === "전체") return allSettled;
    return allSettled.filter((s) => trainerBranchMap[s.trainerName] === selectedBranch);
  }, [settlements, month, selectedBranch, trainerBranchMap]);
  const settledCount      = monthSettlements.length;
  const hasSettlement     = settledCount > 0;
  const settledSalaryCost = monthSettlements.reduce((s, r) => s + r.companyCost, 0);
  const manualSalaryCost  = costs.trainerSalary * (1 + INS_RATE) + costs.freelanceSalary;
  const effectiveSalaryCost = hasSettlement ? settledSalaryCost : manualSalaryCost;
  const salarySource      = hasSettlement ? `급여 정산 (${settledCount}명 완료)` : "비용 관리 수동 입력";
  const vat               = costs.isVat ? actualRevenue * 0.1 : 0;
  const otherFixed        = costs.rent + (costs.managementFee ?? 0) + costs.utilities + costs.communication + costs.depreciation + costs.otherFixed;
  const paymentFee        = costs.paymentFee ?? 0;
  const totalVariable     = costs.supplies + costs.marketing + (costs.parkingFee ?? 0) + paymentFee + costs.otherVariable;
  const netProfit         = actualRevenue - vat - effectiveSalaryCost - otherFixed - totalVariable;
  const laborRatio        = actualRevenue > 0 ? (effectiveSalaryCost / actualRevenue) * 100 : 0;
  const laborGrade =
    laborRatio === 0 ? null :
    laborRatio < 30  ? { label: "안전", color: "emerald", icon: "✅", desc: "인건비 비율 적정" } :
    laborRatio < 40  ? { label: "주의", color: "yellow",  icon: "⚠️", desc: "권장 범위 상단 근접" } :
                       { label: "위험", color: "red",     icon: "🔴", desc: "40% 초과 — 즉각 검토 필요" };

  /* ── 목표 달성률 ── */
  const goalProgress = goalRevenue > 0 ? Math.min(100, Math.round((actualRevenue / goalRevenue) * 100)) : 0;

  const handleSendToCalc = () => {
    const fullGross = hasSettlement
      ? monthSettlements.filter((s) => s.empType === "정규직").reduce((sum, s) => sum + s.grossSalary, 0)
      : costs.trainerSalary;
    const freeGross = hasSettlement
      ? monthSettlements.filter((s) => s.empType === "프리랜서").reduce((sum, s) => sum + s.grossSalary, 0)
      : costs.freelanceSalary;
    const monthPkgs     = branchMembers.flatMap((m) => (m.packages ?? []).filter((p) => (p.registeredAt ?? "").startsWith(month)));
    const monthPayment  = monthPkgs.reduce((s, p) => s + p.paymentAmount, 0);
    const monthSessions = monthPkgs.reduce((s, p) => s + p.totalSessions, 0);
    setPrefill({
      totalPayment:      (monthPayment > 0 ? monthPayment : totalPaid) + gymConsumed,
      totalSessions:     monthSessions > 0 ? monthSessions : Math.max(totalSessions, 1),
      conductedSessions: monthPayment > 0 ? Math.min(doneSessions, monthSessions) : conductedTotal,
      rent: costs.rent, managementFee: costs.managementFee,
      trainerSalary: fullGross, freelanceSalary: freeGross,
      utilities: costs.utilities, communication: costs.communication,
      depreciation: costs.depreciation, otherFixed: costs.otherFixed,
      supplies: costs.supplies, marketing: costs.marketing,
      parkingFee: costs.parkingFee, paymentFee, otherVariable: costs.otherVariable,
      isVat: costs.isVat,
    });
    setSent(true);
    setTimeout(() => router.push("/"), 600);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">대시보드</h1>
            <p className="text-sm text-zinc-400 mt-0.5">{today().replace(/-/g, ".")} 경영 브리핑</p>
          </div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500" />
        </div>

        {/* ── 구독 배너 ── */}
        {subscription?.status === "trial" && (
          <Link href="/subscribe"
            className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 hover:bg-amber-100 transition">
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <p className="text-sm font-bold text-amber-800">무료 체험 {trialDaysLeft(subscription)}일 남음</p>
            </div>
            <span className="text-amber-700 font-semibold text-sm">요금제 보기 →</span>
          </Link>
        )}

        {/* ════════════════════════════════════════
            ① 결제 현황 (전날 + 정산기간 누적)
        ════════════════════════════════════════ */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">💳 결제 현황</p>
            <button
              onClick={() => setShowDayPicker((v) => !v)}
              className="flex items-center gap-1 text-xs text-blue-500 font-semibold hover:text-blue-700 transition"
            >
              <span>정산일 매월 {settlementDay}일</span>
              <span className="text-zinc-400">✏️</span>
            </button>
          </div>

          {/* 정산일 선택 피커 */}
          {showDayPicker && (
            <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-bold text-zinc-500 mb-3">정산 시작일 선택 (매월 몇 일부터?)</p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSettlementDay(d);
                      localStorage.setItem(SETTLEMENT_DAY_KEY, String(d));
                      setShowDayPicker(false);
                    }}
                    className={`rounded-xl py-2 text-sm font-bold transition ${
                      settlementDay === d
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-50 text-zinc-700 hover:bg-blue-50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-3 text-center">
                예) 15일 선택 시 → 매월 15일 ~ 다음달 14일 기준
              </p>
            </div>
          )}

          {/* 전날 결제금 + 정산기간 누적 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 rounded-2xl p-4 text-white">
              <p className="text-xs text-zinc-400 mb-1">전날 결제금</p>
              <p className="text-2xl font-black">{fmtW(briefing.yesterdayPayment)}</p>
              <p className="text-xs text-zinc-500 mt-1">{yesterday().replace(/-/g,".")} 신규 등록</p>
            </div>
            <div className="bg-blue-600 rounded-2xl p-4 text-white">
              <p className="text-xs text-blue-200 mb-1">이번 기간 누적</p>
              <p className="text-2xl font-black">{fmtW(periodPayment)}</p>
              <p className="text-xs text-blue-300 mt-1">{periodLabel}</p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            ② 어제 현황 (소진·상담)
        ════════════════════════════════════════ */}
        <section className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">📅 어제 현황</p>
          <div className="grid grid-cols-2 gap-3">
            {/* 어제 결제 */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-zinc-400 mb-1">결제 총금액</p>
              <p className="text-xl font-black text-zinc-900">{fmtW(briefing.yesterdayPayment)}</p>
              <p className="text-xs text-zinc-400 mt-1">신규 등록 기준</p>
            </div>
            {/* 어제 소진 */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-zinc-400 mb-1">소진된 금액</p>
              <p className="text-xl font-black text-blue-600">{fmtW(briefing.yesterdayConsumed)}</p>
              <p className="text-xs text-zinc-400 mt-1">완료 수업 기준</p>
            </div>
            {/* 어제 상담 */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-zinc-400 mb-1">어제 상담</p>
              <p className="text-xl font-black text-zinc-900">{briefing.yesterdayConsults}건</p>
              <p className="text-xs text-emerald-500 mt-1">
                {briefing.yesterdayConsults > 0
                  ? `등록 ${briefing.yesterdayConverted}명`
                  : "상담 없음"}
              </p>
            </div>
            {/* 마케팅 전환율 */}
            <Link href="/consultation" className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm hover:border-blue-200 transition">
              <p className="text-xs text-zinc-400 mb-1">마케팅 전환율</p>
              <p className={`text-xl font-black ${briefing.monthConversionRate >= 50 ? "text-emerald-600" : briefing.monthConversionRate >= 30 ? "text-amber-500" : "text-red-500"}`}>
                {briefing.monthConversionRate}%
              </p>
              <p className="text-xs text-zinc-400 mt-1">이번 달 상담 → 등록</p>
            </Link>
          </div>
        </section>

        {/* ════════════════════════════════════════
            ② 오늘 해야 할 일
        ════════════════════════════════════════ */}
        {(briefing.expiringToday.length > 0 || briefing.expiringIn3Days.length > 0 ||
          briefing.unpaidMembers.length > 0 || briefing.atRiskMembers.length > 0) && (
          <section className="space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🚨 오늘 처리할 것</p>
            <div className="space-y-2">
              {briefing.expiringToday.length > 0 && (
                <AlertCard
                  icon="📛" color="red"
                  title="오늘 만료 회원"
                  count={briefing.expiringToday.length}
                  desc={briefing.expiringToday.slice(0,3).map((m) => m.name).join(", ") + (briefing.expiringToday.length > 3 ? " 외" : "")}
                  href="/members"
                />
              )}
              {briefing.expiringIn3Days.length > 0 && (
                <AlertCard
                  icon="⏰" color="orange"
                  title="3일 내 만료 예정"
                  count={briefing.expiringIn3Days.length}
                  desc={briefing.expiringIn3Days.slice(0,3).map((m) => `${m.name}(${m.endDate.slice(5)})`).join(", ")}
                  href="/notifications"
                />
              )}
              {briefing.unpaidMembers.length > 0 && (
                <AlertCard
                  icon="💸" color="orange"
                  title="미수금 회원"
                  count={briefing.unpaidMembers.length}
                  desc={`총 ${fmtW(briefing.unpaidMembers.reduce((s, m) => s + m.amount, 0))} · ${briefing.unpaidMembers[0]?.name} 외`}
                  href="/notifications"
                />
              )}
              {briefing.atRiskMembers.length > 0 && (
                <AlertCard
                  icon="😴" color="blue"
                  title="수업 안 온 위험 회원 (14일↑)"
                  count={briefing.atRiskMembers.length}
                  desc={briefing.atRiskMembers.slice(0,3).map((m) => `${m.name}(${m.daysSince === 999 ? "미수업" : m.daysSince + "일"})`).join(", ")}
                  href="/notifications"
                />
              )}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════
            ② - 상담 섹션
        ════════════════════════════════════════ */}

        {/* 오늘 재상담 예정 / 미등록 팔로업 알림 */}
        {(briefing.followUpToday.length > 0 || briefing.noRegisterFollowUp.length > 0) && (
          <section className="space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">📞 오늘 연락할 것</p>
            <div className="space-y-2">
              {briefing.followUpToday.length > 0 && (
                <AlertCard
                  icon="🔄" color="blue"
                  title="오늘 재상담 예정"
                  count={briefing.followUpToday.length}
                  desc={briefing.followUpToday.map((c) => c.name).join(", ")}
                  href="/consultation"
                />
              )}
              {briefing.noRegisterFollowUp.length > 0 && (
                <AlertCard
                  icon="📲" color="orange"
                  title="어제 미등록 → 팔로업 필요"
                  count={briefing.noRegisterFollowUp.length}
                  desc={briefing.noRegisterFollowUp.map((c) => `${c.name}(${c.interest})`).join(", ")}
                  href="/consultation"
                />
              )}
            </div>
          </section>
        )}

        {/* 어제 상담 상세 목록 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">💬 어제 상담 내역</p>
            <Link href="/consultation" className="text-xs text-blue-500 font-semibold">전체 보기 →</Link>
          </div>
          {briefing.yesterdayConsultList.length > 0 ? (
            <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
              {briefing.yesterdayConsultList.map((c, i) => {
                const statusColor: Record<string, string> = {
                  "완료-등록":   "bg-emerald-100 text-emerald-700",
                  "완료-미등록": "bg-red-100 text-red-600",
                  "예약":        "bg-blue-100 text-blue-700",
                  "재상담":      "bg-amber-100 text-amber-700",
                  "취소":        "bg-zinc-100 text-zinc-500",
                };
                const statusLabel: Record<string, string> = {
                  "완료-등록":   "✅ 등록",
                  "완료-미등록": "❌ 미등록",
                  "예약":        "📅 예약",
                  "재상담":      "🔄 재상담",
                  "취소":        "🚫 취소",
                };
                return (
                  <div key={i} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-zinc-50" : ""}`}>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{c.name}</p>
                      <p className="text-xs text-zinc-400">{c.source} · {c.interest}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor[c.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                      {statusLabel[c.status] ?? c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-zinc-100 rounded-2xl px-4 py-5 text-center shadow-sm">
              <p className="text-sm text-zinc-400">어제 상담 내역이 없습니다</p>
              <Link href="/consultation" className="text-xs text-blue-500 font-semibold mt-1 block">상담 등록하러 가기 →</Link>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════
            ③ 이번 달 목표 달성률
        ════════════════════════════════════════ */}
        <section className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">🎯 이번 달 목표</p>
          <Link href="/goal" className="block bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm hover:border-blue-200 transition">
            {goalRevenue > 0 ? (
              <>
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-xs text-zinc-400">달성 매출</p>
                    <p className="text-xl font-black text-zinc-900">{fmtW(actualRevenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">목표</p>
                    <p className="text-base font-bold text-zinc-500">{fmtW(goalRevenue)}</p>
                  </div>
                </div>
                {/* 진행 바 */}
                <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      goalProgress >= 100 ? "bg-emerald-500" :
                      goalProgress >= 70  ? "bg-blue-500" :
                      goalProgress >= 40  ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-zinc-400">달성률</p>
                  <p className={`text-sm font-black ${
                    goalProgress >= 100 ? "text-emerald-600" :
                    goalProgress >= 70  ? "text-blue-600" :
                    goalProgress >= 40  ? "text-amber-600" : "text-red-500"
                  }`}>
                    {goalProgress}%
                    {goalProgress >= 100 && " 🎉 목표 달성!"}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-zinc-400 text-sm">목표 매출이 설정되지 않았습니다</p>
                <p className="text-blue-500 text-xs font-bold mt-1">목표 설정하러 가기 →</p>
              </div>
            )}
          </Link>
        </section>

        {/* ── 지점 탭 ── */}
        {branches.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["전체", ...branches].map((b) => (
              <button key={b} onClick={() => setSelectedBranch(b)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  selectedBranch === b ? "bg-blue-600 text-white" : "bg-white border border-zinc-200 text-zinc-500"
                }`}>
                {b}
              </button>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════
            ④ 이번달 매출 & 손익
        ════════════════════════════════════════ */}
        <section className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">📊 이번달 매출</p>

          {/* 핵심 3가지 금액 카드 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-600 rounded-2xl p-3 text-white text-center">
              <p className="text-[10px] font-semibold opacity-80 mb-1">총 결제금액</p>
              <p className="text-base font-black leading-tight">{fmtW(totalPaid + gymMemTotal)}</p>
              <p className="text-[10px] opacity-60 mt-1">PT + 회원권</p>
            </div>
            <div className="bg-emerald-500 rounded-2xl p-3 text-white text-center">
              <p className="text-[10px] font-semibold opacity-80 mb-1">PT 소진금액</p>
              <p className="text-base font-black leading-tight">{fmtW(ptActualRevenue)}</p>
              <p className="text-[10px] opacity-60 mt-1">{ptRevenueSource.replace(" 기준","").replace(" 추정","")}</p>
            </div>
            <div className="bg-violet-500 rounded-2xl p-3 text-white text-center">
              <p className="text-[10px] font-semibold opacity-80 mb-1">회원권 소진</p>
              <p className="text-base font-black leading-tight">{fmtW(gymConsumed)}</p>
              <p className="text-[10px] opacity-60 mt-1">일할 계산</p>
            </div>
          </div>

          {/* 합산 실소진매출 강조 */}
          <div className="bg-zinc-100 rounded-2xl px-4 py-3 flex justify-between items-center">
            <span className="text-sm font-bold text-zinc-600">합산 실소진매출</span>
            <span className="text-xl font-black text-zinc-900">{fmtW(actualRevenue)}</span>
          </div>

          {/* 상세 내역 */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 divide-y divide-zinc-50">
            <Row label="PT 총 결제 (누적)" value={fmtW(totalPaid)} />
            <Row label="PT 잔여 미소진" value={`${totalSessions - conductedTotal}회`}
              sub={fmtW(totalPaid * (1 - allTimeRatio))} />
            <Row label="완료 수업" value={`${doneSessions}회`} />
            {gymMemTotal > 0 && (
              <>
                <Row label="회원권 총 결제 (누적)" value={fmtW(gymMemTotal)} sub={`유효 ${activeGymMems}건`} />
                <Row label="미소진 부채 (선수금)" value={fmtW(gymDeferred)} />
              </>
            )}
            {costs.isVat && <Row label="부가세 (10%)" value={`− ${fmtW(vat)}`} />}
          </div>
        </section>

        {/* 인건비 */}
        <section className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">💰 인건비</p>
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">인건비 합계</span>
              <div className="text-right">
                <span className="font-bold text-zinc-900">{fmtW(effectiveSalaryCost)}</span>
                <p className="text-xs text-zinc-400">{salarySource}</p>
              </div>
            </div>
            {!hasSettlement && effectiveSalaryCost === 0 && (
              <p className="text-xs text-zinc-400 text-center py-1">급여 정산 완료 또는 비용 관리 입력 시 자동 반영</p>
            )}
            {laborGrade && (
              <div className={`rounded-xl px-3 py-2 flex justify-between items-center text-sm font-semibold ${
                laborGrade.color === "emerald" ? "bg-emerald-50 text-emerald-700" :
                laborGrade.color === "yellow"  ? "bg-yellow-50 text-yellow-700"  : "bg-red-50 text-red-700"
              }`}>
                <span>{laborGrade.icon} {laborGrade.label} — {laborGrade.desc}</span>
                <span className="text-lg font-black">{laborRatio.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </section>

        {/* 기타 비용 */}
        {(otherFixed + totalVariable > 0) && (
          <section className="space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">📋 기타 비용</p>
            <div className="bg-white rounded-2xl border border-zinc-100 p-4 divide-y divide-zinc-50">
              {costs.rent > 0          && <Row label="임대료"        value={fmtW(costs.rent)} />}
              {(costs.managementFee ?? 0) > 0 && <Row label="관리비" value={fmtW(costs.managementFee ?? 0)} />}
              {costs.utilities > 0     && <Row label="공과금"        value={fmtW(costs.utilities)} />}
              {costs.communication > 0 && <Row label="통신비"        value={fmtW(costs.communication)} />}
              {costs.depreciation > 0  && <Row label="감가상각"      value={fmtW(costs.depreciation)} />}
              {costs.otherFixed > 0    && <Row label="기타 고정비"   value={fmtW(costs.otherFixed)} />}
              {costs.supplies > 0      && <Row label="소모품비"      value={fmtW(costs.supplies)} />}
              {costs.marketing > 0     && <Row label="마케팅/광고비" value={fmtW(costs.marketing)} />}
              {(costs.parkingFee ?? 0) > 0 && <Row label="주차비"   value={fmtW(costs.parkingFee ?? 0)} />}
              {paymentFee > 0          && <Row label="결제 수수료"   value={fmtW(paymentFee)} />}
              {costs.otherVariable > 0 && <Row label="기타 변동비"   value={fmtW(costs.otherVariable)} />}
            </div>
          </section>
        )}

        {/* 순이익 카드 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>PT 실소진매출</span><span>{fmtW(ptActualRevenue)}</span>
            </div>
            {gymConsumed > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>헬스 회원권 소진매출</span><span>{fmtW(gymConsumed)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-200 font-semibold border-t border-zinc-700 pt-2">
              <span>합산 실소진매출</span><span>{fmtW(actualRevenue)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>인건비</span><span>− {fmtW(effectiveSalaryCost)}</span>
            </div>
            {otherFixed > 0 && <div className="flex justify-between text-zinc-400"><span>기타 고정비</span><span>− {fmtW(otherFixed)}</span></div>}
            {totalVariable > 0 && <div className="flex justify-between text-zinc-400"><span>변동비</span><span>− {fmtW(totalVariable)}</span></div>}
            {vat > 0 && <div className="flex justify-between text-zinc-400"><span>부가세</span><span>− {fmtW(vat)}</span></div>}
            {gymDeferred > 0 && (
              <div className="flex justify-between text-amber-400 text-xs border-t border-zinc-700 pt-2">
                <span>미소진 부채 (선수금)</span><span>{fmtW(gymDeferred)}</span>
              </div>
            )}
          </div>
          <div className="border-t border-zinc-700 pt-3">
            <p className="text-sm text-zinc-400 mb-1">예상 순이익</p>
            <p className={`text-4xl font-black ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {fmtW(netProfit)}
            </p>
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "PT 회원",    value: `${totalMembers}명`,       ok: totalMembers > 0 },
            { label: "트레이너",   value: `${branchTrainerCount}명`, ok: branchTrainerCount > 0 },
            { label: "완료수업",   value: `${doneSessions}회`,       ok: doneSessions > 0 },
            { label: "일반회원권", value: `${activeGymMems}건`,      ok: activeGymMems > 0 },
          ].map(({ label, value, ok }) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${ok ? "bg-white border-zinc-100" : "bg-zinc-50 border-zinc-100"}`}>
              <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
              <p className={`text-base font-black ${ok ? "text-zinc-900" : "text-zinc-300"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 계산기로 보내기 */}
        <button onClick={handleSendToCalc} disabled={sent}
          className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 transition text-base">
          {sent ? "✓ 계산기로 이동 중..." : "📊 계산기로 보내서 상세 확인"}
        </button>

      </div>
    </div>
  );
}
