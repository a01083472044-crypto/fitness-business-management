"use client";

import { useState, useEffect, useMemo } from "react";
import { getMembers, getSchedules, currentMonth, Member, ScheduleEntry } from "../lib/store";

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function nextMonthStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

interface MemberForecast {
  member: Member;
  totalRemaining: number;     // 전체 잔여 횟수
  revenuePerSession: number;  // 회당 단가
  doneThisMonth: number;      // 이번 달 완료 수업
  monthlyPace: number;        // 월 예상 수업 페이스
  expectedNextMonth: number;  // 다음 달 예상 수업 수
  expectedRevenue: number;    // 다음 달 예상 매출
  isAtRisk: boolean;          // 잔여 3회 이하
  willRunOut: boolean;        // 다음 달 패키지 소진 예정
  renewalRevenue: number;     // 재등록 시 예상 매출 (직전 패키지 기준)
}

export default function ForecastPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    setMembers(getMembers());
    setSchedules(getSchedules());
  }, []);

  const now = new Date();
  const month = currentMonth();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(now.getDate(), 1);

  const forecasts = useMemo<MemberForecast[]>(() => {
    return members.flatMap((m) => {
      const activePkgs = (m.packages ?? []).filter(
        (p) => p.conductedSessions < p.totalSessions
      );
      if (activePkgs.length === 0) return [];

      const totalRemaining = activePkgs.reduce(
        (s, p) => s + (p.totalSessions - p.conductedSessions), 0
      );

      // 회당 단가: 활성 패키지 가중평균
      const totalRemainingRevenue = activePkgs.reduce((s, p) => {
        const rem = p.totalSessions - p.conductedSessions;
        return s + (p.paymentAmount / p.totalSessions) * rem;
      }, 0);
      const revenuePerSession = totalRemaining > 0 ? totalRemainingRevenue / totalRemaining : 0;

      // 이번 달 완료 수업 수
      const doneThisMonth = schedules.filter(
        (s) => s.memberId === m.id && s.date.startsWith(month) && s.done
      ).length;

      // 월 페이스 추정: 이번 달 완료 / 경과 일수 × 30
      const monthlyPace = Math.round((doneThisMonth / daysElapsed) * 30);

      // 다음 달 예상 수업: 페이스와 잔여 횟수 중 작은 값
      const expectedNextMonth = Math.min(monthlyPace, totalRemaining);
      const expectedRevenue = expectedNextMonth * revenuePerSession;

      const isAtRisk = totalRemaining <= 3;
      const willRunOut = totalRemaining <= monthlyPace && monthlyPace > 0;

      // 재등록 시 예상 매출: 마지막 패키지 결제금액 기준
      const lastPkg = [...(m.packages ?? [])].sort(
        (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
      )[0];
      const renewalRevenue = lastPkg?.paymentAmount ?? 0;

      return [{
        member: m, totalRemaining, revenuePerSession, doneThisMonth,
        monthlyPace, expectedNextMonth, expectedRevenue,
        isAtRisk, willRunOut, renewalRevenue,
      }];
    });
  }, [members, schedules, month, daysElapsed]);

  // 요약 수치
  const totalExpected   = useMemo(() => forecasts.reduce((s, f) => s + f.expectedRevenue, 0), [forecasts]);
  const atRiskList      = useMemo(() => forecasts.filter((f) => f.isAtRisk), [forecasts]);
  const willRunOutList  = useMemo(() => forecasts.filter((f) => f.willRunOut), [forecasts]);
  const renewalPotential= useMemo(() => atRiskList.reduce((s, f) => s + f.renewalRevenue, 0), [atRiskList]);

  // 정렬: 위험 우선, 그 다음 예상 매출 높은 순
  const sorted = useMemo(() =>
    [...forecasts].sort((a, b) => {
      if (a.isAtRisk !== b.isAtRisk) return a.isAtRisk ? -1 : 1;
      return b.expectedRevenue - a.expectedRevenue;
    }),
    [forecasts]
  );

  const progressPct = Math.round((daysElapsed / daysInMonth) * 100);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">매출 예측</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            현재 패키지 기준 {nextMonthLabel()} 예상 매출
          </p>
        </div>

        {/* 이번 달 진행률 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>이번 달 진행률</span>
            <span>{daysElapsed}일 / {daysInMonth}일 ({progressPct}%)</span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-blue-400 transition-all"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* 예측 요약 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-4">
          <p className="text-xs text-zinc-400">{nextMonthLabel()} 예상 매출</p>
          <p className="text-3xl font-black">{fmtW(totalExpected)}</p>
          <p className="text-xs text-zinc-400">활성 패키지 회당 단가 × 예상 수업 수 기반</p>

          <div className="grid grid-cols-2 gap-3 border-t border-zinc-700 pt-4">
            <div className="bg-red-900/40 rounded-xl p-3">
              <p className="text-xs text-red-300 mb-1">⚠️ 이탈 위험 회원</p>
              <p className="text-xl font-black text-red-300">{atRiskList.length}명</p>
              <p className="text-xs text-red-400 mt-0.5">잔여 3회 이하</p>
            </div>
            <div className="bg-emerald-900/40 rounded-xl p-3">
              <p className="text-xs text-emerald-300 mb-1">💰 재등록 잠재 매출</p>
              <p className="text-xl font-black text-emerald-300">{fmtW(renewalPotential)}</p>
              <p className="text-xs text-emerald-400 mt-0.5">위험 회원 재등록 시</p>
            </div>
          </div>

          {willRunOutList.length > 0 && (
            <div className="bg-yellow-900/30 rounded-xl p-3">
              <p className="text-xs text-yellow-300 font-semibold">
                📦 다음 달 패키지 소진 예정: {willRunOutList.length}명
              </p>
              <p className="text-xs text-yellow-400 mt-0.5">
                {willRunOutList.map((f) => f.member.name).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* 회원별 예측 */}
        <div className="space-y-3">
          <p className="text-sm font-bold text-zinc-600">회원별 예측 내역</p>

          {sorted.length === 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center text-zinc-400 text-sm">
              활성 패키지가 있는 회원이 없습니다
            </div>
          )}

          {sorted.map((f) => (
            <div key={f.member.id}
              className={`rounded-2xl border p-4 space-y-3 ${
                f.isAtRisk
                  ? "bg-red-50 border-red-100"
                  : f.willRunOut
                  ? "bg-yellow-50 border-yellow-100"
                  : "bg-white border-zinc-100"
              }`}>
              {/* 회원 헤더 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-zinc-900">{f.member.name}</p>
                    {f.isAtRisk && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                        ⚠️ 이탈위험
                      </span>
                    )}
                    {!f.isAtRisk && f.willRunOut && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                        📦 소진예정
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    담당: {f.member.trainer || "미지정"} · 잔여 {f.totalRemaining}회
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-zinc-900">{fmtW(f.expectedRevenue)}</p>
                  <p className="text-xs text-zinc-400">다음달 예상</p>
                </div>
              </div>

              {/* 수치 */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-zinc-400">이번달 수업</p>
                  <p className="font-bold text-zinc-700 mt-0.5">{f.doneThisMonth}회</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-zinc-400">월 페이스</p>
                  <p className="font-bold text-zinc-700 mt-0.5">월 {f.monthlyPace}회</p>
                </div>
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-zinc-400">회당 단가</p>
                  <p className="font-bold text-zinc-700 mt-0.5">{fmtW(f.revenuePerSession)}</p>
                </div>
              </div>

              {/* 이탈 위험 시 재등록 안내 */}
              {f.isAtRisk && f.renewalRevenue > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700 font-semibold">
                  💡 재등록 유도 시 예상 매출: {fmtW(f.renewalRevenue)} (직전 패키지 기준)
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 기준 안내 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-1.5 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-500">📌 예측 계산 기준</p>
          <p>· 월 페이스: 이번 달 완료 수업 ÷ 경과 일수 × 30일</p>
          <p>· 다음 달 예상 수업: 페이스와 잔여 횟수 중 작은 값</p>
          <p>· 이탈 위험: 전체 잔여 횟수 3회 이하</p>
          <p>· 패키지 소진 예정: 다음 달 페이스가 잔여 횟수 초과</p>
        </div>
      </div>
    </div>
  );
}
