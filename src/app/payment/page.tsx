"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getMembers, PaymentMethod } from "../lib/store";
import { KakaoStore, initKakao, sendKakaoMemo } from "../lib/kakao";

// ── 결제 수단 메타 ────────────────────────────────────────────────────────
const METHODS: PaymentMethod[] = ["카드", "현금", "계좌이체", "간편결제", "지역화폐", ""];

const M_LABEL: Record<string, string> = {
  "카드":    "💳 카드",
  "현금":    "💵 현금",
  "계좌이체": "🏦 계좌이체",
  "간편결제": "📱 간편결제",
  "지역화폐": "🏷️ 지역화폐",
  "":        "❓ 미지정",
};
const M_COLOR: Record<string, string> = {
  "카드":    "bg-blue-500",
  "현금":    "bg-emerald-500",
  "계좌이체": "bg-indigo-500",
  "간편결제": "bg-orange-500",
  "지역화폐": "bg-purple-500",
  "":        "bg-zinc-300",
};
const M_LIGHT: Record<string, string> = {
  "카드":    "bg-blue-50 text-blue-700 border-blue-200",
  "현금":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "계좌이체": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "간편결제": "bg-orange-50 text-orange-700 border-orange-200",
  "지역화폐": "bg-purple-50 text-purple-700 border-purple-200",
  "":        "bg-zinc-50 text-zinc-500 border-zinc-200",
};

function fmtW(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }

export default function PaymentPage() {
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [members, setMembers] = useState([] as ReturnType<typeof getMembers>);
  const [toast,   setToast]   = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { setMembers(getMembers()); }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3500); }

  // 전체 패키지 (회원명 포함)
  const allPkgs = useMemo(() =>
    members.flatMap((m) => (m.packages ?? []).map((p) => ({ ...p, memberName: m.name }))),
    [members]
  );

  // 해당 연도 패키지
  const yearPkgs = useMemo(() =>
    allPkgs.filter((p) => (p.registeredAt ?? "").startsWith(String(year))),
    [allPkgs, year]
  );

  const totalAmount = yearPkgs.reduce((s, p) => s + p.paymentAmount, 0);
  const totalFee    = yearPkgs.reduce((s, p) => s + (p.paymentFee ?? 0), 0);
  const totalNet    = yearPkgs.reduce((s, p) => s + (p.netAmount ?? p.paymentAmount), 0);

  // 결제 수단별 집계
  const byMethod = useMemo(() => {
    const map: Record<string, { count: number; amount: number; fee: number; net: number }> = {};
    for (const p of yearPkgs) {
      const key = p.paymentMethod ?? "";
      if (!map[key]) map[key] = { count: 0, amount: 0, fee: 0, net: 0 };
      map[key].count++;
      map[key].amount += p.paymentAmount;
      map[key].fee    += p.paymentFee ?? 0;
      map[key].net    += p.netAmount ?? p.paymentAmount;
    }
    return map;
  }, [yearPkgs]);

  const activeMethods = METHODS.filter((m) => (byMethod[m]?.amount ?? 0) > 0);

  // 월별 데이터
  const months = Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`
  );

  const monthlyData = useMemo(() => months.map((m) => {
    const pkgs = allPkgs.filter((p) => (p.registeredAt ?? "").startsWith(m));
    const byM: Record<string, number> = {};
    for (const p of pkgs) {
      const k = p.paymentMethod || "";
      byM[k] = (byM[k] || 0) + p.paymentAmount;
    }
    return { month: m, total: pkgs.reduce((s, p) => s + p.paymentAmount, 0), byM };
  }), [allPkgs, months]);

  const maxMonthly = Math.max(...monthlyData.map((d) => d.total), 1);

  // ── 카카오 공유 ─────────────────────────────────────────────────────────
  async function handleKakaoShare() {
    const lines = [
      `💳 ${year}년 결제 수단별 매출 현황`,
      "━━━━━━━━━━━━━━━━━━━━━",
      `총 결제액: ${fmtW(totalAmount)}`,
      totalFee > 0 ? `수수료: − ${fmtW(totalFee)}` : "",
      `실수령액: ${fmtW(totalNet)}`,
      "━━━━━━━━━━━━━━━━━━━━━",
      ...activeMethods.map((m) => {
        const d = byMethod[m];
        const pct = totalAmount > 0 ? Math.round(d.amount / totalAmount * 100) : 0;
        return `${M_LABEL[m]}: ${fmtW(d.amount)} (${d.count}건 · ${pct}%)${d.fee > 0 ? ` | 수수료 −${fmtW(d.fee)}` : ""}`;
      }),
      "━━━━━━━━━━━━━━━━━━━━━",
      "📱 FitBoss",
    ].filter(Boolean);

    const text = lines.join("\n");
    const appKey = KakaoStore.getAppKey();
    const token  = KakaoStore.getToken();

    if (appKey && token) {
      setSending(true);
      try {
        await initKakao(appKey);
        await sendKakaoMemo(text);
        showToast("✅ 카카오톡으로 전송됐습니다");
      } catch (e) {
        showToast(`❌ ${(e as Error).message}`);
      } finally {
        setSending(false);
      }
    } else if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: `${year}년 결제 수단별 매출`, text });
      showToast("✅ 공유 완료");
    } else {
      await navigator.clipboard.writeText(text);
      showToast("📋 복사됐습니다. 카카오톡에 붙여넣기 하세요.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">💳 결제 수단별 매출</h1>
            <p className="text-sm text-zinc-500 mt-0.5">카드 · 현금 · 계좌이체 · 간편결제 구분 집계</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleKakaoShare} disabled={sending || totalAmount === 0}
              className="bg-yellow-400 text-zinc-900 text-xs font-black px-3 py-2 rounded-xl hover:bg-yellow-300 transition disabled:opacity-40">
              {sending ? "⏳" : "💬 카카오"}
            </button>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none">
              {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
        </div>

        {/* 연간 합계 카드 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-4">
          <p className="text-xs text-zinc-400">{year}년 결제 합계</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-black text-white">{fmtW(totalAmount)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">총 결제액</p>
            </div>
            <div>
              <p className="text-lg font-black text-red-400">− {fmtW(totalFee)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">수수료</p>
            </div>
            <div>
              <p className="text-lg font-black text-emerald-400">{fmtW(totalNet)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">실수령액</p>
            </div>
          </div>

          {/* 스택 바 */}
          {totalAmount > 0 && (
            <>
              <div className="flex rounded-full overflow-hidden h-3 gap-px">
                {activeMethods.map((m) => (
                  <div key={m}
                    style={{ width: `${(byMethod[m].amount / totalAmount) * 100}%` }}
                    className={`${M_COLOR[m]} transition-all`}
                    title={`${M_LABEL[m]}: ${fmtW(byMethod[m].amount)}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeMethods.map((m) => (
                  <span key={m} className="flex items-center gap-1 text-xs text-zinc-300">
                    <span className={`w-2 h-2 rounded-full ${M_COLOR[m]} inline-block`} />
                    {M_LABEL[m]} {Math.round(byMethod[m].amount / totalAmount * 100)}%
                  </span>
                ))}
              </div>
            </>
          )}

          {totalAmount === 0 && (
            <p className="text-zinc-500 text-sm text-center py-2">{year}년 등록 패키지 없음</p>
          )}
        </div>

        {/* 결제 수단별 상세 */}
        <div className="space-y-3">
          <p className="font-bold text-zinc-900">결제 수단별 상세</p>
          {activeMethods.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
              <p className="text-4xl mb-3">💳</p>
              <p className="text-zinc-500 text-sm font-medium">이 기간 등록된 패키지가 없습니다</p>
              <p className="text-zinc-400 text-xs mt-1">회원 관리에서 패키지를 등록해주세요</p>
            </div>
          ) : (
            activeMethods
              .slice()
              .sort((a, b) => byMethod[b].amount - byMethod[a].amount)
              .map((method) => {
                const d   = byMethod[method];
                const pct = totalAmount > 0 ? Math.round(d.amount / totalAmount * 100) : 0;
                return (
                  <div key={method} className={`bg-white rounded-2xl border p-4 space-y-3 ${M_LIGHT[method]}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-black px-3 py-1 rounded-full border ${M_LIGHT[method]}`}>
                        {M_LABEL[method]}
                      </span>
                      <div className="text-right">
                        <p className="font-black text-zinc-900 text-xl">{fmtW(d.amount)}</p>
                        <p className="text-xs text-zinc-400">{d.count}건 · 비중 {pct}%</p>
                      </div>
                    </div>
                    {/* 비중 바 */}
                    <div className="w-full bg-zinc-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${M_COLOR[method]} transition-all`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    {d.fee > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100 text-xs">
                        <div className="space-y-0.5">
                          <p className="text-zinc-400">결제 수수료</p>
                          <p className="font-bold text-red-600">− {fmtW(d.fee)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-zinc-400">실수령액</p>
                          <p className="font-bold text-emerald-600">{fmtW(d.net)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* 월별 추이 차트 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
          <p className="font-bold text-zinc-900">📊 월별 결제 추이</p>
          <div className="space-y-2">
            {monthlyData.map(({ month, total, byM }) => (
              <div key={month}>
                {total > 0 ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{Number(month.split("-")[1])}월</span>
                      <span className="font-semibold text-zinc-700">{fmtW(total)}</span>
                    </div>
                    <div className="flex rounded-full overflow-hidden h-5 bg-zinc-100">
                      {METHODS.filter((m) => (byM[m] ?? 0) > 0)
                        .sort((a, b) => (byM[b] ?? 0) - (byM[a] ?? 0))
                        .map((m) => (
                          <div key={m}
                            style={{ width: `${((byM[m] ?? 0) / maxMonthly) * 100}%` }}
                            className={`${M_COLOR[m]} transition-all flex items-center justify-center`}
                            title={`${M_LABEL[m]}: ${fmtW(byM[m] ?? 0)}`}
                          />
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-zinc-300">{Number(month.split("-")[1])}월</span>
                    <span className="text-zinc-200">—</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* 범례 */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-50">
            {METHODS.filter((m) => m !== "" || (byMethod[""]?.amount ?? 0) > 0).map((m) => (
              <span key={m} className="flex items-center gap-1 text-xs text-zinc-400">
                <span className={`w-2 h-2 rounded-full ${M_COLOR[m]} inline-block`} />
                {M_LABEL[m]}
              </span>
            ))}
          </div>
        </div>

        {/* 세무 도우미 연결 안내 */}
        <Link href="/tax"
          className="block bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2 hover:bg-blue-100 transition">
          <p className="font-black text-blue-800">🧾 세무 도우미 기장 자료 자동 연동</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            결제 수단별 매출은 세무 도우미 → 월별 기장 자료에 자동 반영됩니다.<br />
            카드 수입 / 현금 수입 / 계좌이체 / 간편결제를 구분해 세무사에게 전달 가능합니다.
          </p>
          <p className="text-xs font-bold text-blue-700">세무 도우미 바로가기 →</p>
        </Link>

        {/* 안내 */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-500">ℹ️ 결제 수단 설정 안내</p>
          <p>· 패키지 등록 시 결제 수단을 선택하면 자동으로 집계됩니다</p>
          <p>· 카드 수수료: 영세가맹점 0.4% (회원 관리에서 구간 선택 가능)</p>
          <p>· 간편결제 수수료: 약 1.5% (카카오페이·네이버페이 등)</p>
          <p>· 계좌이체·현금·지역화폐: 수수료 없음</p>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
