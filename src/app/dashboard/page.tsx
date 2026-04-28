"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMembers, getCosts, getSchedules, getSettlements, getTrainers, getBranches,
  getReceivables,
  emptyCosts, currentMonth, setPrefill,
  MonthlyCosts, ScheduleEntry, Member, TrainerSettlement,
} from "../lib/store";

const INS_RATE = 0.1065;

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function calcMonthRevenue(schedules: ScheduleEntry[], members: Member[], month: string) {
  let revenue = 0;
  let sessions = 0;
  for (const s of schedules) {
    if (!s.date.startsWith(month) || !s.done) continue;
    sessions++;
    if (s.packageId) {
      for (const m of members) {
        const pkg = m.packages?.find((p) => p.id === s.packageId);
        if (pkg && pkg.totalSessions > 0) {
          revenue += pkg.paymentAmount / pkg.totalSessions;
          break;
        }
      }
    }
  }
  return { revenue, sessions };
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

export default function DashboardPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [costs, setCosts] = useState<MonthlyCosts>(emptyCosts(currentMonth()));
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settlements, setSettlements] = useState<TrainerSettlement[]>([]);
  const [trainerCount, setTrainerCount] = useState(0);
  const [sent, setSent] = useState(false);
  const [todayData, setTodayData] = useState({ income: 0, sessions: 0, unpaidCount: 0, unpaidTotal: 0 });
  const [savedBranches, setSavedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("전체");
  const [allTrainers, setAllTrainers] = useState<ReturnType<typeof getTrainers>>([]);

  useEffect(() => {
    const trainers = getTrainers();
    setAllTrainers(trainers);
    const allSchedules = getSchedules();
    const allMembers   = getMembers();
    setSchedules(allSchedules);
    setMembers(allMembers);
    setSettlements(getSettlements());
    setTrainerCount(trainers.filter((t) => t.status === "재직").length);
    setSavedBranches(getBranches());
    // 오늘 자금 현황
    const today = new Date();
    const td = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const todayIncome = allMembers.flatMap((m) => m.packages ?? [])
      .filter((p) => p.registeredAt === td)
      .reduce((s, p) => s + p.paymentAmount, 0);
    const todaySessions = allSchedules.filter((s) => s.date === td && s.done).length;
    const rcvs = getReceivables();
    const unpaidR = rcvs.filter((r) => !r.paid);
    setTodayData({
      income: todayIncome,
      sessions: todaySessions,
      unpaidCount: unpaidR.length,
      unpaidTotal: unpaidR.reduce((s, r) => s + r.amount, 0),
    });
  }, []);

  useEffect(() => {
    const all = getCosts();
    const branchKey = selectedBranch === "전체" ? "" : selectedBranch;
    // 지점별 비용 우선 조회, 없으면 전체(공통) 비용 사용
    const branchCosts = all.find((c) => c.month === month && (c.branch ?? "") === branchKey);
    const globalCosts = all.find((c) => c.month === month && (c.branch ?? "") === "");
    setCosts(branchCosts ?? globalCosts ?? emptyCosts(month));
    setSent(false);
  }, [month, selectedBranch]);

  // ── 지점 필터 ─────────────────────────────────────────────────────────────
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
      // member.trainer(현재 배정) 우선 → 없으면 패키지 trainerName으로 폴백
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

  // ── 이번달 스케줄 기준 매출 ──────────────────────────────────────────────
  const { revenue: scheduleRevenue, sessions: doneSessions } = useMemo(
    () => calcMonthRevenue(branchSchedules, branchMembers, month),
    [branchSchedules, branchMembers, month]
  );

  // ── 회원 누적 집계 ────────────────────────────────────────────────────────
  const totalMembers   = branchMembers.length;
  const totalPaid      = branchMembers.reduce((s, m) => s + m.totalPayment, 0);
  const totalSessions  = branchMembers.reduce((s, m) => s + m.totalSessions, 0);
  const conductedTotal = branchMembers.reduce((s, m) => s + m.conductedSessions, 0);
  const allTimeRatio   = totalSessions > 0 ? conductedTotal / totalSessions : 0;

  // 실소진매출: 스케줄 기준 우선, 없으면 누적 비율 추정
  const actualRevenue = scheduleRevenue > 0 ? scheduleRevenue : totalPaid * allTimeRatio;
  const revenueSource = scheduleRevenue > 0 ? "스케줄 완료 기준" : "누적 소진률 추정";

  // ── 급여 정산 데이터 ─────────────────────────────────────────────────────
  const monthSettlements = useMemo(
    () => {
      const allSettled = settlements.filter((s) => s.month === month && s.settled);
      if (selectedBranch === "전체") return allSettled;
      return allSettled.filter((s) => trainerBranchMap[s.trainerName] === selectedBranch);
    },
    [settlements, month, selectedBranch, trainerBranchMap]
  );
  const settledCount      = monthSettlements.length;
  const hasSettlement     = settledCount > 0;
  const settledSalaryCost = monthSettlements.reduce((s, r) => s + r.companyCost, 0);

  // ── 비용 계산 ─────────────────────────────────────────────────────────────
  // 급여: 정산 완료분 우선, 없으면 비용관리 수동입력
  const manualSalaryCost    = costs.trainerSalary * (1 + INS_RATE) + costs.freelanceSalary;
  const effectiveSalaryCost = hasSettlement ? settledSalaryCost : manualSalaryCost;
  const salarySource        = hasSettlement ? `급여 정산 (${settledCount}명 완료)` : "비용 관리 수동 입력";

  const vat           = costs.isVat ? actualRevenue * 0.1 : 0;
  const otherFixed    = costs.rent + (costs.managementFee ?? 0) + costs.utilities + costs.communication + costs.depreciation + costs.otherFixed;
  const paymentFee    = costs.paymentFee ?? 0;
  const totalVariable = costs.supplies + costs.marketing + (costs.parkingFee ?? 0) + paymentFee + costs.otherVariable;
  const netProfit     = actualRevenue - vat - effectiveSalaryCost - otherFixed - totalVariable;

  // ── 인건비 진단 ───────────────────────────────────────────────────────────
  const laborRatio = actualRevenue > 0 ? (effectiveSalaryCost / actualRevenue) * 100 : 0;
  const laborGrade =
    laborRatio === 0 ? null :
    laborRatio < 30  ? { label: "안전", color: "emerald", icon: "✅", desc: "인건비 비율 적정" } :
    laborRatio < 40  ? { label: "주의", color: "yellow",  icon: "⚠️", desc: "권장 범위 상단 근접" } :
                       { label: "위험", color: "red",     icon: "🔴", desc: "40% 초과 — 즉각 검토 필요" };

  const handleSendToCalc = () => {
    const fullGross = hasSettlement
      ? monthSettlements.filter((s) => s.empType === "정규직").reduce((sum, s) => sum + s.grossSalary, 0)
      : costs.trainerSalary;
    const freeGross = hasSettlement
      ? monthSettlements.filter((s) => s.empType === "프리랜서").reduce((sum, s) => sum + s.grossSalary, 0)
      : costs.freelanceSalary;

    // ── 이번달 신규 등록 패키지만 필터 (계산기는 월별 데이터를 기대) ──────────
    const monthPkgs = branchMembers.flatMap((m) =>
      (m.packages ?? []).filter((p) => (p.registeredAt ?? "").startsWith(month))
    );
    const monthPayment  = monthPkgs.reduce((s, p) => s + p.paymentAmount, 0);
    const monthSessions = monthPkgs.reduce((s, p) => s + p.totalSessions, 0);
    // 이번달 완료 수업(스케줄 기반) 사용. 신규 등록이 없으면 전체 누적으로 폴백
    const sendPayment    = monthPayment  > 0 ? monthPayment    : totalPaid;
    const sendSessions   = monthSessions > 0 ? monthSessions   : Math.max(totalSessions, 1);
    const sendConducted  = monthPayment  > 0 ? Math.min(doneSessions, monthSessions) : conductedTotal;

    setPrefill({
      totalPayment:      sendPayment,
      totalSessions:     sendSessions,
      conductedSessions: sendConducted,
      rent:              costs.rent,
      managementFee:     costs.managementFee,
      trainerSalary:     fullGross,
      freelanceSalary:   freeGross,
      utilities:         costs.utilities,
      communication:     costs.communication,
      depreciation:      costs.depreciation,
      otherFixed:        costs.otherFixed,
      supplies:          costs.supplies,
      marketing:         costs.marketing,
      parkingFee:        costs.parkingFee,
      paymentFee:        paymentFee,
      otherVariable:     costs.otherVariable,
      isVat:             costs.isVat,
    });
    setSent(true);
    setTimeout(() => router.push("/"), 600);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">대시보드</h1>
            <p className="text-sm text-zinc-500 mt-0.5">월별 경영 현황 자동 집계</p>
          </div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500" />
        </div>

        {/* 오늘의 자금 현황 */}
        <Link href="/cashflow"
          className="grid grid-cols-3 gap-2 bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-4 hover:opacity-90 transition">
          <div className="text-center">
            <p className="text-xs text-zinc-400 mb-1">오늘 신규 등록</p>
            <p className="text-lg font-black text-emerald-400">{fmtW(todayData.income)}</p>
          </div>
          <div className="text-center border-x border-zinc-700">
            <p className="text-xs text-zinc-400 mb-1">완료 수업</p>
            <p className="text-lg font-black text-blue-300">{todayData.sessions}회</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-400 mb-1">미수금</p>
            <p className={`text-lg font-black ${todayData.unpaidCount > 0 ? "text-orange-400" : "text-zinc-500"}`}>
              {todayData.unpaidCount > 0 ? `${todayData.unpaidCount}건` : "없음"}
            </p>
          </div>
          <p className="col-span-3 text-center text-xs text-zinc-600 mt-1">📅 자금일보 보기 →</p>
        </Link>

        {/* 지점 탭 */}
        {branches.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["전체", ...branches].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  selectedBranch === b
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-zinc-200 text-zinc-500"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* 연동 현황 요약 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "회원",     value: `${totalMembers}명`,  ok: totalMembers > 0 },
            { label: "트레이너", value: `${branchTrainerCount}명`,  ok: branchTrainerCount > 0 },
            { label: "완료수업", value: `${doneSessions}회`,  ok: doneSessions > 0 },
            { label: "급여정산", value: `${settledCount}명`,  ok: hasSettlement },
          ].map(({ label, value, ok }) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${ok ? "bg-white border-zinc-100" : "bg-zinc-50 border-zinc-100"}`}>
              <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
              <p className={`text-base font-black ${ok ? "text-zinc-900" : "text-zinc-300"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 이번달 매출 */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">📊 이번달 매출</p>
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 divide-y divide-zinc-50">
            <Row label="실소진매출" value={fmtW(actualRevenue)} sub={revenueSource} plus />
            <Row label="완료 수업" value={`${doneSessions}회`} />
            <Row label="총 결제금액 (누적)" value={fmtW(totalPaid)} />
            <Row
              label="잔여 수업 (미소진 부채)"
              value={`${totalSessions - conductedTotal}회`}
              sub={fmtW(totalPaid * (1 - allTimeRatio))}
            />
            {costs.isVat && <Row label="부가세 (10%)" value={`− ${fmtW(vat)}`} />}
          </div>
        </section>

        {/* 인건비 */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">💰 인건비</p>
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">인건비 합계</span>
              <div className="text-right">
                <span className="font-bold text-zinc-900">{fmtW(effectiveSalaryCost)}</span>
                <p className="text-xs text-zinc-400">{salarySource}</p>
              </div>
            </div>

            {hasSettlement && (
              <div className="divide-y divide-zinc-50">
                {monthSettlements.filter((s) => s.empType === "정규직").length > 0 && (
                  <Row
                    label={`정규직 ${monthSettlements.filter((s) => s.empType === "정규직").length}명 (4대보험+산재 포함)`}
                    value={fmtW(monthSettlements.filter((s) => s.empType === "정규직").reduce((sum, s) => sum + s.companyCost, 0))}
                  />
                )}
                {monthSettlements.filter((s) => s.empType === "프리랜서").length > 0 && (
                  <Row
                    label={`프리랜서 ${monthSettlements.filter((s) => s.empType === "프리랜서").length}명 (세전 기준)`}
                    value={fmtW(monthSettlements.filter((s) => s.empType === "프리랜서").reduce((sum, s) => sum + s.companyCost, 0))}
                  />
                )}
              </div>
            )}

            {!hasSettlement && (costs.trainerSalary > 0 || costs.freelanceSalary > 0) && (
              <div className="divide-y divide-zinc-50">
                {costs.trainerSalary > 0 && (
                  <Row label="정규직 (4대보험+산재 10.65% 포함)" value={fmtW(costs.trainerSalary * (1 + INS_RATE))} />
                )}
                {costs.freelanceSalary > 0 && (
                  <Row label="프리랜서 (세전)" value={fmtW(costs.freelanceSalary)} />
                )}
              </div>
            )}

            {!hasSettlement && effectiveSalaryCost === 0 && (
              <p className="text-xs text-zinc-400 text-center py-1">급여 정산 완료 또는 비용 관리 입력 시 자동 반영</p>
            )}

            {laborGrade && (
              <div className={`rounded-xl px-3 py-2 flex justify-between items-center text-sm font-semibold mt-1 ${
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
        <section className="space-y-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">📋 기타 비용</p>
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 divide-y divide-zinc-50">
            {costs.rent > 0                       && <Row label="임대료"      value={fmtW(costs.rent)} />}
            {(costs.managementFee ?? 0) > 0       && <Row label="관리비"      value={fmtW(costs.managementFee ?? 0)} />}
            {costs.utilities > 0                  && <Row label="공과금"      value={fmtW(costs.utilities)} />}
            {costs.communication > 0              && <Row label="통신비"      value={fmtW(costs.communication)} />}
            {costs.depreciation > 0               && <Row label="감가상각"    value={fmtW(costs.depreciation)} />}
            {costs.otherFixed > 0                 && <Row label="기타 고정비" value={fmtW(costs.otherFixed)} />}
            {costs.supplies > 0                   && <Row label="소모품비"    value={fmtW(costs.supplies)} />}
            {costs.marketing > 0                  && <Row label="마케팅/광고비" value={fmtW(costs.marketing)} />}
            {(costs.parkingFee ?? 0) > 0          && <Row label="주차비"      value={fmtW(costs.parkingFee ?? 0)} />}
            {(costs.paymentFee ?? 0) > 0          && <Row label="결제 수수료" value={fmtW(costs.paymentFee ?? 0)} />}
            {costs.otherVariable > 0              && <Row label="기타 변동비" value={fmtW(costs.otherVariable)} />}
            {otherFixed + totalVariable === 0 && (
              <p className="text-xs text-zinc-400 text-center py-2">비용 관리에서 입력하면 자동 반영됩니다</p>
            )}
          </div>
        </section>

        {/* 순이익 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-zinc-300">
              <span>실소진매출</span><span className="font-semibold">{fmtW(actualRevenue)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>인건비</span><span>− {fmtW(effectiveSalaryCost)}</span>
            </div>
            {otherFixed > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>기타 고정비</span><span>− {fmtW(otherFixed)}</span>
              </div>
            )}
            {totalVariable > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>변동비</span><span>− {fmtW(totalVariable)}</span>
              </div>
            )}
            {vat > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>부가세</span><span>− {fmtW(vat)}</span>
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

        {/* 자동 연동 현황 */}
        <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1.5">
          <p className="font-bold text-blue-800">🔗 자동 연동 현황</p>
          <p>✅ 회원 관리 → 수업 관리 (패키지 자동 생성)</p>
          <p>✅ 수업 스케줄 완료 → 수업 관리 (진행 회차 자동 업데이트)</p>
          <p>✅ 급여 정산 완료 → 비용 관리 (급여 자동 반영)</p>
          <p>✅ 비용 관리 → 손익분기점 (자동 계산)</p>
          <p>✅ 전체 데이터 → 대시보드 → 계산기 (자동 집계)</p>
        </div>

        {/* 계산기로 보내기 */}
        <button onClick={handleSendToCalc} disabled={sent}
          className="w-full rounded-xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 transition text-base">
          {sent ? "✓ 계산기로 이동 중..." : "📊 계산기로 보내서 상세 확인하기"}
        </button>
      </div>
    </div>
  );
}
