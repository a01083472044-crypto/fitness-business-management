"use client";

import { useState, useEffect, useMemo } from "react";
import { getTrainers, getSchedules, getMembers, getBranches, Trainer, ScheduleEntry, Member } from "../../lib/store";
import { useStaffTerm } from "../../context/StaffTermContext";

const INS_RATE = 0.1065;

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function getMonths(): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

function calcTrainerProfit(trainer: Trainer, schedules: ScheduleEntry[], members: Member[], month: string) {
  const done = schedules.filter(
    (s) => s.trainerId === trainer.id && s.date.startsWith(month) && s.done
  );
  const completedSessions = done.length;

  let ptRevenue = 0;
  for (const s of done) {
    if (s.packageId) {
      for (const m of members) {
        const pkg = m.packages?.find((p) => p.id === s.packageId);
        if (pkg && pkg.totalSessions > 0) {
          ptRevenue += pkg.paymentAmount / pkg.totalSessions;
          break;
        }
      }
    }
  }

  const st = trainer.salaryType ?? "base+rate";
  const base = trainer.baseSalary ?? 0;
  const rate = trainer.commRate ?? 50;
  const fee = trainer.sessionFee ?? 0;

  let baseSalaryUsed = 0;
  let incentive = 0;
  if (st === "base+rate") { baseSalaryUsed = base; incentive = ptRevenue * (rate / 100); }
  else if (st === "rate") { baseSalaryUsed = 0;    incentive = ptRevenue * (rate / 100); }
  else                   { baseSalaryUsed = base; incentive = completedSessions * fee; }

  const grossSalary = baseSalaryUsed + incentive;
  const isFreelancer = trainer.empType === "프리랜서";
  const companyCost = isFreelancer ? grossSalary : grossSalary * (1 + INS_RATE);
  const netContribution = ptRevenue - companyCost;
  const costRatio = ptRevenue > 0 ? (companyCost / ptRevenue) * 100 : 0;

  return { completedSessions, ptRevenue, grossSalary, companyCost, netContribution, costRatio, isFreelancer };
}

function grade(ratio: number, hasData: boolean) {
  if (!hasData) return { color: "text-zinc-400", bg: "bg-white", border: "border-zinc-100", bar: "bg-zinc-200", label: "수업 없음", icon: "—" };
  if (ratio < 30) return { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", bar: "bg-emerald-400", label: "우수", icon: "✅" };
  if (ratio < 50) return { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-100",    bar: "bg-blue-400",    label: "양호", icon: "✅" };
  if (ratio < 70) return { color: "text-yellow-700",  bg: "bg-yellow-50",  border: "border-yellow-100",  bar: "bg-yellow-400",  label: "주의", icon: "⚠️" };
  return            { color: "text-red-700",    bg: "bg-red-50",     border: "border-red-100",     bar: "bg-red-400",     label: "위험", icon: "🔴" };
}

export default function ProfitPage() {
  const { staffTerm } = useStaffTerm();
  const months = useMemo(() => getMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");

  useEffect(() => {
    const tr = getTrainers();
    setTrainers(tr);
    setSchedules(getSchedules());
    setMembers(getMembers());
    const saved = getBranches();
    const trBranches = tr.map((t) => t.branch).filter(Boolean);
    setBranches(Array.from(new Set([...saved, ...trBranches])));
  }, []);

  const filtered = useMemo(() =>
    trainers.filter((t) => t.status === "재직" && (!selectedBranch || t.branch === selectedBranch)),
    [trainers, selectedBranch]
  );

  const results = useMemo(() =>
    filtered
      .map((t) => ({ trainer: t, ...calcTrainerProfit(t, schedules, members, month) }))
      .sort((a, b) => b.netContribution - a.netContribution),
    [filtered, schedules, members, month]
  );

  const totals = useMemo(() => ({
    revenue: results.reduce((s, r) => s + r.ptRevenue, 0),
    cost:    results.reduce((s, r) => s + r.companyCost, 0),
    net:     results.reduce((s, r) => s + r.netContribution, 0),
  }), [results]);

  const [y, mo] = month.split("-");
  const monthLabel = `${y}년 ${Number(mo)}월`;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">{staffTerm} 수익 기여도</h1>
            <p className="text-sm text-zinc-500 mt-0.5">매출 · 인건비 · 순기여이익 분석</p>
          </div>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500">
            {months.map((m) => {
              const [y2, mo2] = m.split("-");
              return <option key={m} value={m}>{y2}년 {Number(mo2)}월</option>;
            })}
          </select>
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

        {/* 합계 요약 카드 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-3">
          <p className="text-xs text-zinc-400">{monthLabel} 전체 합계</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-zinc-400 mb-1">총 발생 매출</p>
              <p className="text-base font-black">{fmtW(totals.revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">총 인건비</p>
              <p className="text-base font-black text-red-400">{fmtW(totals.cost)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">순기여이익</p>
              <p className={`text-base font-black ${totals.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totals.net >= 0 ? "+" : ""}{fmtW(totals.net)}
              </p>
            </div>
          </div>
          {totals.revenue > 0 && (
            <div className="pt-2 border-t border-zinc-700">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>전체 인건비 비율</span>
                <span>{((totals.cost / totals.revenue) * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${
                    totals.cost / totals.revenue < 0.5 ? "bg-emerald-400" :
                    totals.cost / totals.revenue < 0.7 ? "bg-yellow-400" : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min((totals.cost / totals.revenue) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 트레이너 없음 */}
        {results.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
            재직 중인 {staffTerm}가 없습니다
          </div>
        )}

        {/* 트레이너별 카드 */}
        {results.map((r) => {
          const g = grade(r.costRatio, r.ptRevenue > 0);
          return (
            <div key={r.trainer.id} className={`rounded-2xl border p-5 space-y-4 ${g.bg} ${g.border}`}>
              {/* 트레이너 헤더 */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-zinc-900 text-base">{r.trainer.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      r.trainer.empType === "정규직"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>{r.trainer.empType}</span>
                    {r.trainer.branch && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                        {r.trainer.branch}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">완료 수업 {r.completedSessions}회</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${g.color}`}>{g.icon} {g.label}</p>
                  {r.ptRevenue > 0 && (
                    <p className={`text-xs mt-0.5 ${g.color}`}>인건비율 {r.costRatio.toFixed(1)}%</p>
                  )}
                </div>
              </div>

              {r.ptRevenue === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-3 bg-white/60 rounded-xl">
                  이번 달 완료된 수업 기록이 없습니다 (수업 스케줄에서 완료 처리 필요)
                </p>
              ) : (
                <>
                  {/* 인건비 비율 바 */}
                  <div className="space-y-1">
                    <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full transition-all ${g.bar}`}
                        style={{ width: `${Math.min(r.costRatio, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs opacity-50 text-zinc-700">
                      <span>0%</span><span>30%</span><span>50%</span><span>70%</span><span>100%</span>
                    </div>
                  </div>

                  {/* 수치 내역 */}
                  <div className="bg-white/60 rounded-xl p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-zinc-700">
                      <span>발생 매출</span>
                      <span className="font-bold">{fmtW(r.ptRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>세전 급여</span>
                      <span>{fmtW(r.grossSalary)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>사업자 실부담 ({r.isFreelancer ? "3.3%" : "4대보험+산재"})</span>
                      <span className="text-red-600 font-semibold">{fmtW(r.companyCost)}</span>
                    </div>
                    <div className={`flex justify-between font-black border-t border-white/60 pt-1.5 text-base ${
                      r.netContribution >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}>
                      <span>순기여이익</span>
                      <span>{r.netContribution >= 0 ? "+" : ""}{fmtW(r.netContribution)}</span>
                    </div>
                  </div>

                  {/* 경고 메시지 */}
                  {r.costRatio >= 70 && (
                    <div className="bg-red-100 rounded-xl p-3 text-xs text-red-700 font-semibold">
                      🔴 인건비가 매출의 70% 초과 — 급여 구조 또는 매출 증대 검토 필요
                    </div>
                  )}
                  {r.netContribution < 0 && (
                    <div className="bg-red-100 rounded-xl p-3 text-xs text-red-700 font-semibold">
                      ⚠️ 이 {staffTerm}의 인건비가 발생 매출을 초과합니다
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* 기준 안내 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-1.5 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-500">📌 계산 기준</p>
          <p>· 발생 매출: 완료된 수업 기준 패키지 회당 단가 합산</p>
          <p>· 정규직 실부담: 세전 급여 × 1.1065 (4대보험+산재)</p>
          <p>· 프리랜서 실부담: 세전 급여 × 1.0 (3.3% 원천징수 포함)</p>
          <p>· 권장 인건비 비율: 매출의 50% 이하</p>
        </div>
      </div>
    </div>
  );
}
