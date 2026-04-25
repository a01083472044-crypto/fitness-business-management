"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMembers, getCosts, getSchedules, getTrainers, getBranches,
  emptyCosts, currentMonth,
  Member, ScheduleEntry, MonthlyCosts, Trainer,
} from "../lib/store";

const INS_RATE = 0.1065;

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function fmtShort(n: number): string {
  if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1) + "억";
  if (Math.abs(n) >= 10000000)  return (n / 10000000).toFixed(0) + "천만";
  if (Math.abs(n) >= 10000)     return (n / 10000).toFixed(0) + "만";
  return Math.round(n).toLocaleString();
}

function getLast6Months(): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

function monthLabel(m: string): string {
  const [, mo] = m.split("-");
  return `${Number(mo)}월`;
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

function calcTotalCost(costs: MonthlyCosts): number {
  const fixed =
    costs.rent + (costs.managementFee ?? 0) +
    costs.trainerSalary + costs.trainerSalary * INS_RATE +
    costs.freelanceSalary + costs.freelanceSalary * 0.033 +
    costs.utilities + costs.communication +
    costs.depreciation + costs.otherFixed;
  const variable =
    costs.supplies + costs.marketing +
    (costs.parkingFee ?? 0) + (costs.paymentFee ?? 0) + costs.otherVariable;
  return fixed + variable;
}

function calcTrainerProfit(trainer: Trainer, schedules: ScheduleEntry[], members: Member[], month: string) {
  const done = schedules.filter(
    (s) => s.trainerId === trainer.id && s.date.startsWith(month) && s.done
  );
  let ptRevenue = 0;
  for (const s of done) {
    if (s.packageId) {
      for (const m of members) {
        const pkg = m.packages?.find((p) => p.id === s.packageId);
        if (pkg && pkg.totalSessions > 0) { ptRevenue += pkg.paymentAmount / pkg.totalSessions; break; }
      }
    }
  }
  const st = trainer.salaryType ?? "base+rate";
  const base = trainer.baseSalary ?? 0;
  const rate = trainer.commRate ?? 50;
  const fee = trainer.sessionFee ?? 0;
  let gross = 0;
  if (st === "base+rate") gross = base + ptRevenue * (rate / 100);
  else if (st === "rate") gross = ptRevenue * (rate / 100);
  else gross = base + done.length * fee;
  const isFreelancer = trainer.empType === "프리랜서";
  const companyCost = isFreelancer ? gross : gross * (1 + INS_RATE);
  return { ptRevenue, companyCost, netContribution: ptRevenue - companyCost };
}

export default function ReportPage() {
  const months = useMemo(() => getLast6Months(), []);
  const [members, setMembers]   = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [allCosts, setAllCosts] = useState<MonthlyCosts[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [focusMonth, setFocusMonth] = useState(currentMonth());

  useEffect(() => {
    const tr = getTrainers();
    setTrainers(tr);
    setMembers(getMembers());
    setSchedules(getSchedules());
    setAllCosts(getCosts());
    const saved = getBranches();
    const trBranches = tr.map((t) => t.branch).filter(Boolean);
    setBranches(Array.from(new Set([...saved, ...trBranches])));
  }, []);

  // 월별 데이터 집계
  const monthlyData = useMemo(() => {
    return months.map((m) => {
      const { revenue, sessions } = calcMonthRevenue(schedules, members, m);
      const branchKey = selectedBranch;
      const costsRecord =
        allCosts.find((c) => c.month === m && (c.branch ?? "") === branchKey) ??
        allCosts.find((c) => c.month === m && (c.branch ?? "") === "") ??
        emptyCosts(m);
      const totalCost = calcTotalCost(costsRecord);
      const profit = revenue - totalCost;
      const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;

      // 트레이너별 기여도
      const trainerResults = trainers
        .filter((t) => t.status === "재직" && (!selectedBranch || t.branch === selectedBranch))
        .map((t) => ({ trainer: t, ...calcTrainerProfit(t, schedules, members, m) }));

      // 신규 회원 수
      const newMembers = members.filter((mem) =>
        (mem.packages ?? []).some((p) => p.registeredAt?.startsWith(m))
      ).length;

      return { month: m, revenue, sessions, totalCost, profit, profitRate, trainerResults, newMembers, costsRecord };
    });
  }, [months, schedules, members, allCosts, trainers, selectedBranch]);

  // 차트용 최대값
  const maxRevenue = useMemo(() => Math.max(...monthlyData.map((d) => d.revenue), 1), [monthlyData]);

  // 포커스 월 데이터
  const focus = useMemo(() =>
    monthlyData.find((d) => d.month === focusMonth) ?? monthlyData[monthlyData.length - 1],
    [monthlyData, focusMonth]
  );

  // 전월 비교
  const focusIdx = months.indexOf(focusMonth);
  const prevData = focusIdx > 0 ? monthlyData[focusIdx - 1] : null;

  function diff(curr: number, prev: number | undefined) {
    if (!prev || prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { pct, up: pct >= 0 };
  }

  const revDiff    = diff(focus?.revenue ?? 0, prevData?.revenue);
  const costDiff   = diff(focus?.totalCost ?? 0, prevData?.totalCost);
  const profitDiff = diff(focus?.profit ?? 0, prevData?.profit);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">월별 경영 리포트</h1>
          <p className="text-sm text-zinc-500 mt-0.5">6개월 매출 · 비용 · 순이익 추이</p>
        </div>

        {/* 지점 탭 */}
        {branches.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ label: "전체", value: "" }, ...branches.map((b) => ({ label: b, value: b }))].map(({ label, value }) => (
              <button key={value} onClick={() => setSelectedBranch(value)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  selectedBranch === value ? "bg-blue-600 text-white" : "bg-white border border-zinc-200 text-zinc-500"
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 6개월 바 차트 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5">
          <p className="text-xs font-bold text-zinc-400 mb-4">6개월 매출 추이</p>
          <div className="flex items-end gap-2 h-32">
            {monthlyData.map((d) => {
              const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
              const isSelected = d.month === focusMonth;
              return (
                <button key={d.month} onClick={() => setFocusMonth(d.month)}
                  className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        isSelected ? "bg-blue-600" : "bg-blue-200 group-hover:bg-blue-300"
                      }`}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <p className={`text-xs font-semibold ${isSelected ? "text-blue-600" : "text-zinc-400"}`}>
                    {monthLabel(d.month)}
                  </p>
                  {d.revenue > 0 && (
                    <p className={`text-xs ${isSelected ? "text-blue-600 font-bold" : "text-zinc-400"}`}>
                      {fmtShort(d.revenue)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 포커스 월 상세 */}
        {focus && (
          <>
            <div className="flex items-center gap-2">
              <p className="text-base font-black text-zinc-900">
                {monthLabel(focus.month)} 상세
              </p>
              <span className="text-xs text-zinc-400">탭으로 월 선택</span>
            </div>

            {/* KPI 카드 3개 */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "매출", value: focus.revenue, d: revDiff, color: "text-blue-700", bg: "bg-blue-50" },
                { label: "비용", value: focus.totalCost, d: costDiff, color: "text-red-700", bg: "bg-red-50" },
                { label: "순이익", value: focus.profit, d: profitDiff, color: focus.profit >= 0 ? "text-emerald-700" : "text-red-700", bg: focus.profit >= 0 ? "bg-emerald-50" : "bg-red-50" },
              ].map(({ label, value, d, color, bg }) => (
                <div key={label} className={`${bg} rounded-2xl p-3 text-center space-y-0.5`}>
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className={`text-sm font-black ${color}`}>{fmtShort(value)}</p>
                  {d && (
                    <p className={`text-xs font-semibold ${d.up ? "text-emerald-600" : "text-red-600"}`}>
                      {d.up ? "▲" : "▼"} {Math.abs(d.pct).toFixed(1)}%
                    </p>
                  )}
                  {!d && <p className="text-xs text-zinc-300">전월 없음</p>}
                </div>
              ))}
            </div>

            {/* 손익 상세 */}
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
              <p className="text-xs font-bold text-zinc-400">손익 상세</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-700">
                  <span>총 매출</span>
                  <span className="font-bold text-blue-700">{fmtW(focus.revenue)}</span>
                </div>
                <div className="text-xs text-zinc-400 pl-2 space-y-1">
                  <div className="flex justify-between">
                    <span>완료 수업 수</span><span>{focus.sessions}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span>신규 등록 회원</span><span>{focus.newMembers}명</span>
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-2 flex justify-between text-zinc-700">
                  <span>고정비</span>
                  <span className="font-semibold text-red-600">
                    {fmtW(
                      focus.costsRecord.rent + (focus.costsRecord.managementFee ?? 0) +
                      focus.costsRecord.trainerSalary * (1 + INS_RATE) +
                      focus.costsRecord.freelanceSalary * 1.033 +
                      focus.costsRecord.utilities + focus.costsRecord.communication +
                      focus.costsRecord.depreciation + focus.costsRecord.otherFixed
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-700">
                  <span>변동비</span>
                  <span className="font-semibold text-red-600">
                    {fmtW(
                      focus.costsRecord.supplies + focus.costsRecord.marketing +
                      (focus.costsRecord.parkingFee ?? 0) + (focus.costsRecord.paymentFee ?? 0) +
                      focus.costsRecord.otherVariable
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-zinc-700">
                  <span>총 비용</span>
                  <span className="text-red-600">{fmtW(focus.totalCost)}</span>
                </div>
                <div className="flex justify-between font-black text-base border-t border-zinc-100 pt-2">
                  <span>순이익</span>
                  <span className={focus.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {focus.profit >= 0 ? "+" : ""}{fmtW(focus.profit)}
                  </span>
                </div>
                {focus.revenue > 0 && (
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>순이익률</span>
                    <span className={`font-semibold ${focus.profitRate >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {focus.profitRate.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 트레이너별 기여도 요약 */}
            {focus.trainerResults.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
                <p className="text-xs font-bold text-zinc-400">트레이너별 순기여이익</p>
                <div className="space-y-2">
                  {focus.trainerResults
                    .filter((r) => r.ptRevenue > 0)
                    .sort((a, b) => b.netContribution - a.netContribution)
                    .map((r) => (
                      <div key={r.trainer.id} className="flex items-center gap-3">
                        <p className="text-sm text-zinc-700 w-16 truncate">{r.trainer.name}</p>
                        <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${r.netContribution >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                            style={{
                              width: `${Math.min(
                                Math.abs(r.netContribution) / Math.max(...focus.trainerResults.map((x) => Math.abs(x.netContribution)), 1) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <p className={`text-sm font-bold w-20 text-right ${r.netContribution >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {r.netContribution >= 0 ? "+" : ""}{fmtShort(r.netContribution)}
                        </p>
                      </div>
                    ))}
                  {focus.trainerResults.every((r) => r.ptRevenue === 0) && (
                    <p className="text-xs text-zinc-400 text-center py-2">완료된 수업 데이터가 없습니다</p>
                  )}
                </div>
              </div>
            )}

            {/* 6개월 요약 테이블 */}
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
              <p className="text-xs font-bold text-zinc-400">6개월 요약</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-400">
                      <th className="text-left pb-2 font-semibold">월</th>
                      <th className="text-right pb-2 font-semibold">매출</th>
                      <th className="text-right pb-2 font-semibold">비용</th>
                      <th className="text-right pb-2 font-semibold">순이익</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {monthlyData.map((d) => (
                      <tr key={d.month}
                        onClick={() => setFocusMonth(d.month)}
                        className={`cursor-pointer ${d.month === focusMonth ? "bg-blue-50" : "hover:bg-zinc-50"}`}>
                        <td className={`py-2 font-semibold ${d.month === focusMonth ? "text-blue-600" : "text-zinc-600"}`}>
                          {monthLabel(d.month)}
                        </td>
                        <td className="py-2 text-right text-blue-700 font-semibold">
                          {d.revenue > 0 ? fmtShort(d.revenue) : "—"}
                        </td>
                        <td className="py-2 text-right text-red-600">
                          {d.totalCost > 0 ? fmtShort(d.totalCost) : "—"}
                        </td>
                        <td className={`py-2 text-right font-bold ${
                          d.profit > 0 ? "text-emerald-600" : d.profit < 0 ? "text-red-600" : "text-zinc-400"
                        }`}>
                          {d.revenue > 0 || d.totalCost > 0
                            ? (d.profit >= 0 ? "+" : "") + fmtShort(d.profit)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 안내 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-1.5 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-500">📌 계산 기준</p>
          <p>· 매출: 완료 수업 기준 패키지 회당 단가 합산</p>
          <p>· 비용: 비용관리 페이지 입력값 (4대보험·원천징수 포함)</p>
          <p>· 트레이너 기여도: 발생 매출 − 사업자 실부담</p>
        </div>
      </div>
    </div>
  );
}
