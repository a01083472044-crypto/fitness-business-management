"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getMembers, getCheckIns, saveCheckIns, getBranches, Member, CheckIn } from "../../lib/store";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function thisMonth() { return todayStr().slice(0,7); }

// QR 이미지 URL (무료 API)
function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data)}`;
}

// 마지막 체크인으로부터 며칠 경과?
function daysSince(dateStr: string) {
  const last = new Date(dateStr);
  const now  = new Date();
  return Math.floor((now.getTime() - last.getTime()) / 86400000);
}

const TAB = ["수동 체크인", "QR 코드", "출석 통계", "미출석 알림"] as const;
type TabType = typeof TAB[number];

export default function CheckInPage() {
  const searchParams   = useSearchParams();
  const [tab, setTab]  = useState<TabType>("수동 체크인");
  const [members, setMembers]   = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [search, setSearch]     = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [toast, setToast]       = useState<{ name: string; method: "QR"|"수동" } | null>(null);
  const [qrMember, setQrMember] = useState<Member | null>(null);

  const reload = useCallback(() => {
    setMembers(getMembers());
    setCheckIns(getCheckIns());
    setBranches(getBranches());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // URL 파라미터로 QR 자동 체크인
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const all = getMembers();
    const member = all.find((m) => m.id === id);
    if (!member) return;
    doCheckIn(member, "QR");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 체크인 처리 ───────────────────────────────────────────────────────────
  const doCheckIn = (member: Member, method: "QR"|"수동") => {
    const today = todayStr();
    const all   = getCheckIns();
    // 오늘 이미 체크인?
    const already = all.find((c) => c.memberId === member.id && c.date === today);
    if (already) {
      setToast({ name: member.name + " (오늘 이미 체크인)", method });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const newCheckIn: CheckIn = {
      id: crypto.randomUUID(),
      memberId: member.id,
      memberName: member.name,
      date: today,
      time: nowTime(),
      method,
      branch: member.trainer || "",
    };
    const updated = [newCheckIn, ...all];
    saveCheckIns(updated);
    setCheckIns(updated);
    setToast({ name: member.name, method });
    setTimeout(() => setToast(null), 3000);
  };

  // ── 필터링된 회원 ──────────────────────────────────────────────────────────
  const activeMembers = members.filter((m) => {
    const matchSearch = !search || m.name.includes(search) || m.phone.includes(search);
    const matchBranch = !branchFilter || m.trainer.includes(branchFilter);
    return matchSearch && matchBranch;
  });

  // 오늘 체크인 목록
  const todayCheckIns = checkIns.filter((c) => c.date === todayStr());
  const todayIds = new Set(todayCheckIns.map((c) => c.memberId));

  // ── 이번달 출석 통계 ──────────────────────────────────────────────────────
  const month = thisMonth();
  const monthCheckIns = checkIns.filter((c) => c.date.startsWith(month));
  // 영업일 계산 (이번달 오늘까지)
  const today = new Date();
  const daysElapsed = today.getDate();

  const memberStats = members.map((m) => {
    const mCheckIns = monthCheckIns.filter((c) => c.memberId === m.id);
    const rate = daysElapsed > 0 ? Math.round((mCheckIns.length / daysElapsed) * 100) : 0;
    return { member: m, count: mCheckIns.length, rate };
  }).sort((a, b) => b.count - a.count);

  // ── 미출석 감지 ───────────────────────────────────────────────────────────
  const ALERT_DAYS = 14;
  const absentMembers = members.map((m) => {
    const mCheckIns = checkIns.filter((c) => c.memberId === m.id);
    if (mCheckIns.length === 0) return { member: m, lastDate: null, days: 999 };
    const lastDate = mCheckIns.sort((a, b) => b.date.localeCompare(a.date))[0].date;
    return { member: m, lastDate, days: daysSince(lastDate) };
  }).filter((x) => x.days >= ALERT_DAYS)
    .sort((a, b) => b.days - a.days);

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-black text-zinc-900">✅ 체크인 관리</h1>
          <p className="text-sm text-zinc-500 mt-0.5">출석 체크 · 통계 · 미출석 알림</p>
        </div>

        {/* 오늘 요약 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "오늘 체크인", value: `${todayCheckIns.length}명`, color: "text-blue-600" },
            { label: "전체 회원", value: `${members.length}명`, color: "text-zinc-900" },
            { label: "미출석 14일+", value: `${absentMembers.length}명`, color: absentMembers.length > 0 ? "text-red-500" : "text-zinc-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-zinc-100 p-4 text-center">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex bg-zinc-100 p-1 rounded-2xl gap-1 overflow-x-auto">
          {TAB.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── 탭 1: 수동 체크인 ──────────────────────────────────────────────── */}
        {tab === "수동 체크인" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="회원 이름 또는 연락처 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
            {activeMembers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
                <p className="text-3xl mb-2">👤</p>
                <p className="text-sm text-zinc-400">등록된 회원이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeMembers.map((m) => {
                  const checked = todayIds.has(m.id);
                  return (
                    <div key={m.id}
                      className={`flex items-center justify-between bg-white rounded-2xl border px-4 py-3 transition ${
                        checked ? "border-emerald-200 bg-emerald-50" : "border-zinc-100"
                      }`}>
                      <div>
                        <p className={`font-bold text-sm ${checked ? "text-emerald-700" : "text-zinc-900"}`}>
                          {checked && "✅ "}{m.name}
                        </p>
                        <p className="text-xs text-zinc-400">{m.phone}</p>
                      </div>
                      {checked ? (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-full">
                          출석 완료
                        </span>
                      ) : (
                        <button
                          onClick={() => doCheckIn(m, "수동")}
                          className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition active:scale-95">
                          체크인
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 탭 2: QR 코드 ──────────────────────────────────────────────────── */}
        {tab === "QR 코드" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              💡 QR 코드를 회원에게 보내거나 출력해두면, 카메라로 스캔 시 자동 체크인됩니다.
            </p>
            {qrMember ? (
              // QR 상세 보기
              <div className="bg-white rounded-2xl border border-zinc-100 p-6 flex flex-col items-center gap-4">
                <p className="font-black text-zinc-900 text-lg">{qrMember.name}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl(`${typeof window !== "undefined" ? window.location.origin : ""}/checkin?id=${qrMember.id}`)}
                  alt="QR코드"
                  className="w-44 h-44 rounded-xl border border-zinc-100"
                />
                <p className="text-xs text-zinc-400 text-center">스캔하면 체크인 페이지로 이동합니다</p>
                <button onClick={() => setQrMember(null)}
                  className="w-full py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl text-sm hover:bg-zinc-200 transition">
                  목록으로
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id}
                    className="flex items-center justify-between bg-white rounded-2xl border border-zinc-100 px-4 py-3">
                    <div>
                      <p className="font-bold text-sm text-zinc-900">{m.name}</p>
                      <p className="text-xs text-zinc-400">{m.phone}</p>
                    </div>
                    <button onClick={() => setQrMember(m)}
                      className="text-xs font-bold px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition">
                      QR 보기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 탭 3: 출석 통계 ────────────────────────────────────────────────── */}
        {tab === "출석 통계" && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-400 uppercase">
              {month} 출석 현황 (1일~{today.getDate()}일, {daysElapsed}일 기준)
            </p>
            {memberStats.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
                <p className="text-sm text-zinc-400">체크인 기록이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memberStats.map(({ member, count, rate }) => (
                  <div key={member.id} className="bg-white rounded-2xl border border-zinc-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-zinc-900">{member.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">{count}회</span>
                        <span className={`text-sm font-black ${
                          rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-red-500"
                        }`}>{rate}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          rate >= 70 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 탭 4: 미출석 알림 ──────────────────────────────────────────────── */}
        {tab === "미출석 알림" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              ⚠️ 마지막 체크인으로부터 <strong>14일 이상</strong> 출석이 없는 회원입니다.
            </p>
            {absentMembers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center space-y-2">
                <p className="text-4xl">🎉</p>
                <p className="font-bold text-zinc-600">장기 미출석 회원이 없습니다!</p>
                <p className="text-sm text-zinc-400">모든 회원이 14일 이내 출석했습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {absentMembers.map(({ member, lastDate, days }) => (
                  <div key={member.id}
                    className={`bg-white rounded-2xl border px-4 py-3 flex items-center justify-between ${
                      days >= 30 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                    }`}>
                    <div>
                      <p className={`font-bold text-sm ${days >= 30 ? "text-red-700" : "text-amber-800"}`}>
                        {member.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {lastDate ? `마지막 출석: ${lastDate}` : "출석 기록 없음"}
                      </p>
                    </div>
                    <span className={`text-sm font-black px-3 py-1.5 rounded-full ${
                      days >= 30
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {days >= 999 ? "미출석" : `${days}일`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 체크인 토스트 알림 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
          <span>{toast.method === "QR" ? "📱" : "✅"}</span>
          <span>{toast.name} 체크인 완료!</span>
        </div>
      )}
    </div>
  );
}
