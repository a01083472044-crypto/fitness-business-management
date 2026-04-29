"use client";

import { useState, useEffect, useMemo } from "react";
import { getMembers, getSchedules, Member, ScheduleEntry } from "../../lib/store";
import { useStaffTerm } from "../../context/StaffTermContext";

function fmtW(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  then.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

interface ChurnRisk {
  member: Member;
  remainingSessions: number;
  lastSessionDate: string | null;
  daysSinceLastSession: number | null;
  riskType: "sessions" | "inactive" | "both";
  avgPackagePrice: number;
  expectedLoss: number;
}

export default function ChurnPage() {
  const { staffTerm } = useStaffTerm();
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    setMembers(getMembers());
    setSchedules(getSchedules());
  }, []);

  // 각 회원의 마지막 완료 수업 날짜
  const lastSessionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of schedules) {
      if (!s.done) continue;
      if (!map[s.memberId] || s.date > map[s.memberId]) {
        map[s.memberId] = s.date;
      }
    }
    return map;
  }, [schedules]);

  // 이탈 위험 회원 계산
  const atRisk = useMemo((): ChurnRisk[] => {
    const result: ChurnRisk[] = [];
    for (const m of members) {
      const pkgs = m.packages ?? [];
      if (pkgs.length === 0) continue;

      const remaining = pkgs.reduce((s, p) => s + Math.max(p.totalSessions - p.conductedSessions, 0), 0);
      const lastDate = lastSessionMap[m.id] ?? null;
      const daysSince = lastDate ? daysBetween(lastDate) : null;

      const lowSessions = remaining <= 3 && remaining >= 0;
      const inactive = daysSince !== null && daysSince >= 14;

      if (!lowSessions && !inactive) continue;

      const riskType: ChurnRisk["riskType"] =
        lowSessions && inactive ? "both"
        : lowSessions ? "sessions"
        : "inactive";

      // 평균 패키지 단가 (가장 최근 패키지 기준)
      const latestPkg = [...pkgs].sort((a, b) =>
        (b.registeredAt ?? "").localeCompare(a.registeredAt ?? "")
      )[0];
      const avgPackagePrice = latestPkg?.paymentAmount ?? 0;

      result.push({
        member: m,
        remainingSessions: remaining,
        lastSessionDate: lastDate,
        daysSinceLastSession: daysSince,
        riskType,
        avgPackagePrice,
        expectedLoss: avgPackagePrice,
      });
    }
    // 위험도 순 정렬: both > sessions > inactive, then 잔여횟수 오름차순
    return result.sort((a, b) => {
      const order = { both: 0, sessions: 1, inactive: 2 };
      if (order[a.riskType] !== order[b.riskType]) return order[a.riskType] - order[b.riskType];
      return a.remainingSessions - b.remainingSessions;
    });
  }, [members, lastSessionMap]);

  // 재등록 전환율 통계
  const conversionStats = useMemo(() => {
    // 잔여 0회에서 새 패키지를 등록한 비율 근사
    // 각 회원이 패키지를 2개 이상 가지고 있으면 재등록으로 봄
    const totalWithPkgs = members.filter((m) => (m.packages ?? []).length > 0).length;
    const reregistered = members.filter((m) => (m.packages ?? []).length >= 2).length;
    const rate = totalWithPkgs > 0 ? (reregistered / totalWithPkgs) * 100 : 0;
    return { totalWithPkgs, reregistered, rate };
  }, [members]);

  const totalExpectedLoss = atRisk.reduce((s, r) => s + r.expectedLoss, 0);
  const bothCount = atRisk.filter((r) => r.riskType === "both").length;
  const sessionsCount = atRisk.filter((r) => r.riskType === "sessions").length;
  const inactiveCount = atRisk.filter((r) => r.riskType === "inactive").length;

  function riskBadge(r: ChurnRisk) {
    if (r.riskType === "both") return { label: "긴급", color: "bg-red-500 text-white" };
    if (r.riskType === "sessions") return { label: "잔여 부족", color: "bg-orange-100 text-orange-700" };
    return { label: "장기 미출석", color: "bg-yellow-100 text-yellow-700" };
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">회원 이탈 위험 감지</h1>
          <p className="text-sm text-zinc-500 mt-0.5">잔여 횟수 · 출석 공백 · 예상 손실 분석</p>
        </div>

        {/* 요약 카드 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-4">
          <p className="text-xs text-zinc-400">이탈 위험 현황</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-black text-red-400">{atRisk.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">위험 회원</p>
            </div>
            <div>
              <p className="text-3xl font-black text-orange-400">{bothCount}</p>
              <p className="text-xs text-zinc-400 mt-0.5">긴급 관리</p>
            </div>
            <div>
              <p className="text-2xl font-black text-yellow-300">{fmtW(totalExpectedLoss)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">예상 손실</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-700 text-center text-xs text-zinc-400">
            <div>잔여 3회↓<br /><span className="text-white font-bold">{sessionsCount + bothCount}명</span></div>
            <div>2주↑ 미출석<br /><span className="text-white font-bold">{inactiveCount + bothCount}명</span></div>
            <div>재등록률<br /><span className="text-emerald-400 font-bold">{conversionStats.rate.toFixed(0)}%</span></div>
          </div>
        </div>

        {/* 재등록 전환율 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-800">📈 재등록 전환율</p>
            <span className={`text-sm font-black ${
              conversionStats.rate >= 60 ? "text-emerald-600"
              : conversionStats.rate >= 40 ? "text-blue-600"
              : "text-red-600"
            }`}>{conversionStats.rate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
            <div className={`h-2.5 rounded-full ${
              conversionStats.rate >= 60 ? "bg-emerald-500"
              : conversionStats.rate >= 40 ? "bg-blue-500"
              : "bg-red-400"
            }`} style={{ width: `${Math.min(conversionStats.rate, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>패키지 보유 회원 {conversionStats.totalWithPkgs}명</span>
            <span>재등록 {conversionStats.reregistered}명</span>
          </div>
          <p className="text-xs text-zinc-400">
            {conversionStats.rate >= 60
              ? "✅ 재등록 전환율 양호 — 지속적 관리 필요"
              : conversionStats.rate >= 40
              ? "⚠️ 재등록률 개선 필요 — 만료 전 상담 권장"
              : "🔴 재등록률 낮음 — 적극적 리텐션 프로그램 검토"}
          </p>
        </div>

        {/* 이탈 위험 회원 없음 */}
        {atRisk.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-zinc-500 text-sm font-medium">이탈 위험 회원이 없습니다</p>
            <p className="text-zinc-400 text-xs mt-1">잔여 3회 이하 또는 2주 이상 미출석 회원을 감지합니다</p>
          </div>
        )}

        {/* 위험 회원 목록 */}
        {atRisk.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-zinc-600">⚠️ 위험 회원 {atRisk.length}명</p>
            {atRisk.map((r) => {
              const badge = riskBadge(r);
              return (
                <div key={r.member.id}
                  className={`bg-white rounded-2xl border p-4 space-y-3 ${
                    r.riskType === "both" ? "border-red-200" : "border-zinc-100"
                  }`}>
                  {/* 회원 헤더 */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-zinc-900">{r.member.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      {r.member.trainer && (
                        <p className="text-xs text-zinc-400 mt-0.5">담당 {staffTerm}: {r.member.trainer}</p>
                      )}
                    </div>
                    {r.avgPackagePrice > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-zinc-400">예상 손실</p>
                        <p className="text-sm font-black text-red-600">{fmtW(r.expectedLoss)}</p>
                      </div>
                    )}
                  </div>

                  {/* 상세 정보 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-xl p-2.5 ${r.remainingSessions <= 3 ? "bg-orange-50" : "bg-zinc-50"}`}>
                      <p className="text-xs text-zinc-400 mb-0.5">잔여 횟수</p>
                      <p className={`text-lg font-black ${r.remainingSessions <= 1 ? "text-red-600" : r.remainingSessions <= 3 ? "text-orange-600" : "text-zinc-700"}`}>
                        {r.remainingSessions}회
                      </p>
                      {r.remainingSessions === 0 && (
                        <p className="text-xs text-red-500 font-semibold">만료됨</p>
                      )}
                    </div>
                    <div className={`rounded-xl p-2.5 ${r.daysSinceLastSession !== null && r.daysSinceLastSession >= 14 ? "bg-yellow-50" : "bg-zinc-50"}`}>
                      <p className="text-xs text-zinc-400 mb-0.5">마지막 수업</p>
                      {r.lastSessionDate ? (
                        <>
                          <p className={`text-lg font-black ${r.daysSinceLastSession !== null && r.daysSinceLastSession >= 14 ? "text-yellow-600" : "text-zinc-700"}`}>
                            {r.daysSinceLastSession}일 전
                          </p>
                          <p className="text-xs text-zinc-400">{r.lastSessionDate}</p>
                        </>
                      ) : (
                        <p className="text-lg font-black text-zinc-300">기록 없음</p>
                      )}
                    </div>
                  </div>

                  {/* 권장 조치 */}
                  <div className={`rounded-xl p-3 text-xs font-semibold space-y-0.5 ${
                    r.riskType === "both" ? "bg-red-50 text-red-700"
                    : r.riskType === "sessions" ? "bg-orange-50 text-orange-700"
                    : "bg-yellow-50 text-yellow-700"
                  }`}>
                    {r.riskType === "both" && (
                      <>
                        <p>🚨 긴급 — 즉시 연락 필요</p>
                        <p>· 잔여 {r.remainingSessions}회 + {r.daysSinceLastSession}일 미출석</p>
                        <p>· 재등록 상담 및 특별 혜택 제공 권장</p>
                      </>
                    )}
                    {r.riskType === "sessions" && (
                      <>
                        <p>📋 잔여 횟수 {r.remainingSessions}회 — 재등록 안내 시점</p>
                        <p>· 수업 종료 전 재등록 상담 예약 권장</p>
                      </>
                    )}
                    {r.riskType === "inactive" && (
                      <>
                        <p>📵 {r.daysSinceLastSession}일 미출석 — 출석 독려 필요</p>
                        <p>· 안부 연락 또는 이벤트 안내 권장</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 감지 기준 안내 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-1.5 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-500">📌 감지 기준</p>
          <p>· 잔여 횟수 3회 이하: 패키지 만료 임박</p>
          <p>· 마지막 수업 후 14일 이상 경과: 장기 미출석</p>
          <p>· 예상 손실: 최근 패키지 결제 금액 기준</p>
          <p>· 재등록 전환율: 패키지 2개 이상 보유 회원 비율</p>
        </div>

      </div>
    </div>
  );
}
