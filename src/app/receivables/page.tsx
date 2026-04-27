"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMembers, getSchedules, getReceivables, saveReceivables,
  Member, ScheduleEntry, Receivable,
} from "../lib/store";
import { shareKakao } from "../lib/share";

function fmtW(n: number) { return "₩" + Math.round(n).toLocaleString("ko-KR"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export default function ReceivablesPage() {
  const [members,     setMembers]     = useState<Member[]>([]);
  const [schedules,   setSchedules]   = useState<ScheduleEntry[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [tab,         setTab]         = useState<"목록" | "자동감지">("목록");
  const [showForm,    setShowForm]    = useState(false);
  const [toast,       setToast]       = useState("");

  // 폼 상태
  const [fMemberId, setFMemberId] = useState("");
  const [fAmount,   setFAmount]   = useState("");
  const [fDueDate,  setFDueDate]  = useState(todayStr());
  const [fNote,     setFNote]     = useState("");

  useEffect(() => {
    setMembers(getMembers());
    setSchedules(getSchedules());
    setReceivables(getReceivables());
  }, []);

  function save(list: Receivable[]) {
    setReceivables(list);
    saveReceivables(list);
  }

  // ── 자동 감지 1: 패키지 미연동 완료 수업 ─────────────────────────────────
  const unlinkedByMember = useMemo(() => {
    const map: Record<string, { memberName: string; sessions: ScheduleEntry[] }> = {};
    for (const s of schedules.filter((s) => s.done && !s.packageId)) {
      if (!map[s.memberId]) map[s.memberId] = { memberName: s.memberName, sessions: [] };
      map[s.memberId].sessions.push(s);
    }
    return map;
  }, [schedules]);

  // ── 자동 감지 2: 패키지 만료 후 7일 이상 경과 미갱신 ──────────────────────
  const expiredNoRenewal = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return members.filter((m) => {
      const pkgs = m.packages ?? [];
      if (pkgs.length === 0) return false;
      const remaining = pkgs.reduce((s, p) => s + Math.max(p.totalSessions - p.conductedSessions, 0), 0);
      if (remaining !== 0) return false;
      const lastDone = schedules
        .filter((s) => s.memberId === m.id && s.done)
        .reduce((max, s) => s.date > max ? s.date : max, "");
      if (!lastDone) return false;
      const days = Math.floor((today.getTime() - new Date(lastDone).getTime()) / 86_400_000);
      return days >= 7;
    });
  }, [members, schedules]);

  // ── 집계 ────────────────────────────────────────────────────────────────
  const unpaid    = receivables.filter((r) => !r.paid);
  const paid      = receivables.filter((r) =>  r.paid);
  const unpaidTotal = unpaid.reduce((s, r) => s + r.amount, 0);
  const overdue   = unpaid.filter((r) => r.dueDate < todayStr());
  const autoCount = expiredNoRenewal.length + Object.keys(unlinkedByMember).length;

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  // ── 카카오 공유 ──────────────────────────────────────────────────────────
  async function handleShare() {
    const lines = [
      "⚠️ 미수금 현황 보고",
      "━━━━━━━━━━━━━━━━━━━",
      `미결제: ${unpaid.length}건 / ${fmtW(unpaidTotal)}`,
      overdue.length > 0 ? `연체: ${overdue.length}건 ⚠️` : "",
      "━━━━━━━━━━━━━━━━━━━",
      ...unpaid.map((r) => `· ${r.memberName} | ${fmtW(r.amount)} | 기한: ${r.dueDate}${r.dueDate < todayStr() ? " 🔴연체" : ""}`),
      autoCount > 0 ? `\n🔍 자동 감지: ${autoCount}건 추가 확인 필요` : "",
      "━━━━━━━━━━━━━━━━━━━",
      "📱 피트니스 경영 관리 시스템",
    ].filter(Boolean);
    const result = await shareKakao(lines.join("\n"), "미수금 현황");
    if (result === "copied") showToast("📋 복사됐습니다. 카카오톡에 붙여넣기 하세요.");
    else if (result === "shared") showToast("✅ 공유 완료!");
  }

  // ── 미수금 추가 ──────────────────────────────────────────────────────────
  function addReceivable() {
    if (!fMemberId || !fAmount) return;
    const member = members.find((m) => m.id === fMemberId);
    const newR: Receivable = {
      id: uid(), memberId: fMemberId,
      memberName: member?.name ?? "",
      amount: Number(fAmount.replace(/[^0-9]/g, "")),
      dueDate: fDueDate, note: fNote,
      paid: false, paidAt: "", createdAt: todayStr(),
    };
    save([...receivables, newR]);
    setShowForm(false);
    setFMemberId(""); setFAmount(""); setFNote(""); setFDueDate(todayStr());
    showToast("✅ 미수금이 등록됐습니다.");
  }
  function markPaid(id: string) {
    save(receivables.map((r) => r.id === id ? { ...r, paid: true, paidAt: todayStr() } : r));
    showToast("✅ 수금 완료 처리됐습니다.");
  }
  function del(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    save(receivables.filter((r) => r.id !== id));
  }

  // 자동감지 → 미수금 등록 shortcut
  function quickAdd(memberId: string, note: string, amount = "") {
    setFMemberId(memberId); setFNote(note); setFAmount(amount);
    setTab("목록"); setShowForm(true);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">💰 미수금 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">미결제·만료 미갱신 자동 감지</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleShare}
              className="flex items-center gap-1 bg-yellow-400 text-zinc-900 text-xs font-black px-3 py-2 rounded-xl hover:bg-yellow-300 transition">
              💬 카톡
            </button>
            <button onClick={() => setShowForm(true)}
              className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-orange-600 transition">
              + 추가
            </button>
          </div>
        </div>

        {/* 요약 다크카드 */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-white space-y-4">
          <p className="text-xs text-zinc-400">미수금 현황</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-black text-orange-400">{unpaid.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">미결제 건수</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-300">{fmtW(unpaidTotal)}</p>
              <p className="text-xs text-zinc-400 mt-0.5">미수금 총액</p>
            </div>
            <div>
              <p className="text-3xl font-black text-yellow-300">{overdue.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">연체 건수</p>
            </div>
          </div>
          {autoCount > 0 && (
            <div className="border-t border-zinc-700 pt-3 text-center">
              <p className="text-xs text-zinc-400">🔍 자동 감지 <span className="text-yellow-300 font-bold">{autoCount}건</span> 추가 확인 필요</p>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-2">
          {(["목록", "자동감지"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                tab === t ? "bg-orange-500 text-white" : "bg-white border border-zinc-200 text-zinc-500"
              }`}>
              {t === "목록" ? `📋 미수금 목록 (${unpaid.length})` : `🔍 자동 감지 (${autoCount})`}
            </button>
          ))}
        </div>

        {/* ── 목록 탭 ── */}
        {tab === "목록" && (
          <div className="space-y-3">
            {unpaid.length === 0 && paid.length === 0 && (
              <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-zinc-500 text-sm font-medium">미수금이 없습니다</p>
                <p className="text-zinc-400 text-xs mt-1">+ 추가 버튼으로 미수금을 기록하세요</p>
              </div>
            )}

            {/* 미결제 */}
            {unpaid.map((r) => {
              const isOverdue = r.dueDate < todayStr();
              return (
                <div key={r.id}
                  className={`bg-white rounded-2xl border p-4 space-y-3 ${isOverdue ? "border-red-200" : "border-zinc-100"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-zinc-900">{r.memberName}</p>
                        {isOverdue && (
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">🔴 연체</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">납부 기한: {r.dueDate}</p>
                      {r.note && <p className="text-xs text-zinc-500 mt-0.5">{r.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-red-600">{fmtW(r.amount)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => markPaid(r.id)}
                      className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition">
                      ✓ 수금 완료
                    </button>
                    <button onClick={() => del(r.id)}
                      className="px-4 py-2.5 bg-zinc-100 text-zinc-500 text-sm font-bold rounded-xl hover:bg-zinc-200 transition">
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 수금 완료 내역 */}
            {paid.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400 px-1">✅ 수금 완료 내역 ({paid.length}건)</p>
                {paid.map((r) => (
                  <div key={r.id} className="bg-zinc-50 rounded-xl border border-zinc-100 p-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-zinc-600 text-sm">{r.memberName}</p>
                      <p className="text-xs text-zinc-400">수금일: {r.paidAt} {r.note && `· ${r.note}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-emerald-600 text-sm">{fmtW(r.amount)}</p>
                      <button onClick={() => del(r.id)} className="text-xs text-zinc-300 hover:text-red-400 transition">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 자동감지 탭 ── */}
        {tab === "자동감지" && (
          <div className="space-y-4">

            {/* 패키지 만료 미갱신 */}
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
              <div>
                <p className="font-bold text-zinc-800">📦 패키지 만료 미갱신 회원</p>
                <p className="text-xs text-zinc-400 mt-0.5">잔여 0회 + 마지막 수업 후 7일 이상 경과</p>
              </div>
              {expiredNoRenewal.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">해당 회원 없음</p>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {expiredNoRenewal.map((m) => {
                    const latestPkg = [...(m.packages ?? [])].sort((a, b) =>
                      (b.registeredAt ?? "").localeCompare(a.registeredAt ?? ""))[0];
                    return (
                      <div key={m.id} className="flex justify-between items-center py-3">
                        <div>
                          <p className="font-semibold text-zinc-800 text-sm">{m.name}</p>
                          <p className="text-xs text-zinc-400">최근 패키지: {fmtW(latestPkg?.paymentAmount ?? 0)}</p>
                        </div>
                        <button
                          onClick={() => quickAdd(m.id, "패키지 만료 미갱신", String(latestPkg?.paymentAmount ?? ""))}
                          className="text-xs bg-orange-100 text-orange-700 font-bold px-3 py-1.5 rounded-lg hover:bg-orange-200 transition">
                          미수금 등록
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 미연동 수업 */}
            <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-3">
              <div>
                <p className="font-bold text-zinc-800">📋 패키지 미연동 완료 수업</p>
                <p className="text-xs text-zinc-400 mt-0.5">완료 처리됐지만 결제 패키지와 연결되지 않은 수업</p>
              </div>
              {Object.keys(unlinkedByMember).length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">미연동 수업 없음</p>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {Object.entries(unlinkedByMember).map(([mid, { memberName, sessions }]) => (
                    <div key={mid} className="flex justify-between items-center py-3">
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">{memberName}</p>
                        <p className="text-xs text-zinc-400">미연동 수업 {sessions.length}회</p>
                      </div>
                      <button onClick={() => quickAdd(mid, `미연동 수업 ${sessions.length}회`)}
                        className="text-xs bg-orange-100 text-orange-700 font-bold px-3 py-1.5 rounded-lg hover:bg-orange-200 transition">
                        미수금 등록
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-zinc-50 rounded-xl p-3 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-500">📌 자동 감지 기준</p>
              <p>· 만료 미갱신: 잔여 0회 + 마지막 수업 7일↑ 경과</p>
              <p>· 미연동 수업: 완료됐지만 패키지 연결 없는 수업</p>
            </div>
          </div>
        )}

        {/* ── 미수금 추가 모달 ── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50"
            onClick={() => setShowForm(false)}>
            <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}>
              <p className="font-black text-zinc-900 text-lg">미수금 추가</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 font-semibold block mb-1">회원 선택 *</label>
                  <select value={fMemberId} onChange={(e) => setFMemberId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 focus:outline-none focus:border-orange-400 bg-white">
                    <option value="">-- 회원 선택 --</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-semibold block mb-1">미수금 금액 *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₩</span>
                    <input type="number" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-zinc-200 pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-semibold block mb-1">납부 기한</label>
                  <input type="date" value={fDueDate} onChange={(e) => setFDueDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-semibold block mb-1">메모 (선택)</label>
                  <input type="text" value={fNote} onChange={(e) => setFNote(e.target.value)}
                    placeholder="미수금 사유"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition">
                  취소
                </button>
                <button onClick={addReceivable} disabled={!fMemberId || !fAmount}
                  className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl disabled:opacity-40 hover:bg-orange-600 transition">
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

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
