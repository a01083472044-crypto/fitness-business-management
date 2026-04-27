"use client";

/**
 * 전역 자동 전송 컴포넌트
 * - Service Worker 등록
 * - 앱이 열려 있을 때 매분 시간 체크 → 자동 전송
 * - SW 메시지 수신 (앱이 열려 있을 때 SW가 보내는 AUTO_SEND_NOW)
 */

import { useEffect, useCallback } from "react";
import {
  KakaoStore, initKakao, sendKakaoMemo, syncSWSchedule, notifySWSent,
} from "../lib/kakao";
import { getMembers, getSchedules, getCosts, getReceivables, emptyCosts } from "../lib/store";

const INS_RATE = 0.1065;

function fmtW(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }

function buildDailyReport(): string {
  const today = new Date();
  const td = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const month = td.slice(0, 7);

  const members   = getMembers();
  const schedules = getSchedules();
  const allCosts  = getCosts();
  const rcvs      = getReceivables();

  const todayRegs = members.flatMap((m) => m.packages ?? []).filter((p) => p.registeredAt === td);
  const todayIncome   = todayRegs.reduce((s, p) => s + p.paymentAmount, 0);
  const todaySessions = schedules.filter((s) => s.date === td && s.done).length;

  // 수업 소진액
  let sessionRev = 0;
  for (const s of schedules.filter((sc) => sc.date === td && sc.done && sc.packageId)) {
    for (const m of members) {
      const pkg = m.packages?.find((p) => p.id === s.packageId);
      if (pkg && pkg.totalSessions > 0) { sessionRev += pkg.paymentAmount / pkg.totalSessions; break; }
    }
  }

  // 이번달 수입
  const monthIncome = members.flatMap((m) => m.packages ?? [])
    .filter((p) => (p.registeredAt ?? "").startsWith(month))
    .reduce((s, p) => s + p.paymentAmount, 0);

  // 이번달 지출
  const c = allCosts.find((c) => c.month === month && (c.branch ?? "") === "") ?? emptyCosts(month);
  const salary   = c.trainerSalary * (1 + INS_RATE) + c.freelanceSalary;
  const fixed    = c.rent + (c.managementFee ?? 0) + c.utilities + c.communication + c.depreciation + c.otherFixed;
  const variable = c.supplies + c.marketing + (c.parkingFee ?? 0) + (c.paymentFee ?? 0) + c.otherVariable;
  const monthCost = salary + fixed + variable;

  // 미수금
  const unpaid = rcvs.filter((r) => !r.paid);

  const lines = [
    `📅 ${td} 자금일보 (자동 전송)`,
    "━━━━━━━━━━━━━━━━━━━━━",
    `💳 신규 등록: ${fmtW(todayIncome)} (${todayRegs.length}건)`,
    ...todayRegs.map((r) => {
      const m = members.find((m) => m.packages?.some((p) => p.id === r.id));
      return `   · ${m?.name ?? "회원"} | ${r.name} | ${fmtW(r.paymentAmount)}`;
    }),
    `🏋️ 완료 수업: ${todaySessions}회 (소진액 ${fmtW(sessionRev)})`,
    "━━━━━━━━━━━━━━━━━━━━━",
    `📊 ${month} 이번달 현황`,
    `   신규 등록: ${fmtW(monthIncome)}`,
    monthCost > 0 ? `   지출 합계: ${fmtW(monthCost)}` : "",
    monthCost > 0 ? `   예상 순익: ${fmtW(monthIncome - monthCost)}` : "",
    unpaid.length > 0 ? `⚠️ 미수금: ${unpaid.length}건 / ${fmtW(unpaid.reduce((s, r) => s + r.amount, 0))}` : "✅ 미수금 없음",
    "━━━━━━━━━━━━━━━━━━━━━",
    "📱 피트니스 경영 관리 시스템",
  ].filter(Boolean);

  return lines.join("\n");
}

async function doAutoSend(onResult: (ok: boolean, msg: string) => void) {
  if (!KakaoStore.isEnabled()) return;
  if (KakaoStore.isSentToday()) return;
  const appKey = KakaoStore.getAppKey();
  const token  = KakaoStore.getToken();
  if (!appKey || !token) return;

  try {
    await initKakao(appKey);
    await sendKakaoMemo(buildDailyReport());
    KakaoStore.markSent();
    notifySWSent();
    onResult(true, "✅ 자금일보가 카카오톡으로 자동 전송됐습니다");
  } catch (e) {
    onResult(false, (e as Error).message);
  }
}

export default function KakaoAutoSender() {
  // 알림 결과를 전역 이벤트로 전달 (cashflow 페이지에서 수신)
  const notify = useCallback((ok: boolean, msg: string) => {
    window.dispatchEvent(new CustomEvent("kakao-auto-result", { detail: { ok, msg } }));
  }, []);

  useEffect(() => {
    // ── Service Worker 등록 ──────────────────────────────────────────────
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("[SW] 등록 완료", reg.scope);
        // 등록 후 스케줄 동기화
        setTimeout(syncSWSchedule, 1000);
      }).catch(console.error);

      // SW 메시지 수신 (AUTO_SEND_NOW)
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "AUTO_SEND_NOW") {
          doAutoSend(notify);
        }
      });
    }

    // ── 인앱 시간 체크 (매분) ────────────────────────────────────────────
    const interval = setInterval(() => {
      if (!KakaoStore.isEnabled()) return;
      if (!KakaoStore.getToken()) return;
      if (KakaoStore.isSentToday()) return;

      const now  = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm !== KakaoStore.getTime()) return;

      doAutoSend(notify);
    }, 60_000);

    return () => clearInterval(interval);
  }, [notify]);

  return null; // 렌더링 없음 — 백그라운드 실행
}
