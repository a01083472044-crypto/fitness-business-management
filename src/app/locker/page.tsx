"use client";

import { useState, useEffect, useCallback } from "react";
import { getLockers, saveLockers, getMembers, Locker, Member } from "../lib/store";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function daysDiff(endDate: string) {
  const end = new Date(endDate);
  const now = new Date(todayStr());
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

// 락커 상태
function lockerStatus(locker: Locker): "empty" | "expired" | "soon" | "active" {
  if (!locker.memberId) return "empty";
  const diff = daysDiff(locker.endDate);
  if (diff < 0)  return "expired";
  if (diff <= 7) return "soon";
  return "active";
}

const STATUS_STYLE = {
  empty:   { bg: "bg-zinc-100 hover:bg-zinc-200 border-zinc-200",        text: "text-zinc-400", label: "빈 락커" },
  active:  { bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",          text: "text-blue-700", label: "사용 중" },
  soon:    { bg: "bg-amber-50 hover:bg-amber-100 border-amber-300",       text: "text-amber-700", label: "만료 임박" },
  expired: { bg: "bg-red-50 hover:bg-red-100 border-red-300",             text: "text-red-600",  label: "만료" },
};

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition";
const labelCls = "block text-xs font-bold text-zinc-500 mb-1.5";

export default function LockerPage() {
  const [lockers,  setLockers]  = useState<Locker[]>([]);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [total,    setTotal]    = useState(50);
  const [editTotal, setEditTotal] = useState(false);
  const [totalInput, setTotalInput] = useState("50");

  // 선택된 락커 (모달)
  const [selected, setSelected] = useState<Locker | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 배정 폼
  const [form, setForm] = useState({
    memberId: "", memberName: "", startDate: todayStr(),
    endDate: "", note: "",
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberList, setShowMemberList] = useState(false);

  const reload = useCallback(() => {
    const saved = getLockers();
    setLockers(saved);
    setMembers(getMembers());
    const savedTotal = parseInt(localStorage.getItem("gym_locker_total") || "50");
    setTotal(savedTotal);
    setTotalInput(String(savedTotal));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── 전체 락커 그리드 생성 ─────────────────────────────────────────────────
  const lockerMap = new Map<number, Locker>(lockers.map((l) => [l.number, l]));
  const grid = Array.from({ length: total }, (_, i) => {
    const num = i + 1;
    return lockerMap.get(num) ?? {
      id: "", number: num, memberId: "", memberName: "",
      startDate: "", endDate: "", note: "",
    };
  });

  // ── 통계 ─────────────────────────────────────────────────────────────────
  const emptyCount   = grid.filter((l) => !l.memberId).length;
  const activeCount  = grid.filter((l) => lockerStatus(l) === "active").length;
  const soonCount    = grid.filter((l) => lockerStatus(l) === "soon").length;
  const expiredCount = grid.filter((l) => lockerStatus(l) === "expired").length;

  // ── 락커 클릭 ────────────────────────────────────────────────────────────
  const openLocker = (locker: Locker) => {
    setSelected(locker);
    if (locker.memberId) {
      setForm({
        memberId: locker.memberId, memberName: locker.memberName,
        startDate: locker.startDate, endDate: locker.endDate, note: locker.note,
      });
    } else {
      setForm({ memberId: "", memberName: "", startDate: todayStr(), endDate: "", note: "" });
    }
    setMemberSearch("");
    setShowMemberList(false);
    setShowModal(true);
  };

  // ── 배정 저장 ────────────────────────────────────────────────────────────
  const handleAssign = () => {
    if (!selected || !form.memberId || !form.endDate) return;
    const updated: Locker = {
      ...selected,
      id: selected.id || crypto.randomUUID(),
      memberId: form.memberId, memberName: form.memberName,
      startDate: form.startDate, endDate: form.endDate, note: form.note,
    };
    const all = getLockers().filter((l) => l.number !== selected.number);
    saveLockers([...all, updated]);
    reload();
    setShowModal(false);
  };

  // ── 해제 ────────────────────────────────────────────────────────────────
  const handleRelease = () => {
    if (!selected || !confirm(`${selected.number}번 락커를 해제하시겠습니까?`)) return;
    saveLockers(getLockers().filter((l) => l.number !== selected.number));
    reload();
    setShowModal(false);
  };

  // ── 총 락커 수 변경 ───────────────────────────────────────────────────────
  const saveTotal = () => {
    const n = parseInt(totalInput);
    if (!n || n < 1 || n > 500) return;
    localStorage.setItem("gym_locker_total", String(n));
    setTotal(n);
    setEditTotal(false);
  };

  // 회원 검색 결과
  const filteredMembers = members.filter(
    (m) => m.name.includes(memberSearch) || m.phone.includes(memberSearch)
  ).slice(0, 8);

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">🔒 락커 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">배정 · 만료일 · 빈 락커 현황</p>
          </div>
          {/* 총 락커 수 */}
          {editTotal ? (
            <div className="flex items-center gap-2">
              <input
                type="number" value={totalInput} min={1} max={500}
                onChange={(e) => setTotalInput(e.target.value)}
                className="w-20 rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-center focus:border-blue-500 focus:outline-none"
              />
              <button onClick={saveTotal}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-bold">확인</button>
            </div>
          ) : (
            <button onClick={() => setEditTotal(true)}
              className="text-xs text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-xl hover:bg-zinc-200 transition">
              총 {total}개 ✏️
            </button>
          )}
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "빈 락커",    value: emptyCount,   color: "text-zinc-500" },
            { label: "사용 중",    value: activeCount,  color: "text-blue-600" },
            { label: "만료 임박",  value: soonCount,    color: "text-amber-600" },
            { label: "만료",       value: expiredCount, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-zinc-100 p-3 text-center">
              <p className="text-[10px] text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex gap-3 flex-wrap text-xs text-zinc-500">
          {Object.entries(STATUS_STYLE).map(([key, { bg, text, label }]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded ${bg.split(" ")[0]} border ${bg.split(" ")[2]}`} />
              <span>{label}</span>
            </span>
          ))}
        </div>

        {/* 락커 그리드 */}
        <div className="grid grid-cols-5 gap-2">
          {grid.map((locker) => {
            const st = lockerStatus(locker);
            const { bg, text } = STATUS_STYLE[st];
            const diff = locker.memberId ? daysDiff(locker.endDate) : null;
            return (
              <button
                key={locker.number}
                onClick={() => openLocker(locker)}
                className={`rounded-2xl border p-2.5 flex flex-col items-center gap-1 transition ${bg}`}
              >
                <span className="text-sm font-black text-zinc-700">{locker.number}</span>
                {locker.memberId ? (
                  <>
                    <span className={`text-[9px] font-bold truncate w-full text-center leading-tight ${text}`}>
                      {locker.memberName}
                    </span>
                    <span className={`text-[9px] font-bold ${text}`}>
                      {diff !== null && diff < 0 ? "만료" : diff !== null ? `${diff}일` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-300">빈칸</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 만료 임박 목록 */}
        {(soonCount > 0 || expiredCount > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">⚠️ 만료 알림</p>
            {grid
              .filter((l) => lockerStatus(l) === "expired" || lockerStatus(l) === "soon")
              .sort((a, b) => daysDiff(a.endDate) - daysDiff(b.endDate))
              .map((l) => {
                const diff = daysDiff(l.endDate);
                const expired = diff < 0;
                return (
                  <div key={l.number}
                    onClick={() => openLocker(l)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer ${
                      expired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                    }`}>
                    <div>
                      <span className={`font-bold text-sm ${expired ? "text-red-700" : "text-amber-800"}`}>
                        {l.number}번 · {l.memberName}
                      </span>
                      <p className="text-xs text-zinc-400">만료일: {l.endDate}</p>
                    </div>
                    <span className={`text-sm font-black px-3 py-1 rounded-full ${
                      expired ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      {expired ? `${Math.abs(diff)}일 초과` : `D-${diff}`}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── 락커 모달 ──────────────────────────────────────────────────────── */}
      {showModal && selected && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <p className="font-black text-zinc-900">
                🔒 {selected.number}번 락커
                {selected.memberId && (
                  <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                    STATUS_STYLE[lockerStatus(selected)].bg.split(" ")[0]
                  } ${STATUS_STYLE[lockerStatus(selected)].text}`}>
                    {STATUS_STYLE[lockerStatus(selected)].label}
                  </span>
                )}
              </p>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition">✕</button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">

              {/* 회원 선택 */}
              <div>
                <label className={labelCls}>회원 {!selected.memberId && "*"}</label>
                {form.memberId ? (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                    <span className="text-sm font-bold text-blue-700">{form.memberName}</span>
                    <button onClick={() => setForm((p) => ({ ...p, memberId: "", memberName: "" }))}
                      className="text-xs text-blue-400 hover:text-blue-600">변경</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="이름 또는 연락처로 검색..."
                      value={memberSearch}
                      onChange={(e) => { setMemberSearch(e.target.value); setShowMemberList(true); }}
                      onFocus={() => setShowMemberList(true)}
                      className={inputCls}
                    />
                    {showMemberList && filteredMembers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-100 rounded-xl shadow-lg z-10 overflow-hidden">
                        {filteredMembers.map((m) => (
                          <button key={m.id}
                            onClick={() => {
                              setForm((p) => ({ ...p, memberId: m.id, memberName: m.name }));
                              setMemberSearch(m.name);
                              setShowMemberList(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-blue-50 hover:text-blue-600 transition">
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-zinc-400 ml-2 text-xs">{m.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>시작일</label>
                  <input type="date" value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>만료일 *</label>
                  <input type="date" value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              {/* 기간 단축 버튼 */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "1개월", months: 1 },
                  { label: "3개월", months: 3 },
                  { label: "6개월", months: 6 },
                  { label: "1년",   months: 12 },
                ].map(({ label, months }) => (
                  <button key={label}
                    onClick={() => {
                      const start = form.startDate || todayStr();
                      const d = new Date(start);
                      d.setMonth(d.getMonth() + months);
                      const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                      setForm((p) => ({ ...p, endDate: end }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition">
                    {label}
                  </button>
                ))}
              </div>

              {/* 메모 */}
              <div>
                <label className={labelCls}>메모 (선택)</label>
                <input type="text" placeholder="특이사항..." value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className={inputCls} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 flex-shrink-0 flex gap-2">
              {selected.memberId && (
                <button onClick={handleRelease}
                  className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition">
                  락커 해제
                </button>
              )}
              <button
                onClick={handleAssign}
                disabled={!form.memberId || !form.endDate}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition">
                {selected.memberId ? "수정 저장" : "배정하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
