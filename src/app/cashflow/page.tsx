"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getMembers, getSchedules, getCosts, getReceivables,
  emptyCosts, Member, ScheduleEntry,
} from "../lib/store";
import { shareKakao } from "../lib/share";
import {
  KakaoStore, initKakao, sendKakaoMemo, notifySWSent,
} from "../lib/kakao";

function fmtW(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthOf(date: string) { return date.slice(0, 7); }

const INS_RATE = 0.1065;

export default function CashflowPage() {
  const searchParams   = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [members,      setMembers]      = useState<Member[]>([]);
  const [schedules,    setSchedules]    = useState<ScheduleEntry[]>([]);
  const [allCosts,     setAllCosts]     = useState<ReturnType<typeof getCosts>>([]);
  const [toast,        setToast]        = useState("");
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [kakaoLinked,  setKakaoLinked]  = useState(false);
  const [lastSent,     setLastSent]     = useState("");

  useEffect(() => {
    setMembers(getMembers());
    setSchedules(getSchedules());
    setAllCosts(getCosts());
    setKakaoLinked(!!KakaoStore.getToken());
    setLastSent(KakaoStore.getLastSent());
  }, []);

  // buildShareText는 아래에서 선언되지만 useCallback으로 먼저 선언
  // (autoSend 트리거에서 사용하기 위해 ref 패턴 사용)
  const buildTextRef = useCallback(() => {
    const lines = [
      `📅 ${todayStr()} 자금일보`,
      "━━━━━━━━━━━━━━━━━━━",
      `💳 신규 등록: 앱에서 확인`,
      "📱 FitBoss",
    ];
    return lines.join("\n");
  }, []);

  // ── 카카오 나에게 보내기 ──────────────────────────────────────────────────
  async function handleKakaoSend(text: string) {
    if (!KakaoStore.getToken()) {
      showToast("⚠️ 설정에서 카카오 로그인을 먼저 해주세요.");
      return;
    }
    setKakaoLoading(true);
    try {
      await initKakao();
      await sendKakaoMemo(text);
      KakaoStore.markSent();
      notifySWSent();
      setLastSent(KakaoStore.getLastSent());
      showToast("✅ 카카오톡으로 전송됐습니다!");
    } catch (e) {
      const msg = (e as Error).message;
      showToast(`❌ ${msg}`);
    } finally {
      setKakaoLoading(false);
    }
  }

  // ── URL ?autoSend=1 → 자동 전송 트리거 (알림 클릭 시) ──────────────────
  useEffect(() => {
    if (searchParams.get("autoSend") === "1" && KakaoStore.getToken() && !KakaoStore.isSentToday()) {
      // 약간 딜레이 후 전송 (데이터 로드 완료 대기)
      const t = setTimeout(() => handleKakaoSend(buildTextRef()), 1500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── 전역 자동 전송 결과 수신 (KakaoAutoSender → CustomEvent) ───────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { ok, msg } = (e as CustomEvent).detail;
      showToast(msg);
      if (ok) setLastSent(KakaoStore.getLastSent());
    };
    window.addEventListener("kakao-auto-result", handler);
    return () => window.removeEventListener("kakao-auto-result", handler);
  }, []);

  const selMonth = monthOf(selectedDate);

  // ── 오늘 신규 등록 ──────────────────────────────────────────────────────
  const todayRegs = useMemo(() => {
    const list: { memberName: string; pkgName: string; amount: number; method: string }[] = [];
    for (const m of members) {
      for (const p of m.packages ?? []) {
        if (p.registeredAt === selectedDate) {
          list.push({ memberName: m.name, pkgName: p.name, amount: p.paymentAmount, method: p.paymentMethod || "미기재" });
        }
      }
    }
    return list;
  }, [members, selectedDate]);

  // ── 오늘 완료 수업 ───────────────────────────────────────────────────────
  const todaySessions = useMemo(
    () => schedules.filter((s) => s.date === selectedDate && s.done),
    [schedules, selectedDate]
  );

  // 오늘 수업 소진액 (패키지 단가 × 1회)
  const todaySessionRev = useMemo(() => {
    let total = 0;
    for (const s of todaySessions) {
      if (!s.packageId) continue;
      for (const m of members) {
        const pkg = m.packages?.find((p) => p.id === s.packageId);
        if (pkg && pkg.totalSessions > 0) { total += pkg.paymentAmount / pkg.totalSessions; break; }
      }
    }
    return total;
  }, [todaySessions, members]);

  // ── 이번달 신규 등록 ─────────────────────────────────────────────────────
  const monthRegs = useMemo(() => {
    const list: { date: string; amount: number; method: string }[] = [];
    for (const m of members)
      for (const p of m.packages ?? [])
        if ((p.registeredAt ?? "").startsWith(selMonth))
          list.push({ date: p.registeredAt, amount: p.paymentAmount, method: p.paymentMethod || "" });
    return list;
  }, [members, selMonth]);

  // 일별 집계 (bar chart용)
  const dailyIncome = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { date, amount } of monthRegs) map[date] = (map[date] ?? 0) + amount;
    return map;
  }, [monthRegs]);

  // ── 이번달 지출 ──────────────────────────────────────────────────────────
  const monthCostData = useMemo(() => {
    const c = allCosts.find((c) => c.month === selMonth && (c.branch ?? "") === "") ?? emptyCosts(selMonth);
    const salary   = c.trainerSalary * (1 + INS_RATE) + c.freelanceSalary;
    const fixed    = c.rent + (c.managementFee ?? 0) + c.utilities + c.communication + c.depreciation + c.otherFixed;
    const variable = c.supplies + c.marketing + (c.parkingFee ?? 0) + (c.paymentFee ?? 0) + c.otherVariable;
    return { salary, fixed, variable, total: salary + fixed + variable };
  }, [allCosts, selMonth]);

  // ── 미수금 ───────────────────────────────────────────────────────────────
  const receivables = useMemo(() => getReceivables(), []);
  const unpaidRcvs  = receivables.filter((r) => !r.paid);
  const unpaidTotal = unpaidRcvs.reduce((s, r) => s + r.amount, 0);

  // ── 결제 수단별 합계 ─────────────────────────────────────────────────────
  const methodSums = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of todayRegs) map[r.method] = (map[r.method] ?? 0) + r.amount;
    return map;
  }, [todayRegs]);

  const todayTotalIncome  = todayRegs.reduce((s, r) => s + r.amount, 0);
  const monthTotalIncome  = monthRegs.reduce((s, r) => s + r.amount, 0);

  // ── 이번달 날짜 목록 (bar chart) ─────────────────────────────────────────
  const daysInMonth = useMemo(() => {
    const [y, mo] = selMonth.split("-").map(Number);
    const days = new Date(y, mo, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${selMonth}-${String(i + 1).padStart(2, "0")}`);
  }, [selMonth]);
  const maxDayIncome = Math.max(...Object.values(dailyIncome), 1);

  // ── 카카오톡 공유 텍스트 ──────────────────────────────────────────────────
  function buildShareText() {
    const lines = [
      `📅 ${selectedDate} 자금일보`,
      "━━━━━━━━━━━━━━━━━━━",
      `💳 신규 등록: ${fmtW(todayTotalIncome)} (${todayRegs.length}건)`,
    ];
    for (const r of todayRegs) lines.push(`   · ${r.memberName} | ${r.pkgName} | ${fmtW(r.amount)} (${r.method})`);
    lines.push(`🏋️ 완료 수업: ${todaySessions.length}회 (소진액 ${fmtW(todaySessionRev)})`);
    lines.push("━━━━━━━━━━━━━━━━━━━");
    lines.push(`📊 ${selMonth} 이번달 누계`);
    lines.push(`   신규 등록: ${fmtW(monthTotalIncome)}`);
    lines.push(`   지출 합계: ${fmtW(monthCostData.total)}`);
    lines.push(`   예상 순익: ${fmtW(monthTotalIncome - monthCostData.total)}`);
    if (unpaidRcvs.length > 0) {
      lines.push("━━━━━━━━━━━━━━━━━━━");
      lines.push(`⚠️ 미수금: ${unpaidRcvs.length}건 / ${fmtW(unpaidTotal)}`);
    }
    lines.push("━━━━━━━━━━━━━━━━━━━");
    lines.push("📱 FitBoss");
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildShareText();
    // 카카오 연동 시 나에게 보내기 우선, 없으면 Web Share 폴백
    if (kakaoLinked) {
      await handleKakaoSend(text);
    } else {
      const result = await shareKakao(text, `${selectedDate} 자금일보`);
      if (result === "copied") showToast("📋 클립보드에 복사됐습니다. 카카오톡에 붙여넣기 하세요.\n💡 설정에서 카카오 연동 시 자동 전송 가능!");
      else if (result === "shared") showToast("✅ 공유 완료!");
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">📅 자금일보</h1>
            <p className="text-sm text-zinc-500 mt-0.5">일별 현금 유입·유출 현황</p>
          </div>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-blue-500" />
        </div>

        {/* 카카오 자동 전송 상태 배너 */}
        {(() => {
          const enabled = KakaoStore.isEnabled();
          const linked  = KakaoStore.getToken();
          const time    = KakaoStore.getTime();
          const sentToday = KakaoStore.isSentToday();

          if (sentToday) return (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700 font-semibold">
              ✅ 오늘 자금일보 전송 완료
            </div>
          );
          if (enabled && linked) return (
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
              <p className="text-sm text-yellow-800 font-semibold">💬 매일 {time} 자동 전송 예약 중</p>
              <Link href="/settings" className="text-xs text-yellow-600 underline">설정</Link>
            </div>
          );
          return (
            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5">
              <p className="text-sm text-zinc-500">카카오 자동 전송 미설정</p>
              <Link href="/settings" className="text-xs text-blue-600 font-bold underline">설정하기 →</Link>
            </div>
          );
        })()}

        {/* 오늘 요약 다크카드 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-zinc-400 font-semibold">{selectedDate} 자금 현황</p>
              {lastSent && <p className="text-xs text-zinc-600 mt-0.5">마지막 전송: {lastSent}</p>}
            </div>
            <button onClick={handleShare} disabled={kakaoLoading}
              className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition ${
                kakaoLinked
                  ? "bg-yellow-400 text-zinc-900 hover:bg-yellow-300"
                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              }`}>
              {kakaoLoading
                ? <span className="w-3 h-3 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                : <span>💬</span>}
              {kakaoLinked ? "카카오 전송" : "카카오톡 공유"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-black text-emerald-400">{fmtW(todayTotalIncome)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">신규 등록</p>
            </div>
            <div>
              <p className="text-xl font-black text-blue-300">{fmtW(todaySessionRev)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">수업 소진액</p>
            </div>
            <div>
              <p className="text-xl font-black text-white">{todaySessions.length}회</p>
              <p className="text-xs text-zinc-400 mt-0.5">완료 수업</p>
            </div>
          </div>
        </div>

        {/* 신규 등록 상세 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-800">💳 신규 등록 수입</p>
            <span className="text-emerald-600 font-black text-sm">{fmtW(todayTotalIncome)}</span>
          </div>
          {todayRegs.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">오늘 신규 등록 없음</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {todayRegs.map((r, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-800">{r.memberName}</p>
                    <p className="text-xs text-zinc-400">{r.pkgName} · {r.method}</p>
                  </div>
                  <span className="font-bold text-emerald-600">{fmtW(r.amount)}</span>
                </div>
              ))}
              {Object.keys(methodSums).length > 1 && (
                <div className="pt-3 flex gap-2 flex-wrap">
                  {Object.entries(methodSums).map(([m, a]) => (
                    <span key={m} className="text-xs bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-1 text-zinc-500">
                      {m}: {fmtW(a)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 완료 수업 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-800">🏋️ 완료 수업</p>
            <span className="text-blue-600 font-black text-sm">{todaySessions.length}회 · {fmtW(todaySessionRev)}</span>
          </div>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">오늘 완료 수업 없음</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {todaySessions.map((s) => (
                <div key={s.id} className="flex justify-between items-center py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-800">{s.memberName}</p>
                    <p className="text-xs text-zinc-400">{s.startTime} · {s.trainerName}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    s.classType === "그룹" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  }`}>{s.classType ?? "1:1"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 이번달 요약 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-800">📊 {selMonth} 이번달 현황</p>
          <div className="space-y-2 text-sm divide-y divide-zinc-50">
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-500">신규 등록 수입</span>
              <span className="font-bold text-emerald-600">{fmtW(monthTotalIncome)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-500">총 지출 (비용관리 기준)</span>
              <span className="font-bold text-red-500">− {fmtW(monthCostData.total)}</span>
            </div>
            {monthCostData.salary > 0 && (
              <div className="flex justify-between py-1 pl-3 text-xs text-zinc-400">
                <span>└ 인건비</span><span>− {fmtW(monthCostData.salary)}</span>
              </div>
            )}
            {monthCostData.fixed > 0 && (
              <div className="flex justify-between py-1 pl-3 text-xs text-zinc-400">
                <span>└ 고정비</span><span>− {fmtW(monthCostData.fixed)}</span>
              </div>
            )}
            {monthCostData.variable > 0 && (
              <div className="flex justify-between py-1 pl-3 text-xs text-zinc-400">
                <span>└ 변동비</span><span>− {fmtW(monthCostData.variable)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span className="font-bold text-zinc-700">예상 순익</span>
              <span className={`font-black text-base ${monthTotalIncome - monthCostData.total >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmtW(monthTotalIncome - monthCostData.total)}
              </span>
            </div>
          </div>
          {monthCostData.total === 0 && (
            <p className="text-xs text-zinc-400 bg-zinc-50 rounded-lg p-2.5">
              💡 비용 관리에서 이번달 지출을 입력하면 자동 반영됩니다
            </p>
          )}
        </div>

        {/* 일별 수입 차트 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
          <p className="font-bold text-zinc-800">📈 이번달 일별 신규 등록</p>
          {monthRegs.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">이번달 등록 내역 없음</p>
          ) : (
            <>
              <div className="flex items-end gap-px h-20">
                {daysInMonth.map((d) => {
                  const amt = dailyIncome[d] ?? 0;
                  const h   = amt > 0 ? Math.max((amt / maxDayIncome) * 100, 10) : 0;
                  const isSelected = d === selectedDate;
                  return (
                    <div key={d} className="flex-1 flex flex-col justify-end h-full cursor-pointer"
                      onClick={() => setSelectedDate(d)} title={`${d}: ${fmtW(amt)}`}>
                      <div className={`w-full rounded-t transition-all ${
                        isSelected ? "bg-emerald-500" : amt > 0 ? "bg-emerald-200" : "bg-zinc-100"
                      }`} style={{ height: amt > 0 ? `${h}%` : "3px" }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>1일</span><span>{daysInMonth.length}일</span>
              </div>
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-zinc-400">수입 상위 날짜</p>
                {Object.entries(dailyIncome)
                  .sort((a, b) => b[1] - a[1]).slice(0, 5)
                  .map(([d, a]) => (
                    <div key={d}
                      className={`flex justify-between text-sm py-1 cursor-pointer rounded-lg px-2 ${d === selectedDate ? "bg-emerald-50 text-emerald-700 font-bold" : "text-zinc-600 hover:bg-zinc-50"}`}
                      onClick={() => setSelectedDate(d)}>
                      <span>{d}</span><span>{fmtW(a)}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* 미수금 링크 */}
        <Link href="/receivables"
          className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-2xl p-4 hover:bg-orange-100 transition">
          <div>
            <p className="font-bold text-orange-800">⚠️ 미수금 관리</p>
            <p className="text-xs text-orange-600 mt-0.5">
              {unpaidRcvs.length > 0
                ? `미결제 ${unpaidRcvs.length}건 / ${fmtW(unpaidTotal)}`
                : "미결제·만료 미갱신 회원 확인"}
            </p>
          </div>
          <span className="text-orange-500 text-xl font-bold">→</span>
        </Link>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
