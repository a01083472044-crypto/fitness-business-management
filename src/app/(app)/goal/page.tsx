"use client";

import { useState, useEffect, useMemo } from "react";
import { getMembers, getSchedules, getCosts, Member, ScheduleEntry, MonthlyCosts } from "../../lib/store";

const GOAL_KEY = "gym_monthly_goals"; // { "YYYY-MM": number }

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}
function fmtManwon(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "억";
  if (n >= 10000) return Math.round(n / 10000) + "만";
  return Math.round(n).toLocaleString();
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

function getDaysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function getDaysElapsed(month: string): number {
  const today = new Date();
  const [y, m] = month.split("-").map(Number);
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  if (!isCurrentMonth) return getDaysInMonth(month);
  return today.getDate();
}

function calcMonthRevenue(members: Member[], month: string): number {
  return members.flatMap((m) => m.packages ?? [])
    .filter((p) => p.registeredAt?.startsWith(month))
    .reduce((s, p) => s + p.paymentAmount, 0);
}

function calcPrevMonthRevenue(members: Member[], month: string): number {
  const [y, mo] = month.split("-").map(Number);
  const prev = new Date(y, mo - 2, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return calcMonthRevenue(members, prevMonth);
}

function calcActiveMembers(members: Member[], month: string): number {
  return members.filter((m) =>
    (m.packages ?? []).some((p) => p.registeredAt?.startsWith(month))
  ).length;
}

function calcAvgSessionsPerMember(schedules: ScheduleEntry[], members: Member[], month: string): number {
  const memberIds = new Set(
    members.filter((m) => (m.packages ?? []).some((p) => p.registeredAt?.startsWith(month))).map((m) => m.id)
  );
  if (memberIds.size === 0) return 0;
  const done = schedules.filter((s) => s.date.startsWith(month) && s.done && memberIds.has(s.memberId));
  return done.length / memberIds.size;
}

export default function GoalPage() {
  const months = useMemo(() => getMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [goalInput, setGoalInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [costs, setCosts] = useState<MonthlyCosts[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMembers(getMembers());
    setSchedules(getSchedules());
    setCosts(getCosts());
    try {
      const raw = JSON.parse(localStorage.getItem(GOAL_KEY) || "{}");
      setGoals(raw);
    } catch { setGoals({}); }
  }, []);

  useEffect(() => {
    const g = goals[month];
    setGoalInput(g ? String(Math.round(g / 10000)) : "");
  }, [month, goals]);

  const goal = goals[month] ?? 0;
  const revenue = useMemo(() => calcMonthRevenue(members, month), [members, month]);
  const prevRevenue = useMemo(() => calcPrevMonthRevenue(members, month), [members, month]);
  const daysElapsed = getDaysElapsed(month);
  const daysInMonth = getDaysInMonth(month);
  const daysLeft = daysInMonth - daysElapsed;
  const isCurrentMonth = (() => {
    const today = new Date();
    const [y, m2] = month.split("-").map(Number);
    return today.getFullYear() === y && today.getMonth() + 1 === m2;
  })();

  const achievePct = goal > 0 ? Math.min((revenue / goal) * 100, 100) : 0;
  const remaining = goal > 0 ? Math.max(goal - revenue, 0) : 0;
  const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : 0;
  const pace = daysElapsed > 0 ? (revenue / daysElapsed) * daysInMonth : 0;
  const momDiff = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  const activeMembers = useMemo(() => calcActiveMembers(members, month), [members, month]);
  const prevActiveMembers = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const prev = new Date(y, mo - 2, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    return calcActiveMembers(members, prevMonth);
  }, [members, month]);
  const avgSessions = useMemo(() => calcAvgSessionsPerMember(schedules, members, month), [schedules, members, month]);
  const prevAvgSessions = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const prev = new Date(y, mo - 2, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    return calcAvgSessionsPerMember(schedules, members, prevMonth);
  }, [schedules, members, month]);

  // 원인 분석
  const memberChange = activeMembers - prevActiveMembers;
  const sessionChange = avgSessions - prevAvgSessions;
  const avgPkgPrice = activeMembers > 0 ? revenue / activeMembers : 0;

  function saveGoal() {
    const val = Math.abs(Number(goalInput.replace(/[^0-9.]/g, ""))) * 10000;
    if (!val) return;
    const updated = { ...goals, [month]: val };
    setGoals(updated);
    localStorage.setItem(GOAL_KEY, JSON.stringify(updated));
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const [y, mo] = month.split("-");
  const monthLabel = `${y}년 ${Number(mo)}월`;

  const barColor = achievePct >= 100 ? "bg-emerald-500"
    : achievePct >= 70 ? "bg-blue-500"
    : achievePct >= 40 ? "bg-yellow-500"
    : "bg-red-500";

  const statusColor = achievePct >= 100 ? "text-emerald-600"
    : achievePct >= 70 ? "text-blue-600"
    : achievePct >= 40 ? "text-yellow-600"
    : "text-red-600";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">목표 매출 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">월 목표 설정 · 실시간 달성률</p>
          </div>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500">
            {months.map((m2) => {
              const [y2, mo2] = m2.split("-");
              return <option key={m2} value={m2}>{y2}년 {Number(mo2)}월</option>;
            })}
          </select>
        </div>

        {/* 목표 설정 카드 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-zinc-800">{monthLabel} 목표 매출</p>
            <button onClick={() => setEditing(!editing)}
              className="text-xs text-blue-500 font-semibold px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
              {editing ? "취소" : goal > 0 ? "수정" : "목표 설정"}
            </button>
          </div>
          {editing ? (
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="목표 금액 입력"
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">만원</span>
              </div>
              <button onClick={saveGoal}
                className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition">
                저장
              </button>
            </div>
          ) : (
            <p className={`text-3xl font-black ${goal > 0 ? "text-zinc-900" : "text-zinc-300"}`}>
              {goal > 0 ? fmtW(goal) : "목표 미설정"}
            </p>
          )}
          {saved && <p className="text-xs text-emerald-600 mt-1.5 font-semibold">✅ 저장되었습니다</p>}
        </div>

        {/* 달성률 카드 */}
        {goal > 0 ? (
          <div className={`rounded-2xl p-5 space-y-4 ${
            achievePct >= 100 ? "bg-emerald-50 border border-emerald-100"
            : achievePct >= 70 ? "bg-blue-50 border border-blue-100"
            : achievePct >= 40 ? "bg-yellow-50 border border-yellow-100"
            : "bg-red-50 border border-red-100"
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-zinc-500">{monthLabel} 현재 매출</p>
                <p className="text-3xl font-black text-zinc-900 mt-0.5">{fmtW(revenue)}</p>
                {momDiff !== null && (
                  <p className={`text-xs mt-1 font-semibold ${momDiff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    전월 대비 {momDiff >= 0 ? "+" : ""}{momDiff.toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-4xl font-black ${statusColor}`}>{achievePct.toFixed(1)}%</p>
                <p className="text-xs text-zinc-400 mt-0.5">달성률</p>
              </div>
            </div>

            {/* 진행 바 */}
            <div className="space-y-1.5">
              <div className="w-full bg-white/70 rounded-full h-3 overflow-hidden">
                <div className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${achievePct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>₩0</span>
                <span>{fmtW(goal)}</span>
              </div>
            </div>

            {/* 페이스 & 남은 목표 */}
            <div className="bg-white/60 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">현재 페이스 (예상)</p>
                <p className="font-black text-zinc-800">{fmtW(pace)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-0.5">목표까지 잔여</p>
                <p className={`font-black ${remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {remaining > 0 ? fmtW(remaining) : "🎉 달성"}
                </p>
              </div>
              {isCurrentMonth && daysLeft > 0 && remaining > 0 && (
                <div className="col-span-2 border-t border-white/60 pt-2.5">
                  <p className="text-xs text-zinc-500 font-semibold">
                    📅 남은 <span className="text-blue-600">{daysLeft}일</span>간 하루 평균{" "}
                    <span className="text-red-600 font-black">{fmtW(dailyNeeded)}</span> 필요
                  </p>
                </div>
              )}
              {isCurrentMonth && remaining === 0 && (
                <div className="col-span-2 border-t border-white/60 pt-2.5">
                  <p className="text-xs text-emerald-700 font-bold">🎉 이번 달 목표 달성! 수고하셨습니다.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-zinc-500 text-sm font-medium">목표 매출을 설정하면<br />달성률과 일별 필요 매출을 확인할 수 있습니다</p>
            <p className="text-zinc-400 text-sm mt-1">{monthLabel} 현재 매출: <span className="font-bold text-zinc-700">{fmtW(revenue)}</span></p>
          </div>
        )}

        {/* 원인 분석 */}
        {(prevRevenue > 0 || revenue > 0) && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
            <p className="font-bold text-zinc-800">📊 전월 대비 원인 분석</p>
            <div className="space-y-2.5">
              {/* 회원 수 */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👥</span>
                  <div>
                    <p className="font-semibold text-zinc-700">활성 회원 수</p>
                    <p className="text-xs text-zinc-400">결제 회원 기준</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-zinc-900">{activeMembers}명</p>
                  {prevActiveMembers > 0 && (
                    <p className={`text-xs font-semibold ${memberChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {memberChange >= 0 ? "+" : ""}{memberChange}명
                    </p>
                  )}
                </div>
              </div>

              {/* 수업 횟수 */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏋️</span>
                  <div>
                    <p className="font-semibold text-zinc-700">1인 평균 수업 수</p>
                    <p className="text-xs text-zinc-400">완료 기준</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-zinc-900">{avgSessions.toFixed(1)}회</p>
                  {prevAvgSessions > 0 && (
                    <p className={`text-xs font-semibold ${sessionChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {sessionChange >= 0 ? "+" : ""}{sessionChange.toFixed(1)}회
                    </p>
                  )}
                </div>
              </div>

              {/* 회원당 평균 결제 */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <div>
                    <p className="font-semibold text-zinc-700">회원당 평균 결제액</p>
                    <p className="text-xs text-zinc-400">신규 패키지 기준</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-zinc-900">{activeMembers > 0 ? fmtW(avgPkgPrice) : "—"}</p>
                </div>
              </div>
            </div>

            {/* 진단 메시지 */}
            {prevRevenue > 0 && revenue < prevRevenue && (
              <div className="bg-red-50 rounded-xl p-3 space-y-1 text-xs text-red-700 font-semibold">
                <p>⚠️ 전월 대비 매출 감소 감지</p>
                {memberChange < 0 && <p>· 활성 회원 {Math.abs(memberChange)}명 감소 → 신규 등록 유도 필요</p>}
                {sessionChange < -0.5 && <p>· 1인 평균 수업 {Math.abs(sessionChange).toFixed(1)}회 감소 → 출석률 관리 필요</p>}
                {memberChange >= 0 && sessionChange >= -0.5 && (
                  <p>· 결제 단가 하락 또는 패키지 구성 변화 가능성</p>
                )}
              </div>
            )}
            {prevRevenue > 0 && revenue >= prevRevenue && (
              <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700 font-semibold">
                ✅ 전월 대비 매출 증가 — 현재 패턴 유지 권장
              </div>
            )}
          </div>
        )}

        {/* 6개월 목표 현황 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-800">📅 월별 목표 달성 현황</p>
          <div className="space-y-2">
            {months.map((m2) => {
              const [y2, mo2] = m2.split("-");
              const g2 = goals[m2] ?? 0;
              const r2 = calcMonthRevenue(members, m2);
              const pct2 = g2 > 0 ? Math.min((r2 / g2) * 100, 100) : 0;
              return (
                <button key={m2} onClick={() => setMonth(m2)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition ${m2 === month ? "bg-blue-50" : "hover:bg-zinc-50"}`}>
                  <span className="text-xs font-semibold text-zinc-500 w-14 text-left">{y2}년 {Number(mo2)}월</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden">
                    {g2 > 0 && (
                      <div className={`h-2 rounded-full ${
                        pct2 >= 100 ? "bg-emerald-500" : pct2 >= 70 ? "bg-blue-500" : pct2 >= 40 ? "bg-yellow-500" : "bg-red-400"
                      }`} style={{ width: `${pct2}%` }} />
                    )}
                  </div>
                  <span className="text-xs font-bold text-zinc-700 w-14 text-right">
                    {g2 > 0 ? `${pct2.toFixed(0)}%` : "미설정"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
