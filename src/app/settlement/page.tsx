"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getTrainers, getSchedules, getMembers, getSettlements, saveSettlements,
  getCosts, saveCosts, emptyCosts, getBranches,
  Trainer, TrainerSettlement, ScheduleEntry, Member,
} from "../lib/store";

const INS_RATE = 0.1065;

function fmtW(n: number) {
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

function getMonths(): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${y}년 ${Number(mo)}월`;
}

function calcDraft(
  trainer: Trainer,
  schedules: ScheduleEntry[],
  members: Member[],
  month: string
) {
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
  const withholdingTax = isFreelancer ? grossSalary * 0.033 : 0;
  const netSalary = isFreelancer ? grossSalary * 0.967 : grossSalary;
  const insuranceCost = isFreelancer ? 0 : grossSalary * INS_RATE;
  const companyCost = isFreelancer ? grossSalary : grossSalary * (1 + INS_RATE);

  return {
    completedSessions, ptRevenue,
    baseSalary: baseSalaryUsed, incentive, grossSalary,
    netSalary, withholdingTax, insuranceCost, companyCost,
  };
}

// 급여정산 완료 → 비용관리 자동 반영
function syncToCosts(month: string, allSettlements: TrainerSettlement[]) {
  const settled = allSettlements.filter((s) => s.month === month && s.settled);
  if (settled.length === 0) return;
  const fullGross = settled.filter((s) => s.empType === "정규직").reduce((sum, s) => sum + s.grossSalary, 0);
  const freeGross = settled.filter((s) => s.empType === "프리랜서").reduce((sum, s) => sum + s.grossSalary, 0);
  const allCosts = getCosts();
  const existing = allCosts.find((c) => c.month === month) ?? emptyCosts(month);
  const updated = { ...existing, trainerSalary: fullGross, freelanceSalary: freeGross };
  saveCosts([...allCosts.filter((c) => c.month !== month), updated]);
}

function salaryTypeLabel(t: Trainer) {
  if (t.salaryType === "rate") return `매출 ${t.commRate}% 배분`;
  if (t.salaryType === "base+rate") return `기본 ${fmtW(t.baseSalary)} + ${t.commRate}% 배분`;
  return `기본 ${fmtW(t.baseSalary)} + 회당 ${fmtW(t.sessionFee)}`;
}

export default function SettlementPage() {
  const months = useMemo(() => getMonths(), []);
  const [selMonth, setSelMonth] = useState(months[0]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settlements, setSettlements] = useState<TrainerSettlement[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [savedBranches, setSavedBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("전체");

  useEffect(() => {
    setTrainers(getTrainers());
    setSchedules(getSchedules());
    setMembers(getMembers());
    setSettlements(getSettlements());
    setSavedBranches(getBranches());
  }, []);

  // 지점 목록
  const branches = useMemo(() => {
    const fromTrainers = trainers.map((t) => t.branch).filter(Boolean);
    const merged = Array.from(new Set([...savedBranches, ...fromTrainers]));
    return ["전체", ...merged];
  }, [trainers, savedBranches]);

  const allActiveTrainers = trainers.filter((t) => t.status === "재직");

  // 지점 필터 적용
  const activeTrainers = selectedBranch === "전체"
    ? allActiveTrainers
    : allActiveTrainers.filter((t) => t.branch === selectedBranch);

  // settlements for selected month
  const monthSettlements = settlements.filter((s) => s.month === selMonth);
  const settledIds = new Set(monthSettlements.filter((s) => s.settled).map((s) => s.trainerId));

  function getSettled(trainerId: string) {
    return monthSettlements.find((s) => s.trainerId === trainerId && s.settled);
  }

  function settle(trainer: Trainer) {
    const draft = calcDraft(trainer, schedules, members, selMonth);
    const record: TrainerSettlement = {
      id: crypto.randomUUID(),
      month: selMonth,
      trainerId: trainer.id,
      trainerName: trainer.name,
      empType: trainer.empType,
      salaryType: trainer.salaryType ?? "base+rate",
      baseSalary: draft.baseSalary,
      commRate: trainer.commRate ?? 50,
      sessionFee: trainer.sessionFee ?? 0,
      completedSessions: draft.completedSessions,
      ptRevenue: draft.ptRevenue,
      incentive: draft.incentive,
      grossSalary: draft.grossSalary,
      netSalary: draft.netSalary,
      withholdingTax: draft.withholdingTax,
      insuranceCost: draft.insuranceCost,
      companyCost: draft.companyCost,
      settled: true,
      settledAt: new Date().toISOString().slice(0, 10),
      memo: memos[trainer.id] ?? "",
    };
    const next = [
      ...settlements.filter((s) => !(s.month === selMonth && s.trainerId === trainer.id)),
      record,
    ];
    setSettlements(next);
    saveSettlements(next);
    syncToCosts(selMonth, next);
  }

  function unsettle(trainerId: string) {
    const next = settlements.filter(
      (s) => !(s.month === selMonth && s.trainerId === trainerId)
    );
    setSettlements(next);
    saveSettlements(next);
  }

  function settleAll() {
    const unsettled = activeTrainers.filter((t) => !settledIds.has(t.id));
    let next = [...settlements];
    for (const trainer of unsettled) {
      const draft = calcDraft(trainer, schedules, members, selMonth);
      next = next.filter((s) => !(s.month === selMonth && s.trainerId === trainer.id));
      next.push({
        id: crypto.randomUUID(),
        month: selMonth,
        trainerId: trainer.id,
        trainerName: trainer.name,
        empType: trainer.empType,
        salaryType: trainer.salaryType ?? "base+rate",
        baseSalary: draft.baseSalary,
        commRate: trainer.commRate ?? 50,
        sessionFee: trainer.sessionFee ?? 0,
        completedSessions: draft.completedSessions,
        ptRevenue: draft.ptRevenue,
        incentive: draft.incentive,
        grossSalary: draft.grossSalary,
        netSalary: draft.netSalary,
        withholdingTax: draft.withholdingTax,
        insuranceCost: draft.insuranceCost,
        companyCost: draft.companyCost,
        settled: true,
        settledAt: new Date().toISOString().slice(0, 10),
        memo: memos[trainer.id] ?? "",
      });
    }
    setSettlements(next);
    saveSettlements(next);
    syncToCosts(selMonth, next);
  }

  const totalCompanyCost = activeTrainers.reduce((sum, t) => {
    const rec = getSettled(t.id);
    if (rec) return sum + rec.companyCost;
    const draft = calcDraft(t, schedules, members, selMonth);
    return sum + draft.companyCost;
  }, 0);

  const settledCount = settledIds.size;
  const totalCount = activeTrainers.length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">급여 정산</h1>
            <p className="text-sm text-zinc-500 mt-0.5">트레이너별 월간 급여 자동 계산 및 정산</p>
          </div>
          {settledCount < totalCount && totalCount > 0 && (
            <button onClick={settleAll}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition">
              전체 정산
            </button>
          )}
        </div>

        {/* 월 선택 탭 */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1">
            {months.map((m, i) => (
              <button key={m} onClick={() => setSelMonth(m)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                  selMonth === m
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                }`}>
                {i === 0 && <span className="mr-1 text-xs">🔵</span>}
                {m.split("-")[0]}년 {Number(m.split("-")[1])}월
              </button>
            ))}
          </div>
        </div>

        {/* 지점 탭 */}
        {branches.length > 1 && (
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
            {branches.map((branch) => {
              const count = branch === "전체"
                ? allActiveTrainers.length
                : allActiveTrainers.filter((t) => t.branch === branch).length;
              return (
                <button key={branch}
                  onClick={() => setSelectedBranch(branch)}
                  className={`flex-shrink-0 flex-1 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                    selectedBranch === branch
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}>
                  {branch}
                  <span className="ml-1 text-xs font-normal opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 정산 현황 */}
        {totalCount > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">정산 현황</p>
              <p className="text-lg font-black text-zinc-900">
                {settledCount}<span className="text-zinc-400 font-normal text-sm">/{totalCount}명</span>
                <span className="ml-2 text-sm font-semibold text-emerald-600">완료</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">이번달 총 인건비</p>
              <p className="text-lg font-black text-zinc-900">{fmtW(totalCompanyCost)}</p>
            </div>
          </div>
        )}

        {activeTrainers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
            {selectedBranch === "전체"
              ? "재직 중인 트레이너가 없습니다."
              : <><strong>{selectedBranch}</strong>에 재직 중인 트레이너가 없습니다.</>}
          </div>
        ) : (
          <div className="space-y-4">
            {activeTrainers.map((trainer) => {
              const rec = getSettled(trainer.id);
              const draft = calcDraft(trainer, schedules, members, selMonth);
              const data = rec ?? draft;
              const isFreelancer = trainer.empType === "프리랜서";
              const noSalarySet = !trainer.salaryType || (trainer.baseSalary === 0 && trainer.commRate === 0 && trainer.sessionFee === 0);

              return (
                <div key={trainer.id}
                  className={`bg-white rounded-2xl border p-5 space-y-4 ${
                    rec ? "border-emerald-200" : "border-zinc-100"
                  }`}>
                  {/* 트레이너 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white ${
                        isFreelancer ? "bg-emerald-500" : "bg-blue-500"
                      }`}>
                        {trainer.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-900">{trainer.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            isFreelancer ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                          }`}>{trainer.empType}</span>
                          {rec && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">✅ 정산완료</span>}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{salaryTypeLabel(trainer)}</p>
                      </div>
                    </div>
                    {rec && (
                      <button onClick={() => unsettle(trainer.id)}
                        className="text-xs text-zinc-400 hover:text-red-500 transition">
                        취소
                      </button>
                    )}
                  </div>

                  {noSalarySet && !rec && (
                    <div className="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                      ⚠️ 급여 구조가 설정되지 않았습니다. 트레이너 관리에서 설정해 주세요.
                    </div>
                  )}

                  {/* 수업 실적 */}
                  <div className="bg-zinc-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-xs text-zinc-400">완료 수업</p>
                      <p className="text-xl font-black text-zinc-900">{data.completedSessions}<span className="text-xs font-normal ml-0.5">회</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">PT 매출</p>
                      <p className="text-base font-black text-zinc-900">{fmtW(Math.round(data.ptRevenue))}</p>
                    </div>
                  </div>

                  {/* 급여 내역 */}
                  <div className="space-y-2 text-sm">
                    {data.baseSalary > 0 && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">기본급</span>
                        <span className="font-semibold">{fmtW(data.baseSalary)}</span>
                      </div>
                    )}
                    {data.incentive > 0 && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">
                          {trainer.salaryType === "base+fixed"
                            ? `고정수업료 (${data.completedSessions}회 × ${fmtW(trainer.sessionFee)})`
                            : `인센티브 (${trainer.commRate}% 배분)`}
                        </span>
                        <span className="font-semibold text-blue-600">{fmtW(Math.round(data.incentive))}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-zinc-100 pt-2 font-bold">
                      <span className="text-zinc-700">세전 합계</span>
                      <span>{fmtW(Math.round(data.grossSalary))}</span>
                    </div>
                  </div>

                  {/* 세금/보험 */}
                  <div className="bg-zinc-900 rounded-xl p-4 text-white space-y-2">
                    {isFreelancer ? (
                      <>
                        <div className="flex justify-between text-sm text-zinc-300">
                          <span>원천징수 (3.3% 차감)</span>
                          <span>− {fmtW(Math.round(data.withholdingTax))}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-emerald-400">
                          <span>실수령액</span>
                          <span>{fmtW(Math.round(data.netSalary))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-400 border-t border-zinc-700 pt-2">
                          <span>사업자 국세청 납부 (원천세)</span>
                          <span>{fmtW(Math.round(data.withholdingTax))}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm text-zinc-300">
                          <span>직원 실수령 (세전)</span>
                          <span>{fmtW(Math.round(data.grossSalary))}</span>
                        </div>
                        <div className="flex justify-between text-sm text-zinc-400">
                          <span>4대보험+산재 (10.65%)</span>
                          <span>+ {fmtW(Math.round(data.insuranceCost))}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-black border-t border-zinc-600 pt-2">
                      <span className="text-zinc-300">사업자 총지출</span>
                      <span className="text-white text-lg">{fmtW(Math.round(data.companyCost))}</span>
                    </div>
                  </div>

                  {/* 메모 + 정산 버튼 */}
                  {!rec && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="정산 메모 (선택)"
                        value={memos[trainer.id] ?? ""}
                        onChange={(e) => setMemos((prev) => ({ ...prev, [trainer.id]: e.target.value }))}
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-blue-400"
                      />
                      <button onClick={() => settle(trainer)}
                        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition">
                        ✅ 정산 완료 처리
                      </button>
                    </div>
                  )}

                  {rec && rec.memo && (
                    <p className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">
                      💬 {rec.memo}
                    </p>
                  )}
                  {rec && (
                    <p className="text-xs text-center text-zinc-400">
                      {rec.settledAt} 정산 완료
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 월별 합계 */}
        {activeTrainers.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-5 text-white">
            <p className="text-sm text-zinc-400 mb-1">{monthLabel(selMonth)} 사업자 총 인건비</p>
            <p className="text-3xl font-black">{fmtW(Math.round(totalCompanyCost))}</p>
            <p className="text-xs text-zinc-500 mt-2">
              정규직 4대보험+산재(10.65%) 포함 · 프리랜서 세전 기준
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
