"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getConsultations, saveConsultations, getTrainers, getBranches,
  Consultation, ConsultationStatus, ConsultationSource, ConsultationInterest, Trainer,
} from "../lib/store";

// ── 상수 ──────────────────────────────────────────────────────────────────
const SOURCES: ConsultationSource[] = ["인스타그램", "네이버", "지인소개", "현장방문", "카카오", "기타"];
const INTERESTS: ConsultationInterest[] = ["PT", "헬스(일반)", "그룹수업", "체형교정", "다이어트", "기타"];
const STATUSES: { value: ConsultationStatus; label: string; color: string }[] = [
  { value: "예약",       label: "📅 예약",       color: "bg-blue-100 text-blue-700"    },
  { value: "완료-등록",  label: "✅ 등록완료",   color: "bg-emerald-100 text-emerald-700" },
  { value: "완료-미등록",label: "❌ 미등록",     color: "bg-red-100 text-red-600"      },
  { value: "재상담",     label: "🔄 재상담",     color: "bg-amber-100 text-amber-700"  },
  { value: "취소",       label: "🚫 취소",       color: "bg-zinc-100 text-zinc-500"    },
];

function statusStyle(s: ConsultationStatus) {
  return STATUSES.find((x) => x.value === s)?.color ?? "bg-zinc-100 text-zinc-500";
}
function statusLabel(s: ConsultationStatus) {
  return STATUSES.find((x) => x.value === s)?.label ?? s;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function emptyForm(): Omit<Consultation, "id" | "createdAt"> {
  return {
    name: "", phone: "", date: today(), time: "",
    counselor: "", branch: "", source: "", interest: "",
    status: "예약", followUpDate: "", note: "",
  };
}

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition";
const labelCls = "block text-xs font-bold text-zinc-500 mb-1.5";

export default function ConsultationPage() {
  const [list, setList]         = useState<Consultation[]>([]);
  const [filter, setFilter]     = useState<ConsultationStatus | "전체">("전체");
  const [search, setSearch]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Consultation | null>(null);
  const [form, setForm]         = useState(emptyForm());
  const [allTrainers, setAllTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    setList(getConsultations());
    setAllTrainers(getTrainers().filter((t) => t.status === "재직"));
    setBranches(getBranches());
  }, []);

  // 지점 선택 시: 해당 지점 트레이너 우선 표시.
  // 트레이너에 지점이 설정되지 않은 경우(미설정 gym) → 전체 트레이너 표시(fallback)
  const branchTrainers = (() => {
    if (!form.branch) return allTrainers;
    const matched = allTrainers.filter((t) => t.branch === form.branch);
    return matched.length > 0 ? matched : allTrainers;
  })();

  const reload = useCallback(() => setList(getConsultations()), []);

  // ── 통계 ─────────────────────────────────────────────────────────────────
  const thisMonth = today().slice(0, 7);
  const monthList = list.filter((c) => c.date.startsWith(thisMonth));
  const total     = monthList.length;
  const registered = monthList.filter((c) => c.status === "완료-등록").length;
  const convRate   = total > 0 ? Math.round((registered / total) * 100) : 0;
  const followUp   = list.filter((c) => c.status === "재상담" && c.followUpDate >= today()).length;

  // ── 필터링 ────────────────────────────────────────────────────────────────
  const filtered = list
    .filter((c) => filter === "전체" || c.status === filter)
    .filter((c) =>
      !search ||
      c.name.includes(search) ||
      c.phone.includes(search) ||
      c.counselor.includes(search)
    )
    .sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1);

  // ── 저장 ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!form.name.trim()) return;
    const all = getConsultations();
    if (editing) {
      const idx = all.findIndex((c) => c.id === editing.id);
      if (idx >= 0) all[idx] = { ...editing, ...form };
    } else {
      all.unshift({ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    }
    saveConsultations(all);
    reload();
    closeForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm("이 상담 기록을 삭제하시겠습니까?")) return;
    saveConsultations(getConsultations().filter((c) => c.id !== id));
    reload();
  };

  const openEdit = (c: Consultation) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, date: c.date, time: c.time,
      counselor: c.counselor, branch: c.branch, source: c.source,
      interest: c.interest, status: c.status, followUpDate: c.followUpDate, note: c.note });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()); };

  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // 지점 변경 시 해당 지점에 없는 상담자면 초기화
  const handleBranchChange = (branch: string) => {
    const matched = branch ? allTrainers.filter((t) => t.branch === branch) : [];
    const available = branch
      ? (matched.length > 0 ? matched : allTrainers).map((t) => t.name)
      : allTrainers.map((t) => t.name);
    setForm((p) => ({
      ...p,
      branch,
      counselor: available.includes(p.counselor) ? p.counselor : "",
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">🗣️ 상담 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">신규 상담 · 전환율 · 팔로업 관리</p>
          </div>
          <button
            onClick={() => { setEditing(null); setForm(emptyForm()); setShowForm(true); }}
            className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition"
          >
            + 상담 등록
          </button>
        </div>

        {/* 이번달 통계 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "이번달 상담", value: `${total}건`, color: "text-zinc-900" },
            { label: "등록 전환율", value: `${convRate}%`, color: convRate >= 50 ? "text-emerald-600" : convRate >= 30 ? "text-amber-600" : "text-red-500" },
            { label: "재상담 예정", value: `${followUp}건`, color: followUp > 0 ? "text-blue-600" : "text-zinc-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-zinc-100 p-4 text-center">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 유입 경로 분석 */}
        {monthList.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">이번달 유입 경로</p>
            {SOURCES.map((src) => {
              const cnt = monthList.filter((c) => c.source === src).length;
              if (cnt === 0) return null;
              const pct = Math.round((cnt / total) * 100);
              return (
                <div key={src} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600">{src}</span>
                    <span className="font-bold text-zinc-800">{cnt}건 ({pct}%)</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 검색 + 필터 */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="이름, 연락처, 상담자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls}
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(["전체", ...STATUSES.map((s) => s.value)] as (ConsultationStatus | "전체")[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  filter === s ? "bg-blue-600 text-white" : "bg-white border border-zinc-200 text-zinc-500"
                }`}
              >
                {s === "전체" ? "전체" : statusLabel(s as ConsultationStatus)}
              </button>
            ))}
          </div>
        </div>

        {/* 상담 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center space-y-2">
            <p className="text-4xl">🗣️</p>
            <p className="font-bold text-zinc-600">상담 기록이 없습니다</p>
            <p className="text-sm text-zinc-400">상담 등록 버튼으로 추가하세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3">
                {/* 상단 행 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-zinc-900">{c.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{c.phone}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(c)}
                      className="text-xs px-2.5 py-1.5 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition font-semibold">
                      수정
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition font-black">
                      ×
                    </button>
                  </div>
                </div>

                {/* 상세 정보 */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500">
                  <span>📅 {c.date} {c.time}</span>
                  {c.counselor && <span>👤 {c.counselor}</span>}
                  {c.source && <span>📍 {c.source}</span>}
                  {c.interest && <span>💪 {c.interest}</span>}
                  {c.branch && <span>🏢 {c.branch}</span>}
                  {c.status === "재상담" && c.followUpDate && (
                    <span className="text-amber-600 font-semibold">🔄 재상담: {c.followUpDate}</span>
                  )}
                </div>

                {/* 메모 */}
                {c.note && (
                  <p className="text-xs text-zinc-500 bg-zinc-50 rounded-xl px-3 py-2">{c.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 등록/수정 모달 ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <p className="font-black text-zinc-900">{editing ? "상담 수정" : "신규 상담 등록"}</p>
              <button onClick={closeForm}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition">
                ✕
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">

              {/* 이름 + 연락처 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>이름 *</label>
                  <input type="text" placeholder="홍길동" value={form.name}
                    onChange={(e) => f("name", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>연락처</label>
                  <input type="tel" placeholder="010-0000-0000" value={form.phone}
                    onChange={(e) => f("phone", e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* 날짜 + 시간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>상담 날짜</label>
                  <input type="date" value={form.date}
                    onChange={(e) => f("date", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>상담 시간</label>
                  <input type="time" value={form.time}
                    onChange={(e) => f("time", e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* 지점 + 상담자 (지점 먼저 선택 → 해당 지점 상담자 필터링) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>지점</label>
                  <select value={form.branch} onChange={(e) => handleBranchChange(e.target.value)} className={inputCls}>
                    <option value="">전체</option>
                    {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>상담자</label>
                  <select value={form.counselor} onChange={(e) => f("counselor", e.target.value)} className={inputCls}>
                    <option value="">선택</option>
                    {branchTrainers.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    <option value="직접입력">직접입력</option>
                  </select>
                </div>
              </div>

              {/* 유입 경로 */}
              <div>
                <label className={labelCls}>유입 경로</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map((src) => (
                    <button key={src} type="button"
                      onClick={() => f("source", form.source === src ? "" : src)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        form.source === src ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}>
                      {src}
                    </button>
                  ))}
                </div>
              </div>

              {/* 관심 서비스 */}
              <div>
                <label className={labelCls}>관심 서비스</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((item) => (
                    <button key={item} type="button"
                      onClick={() => f("interest", form.interest === item ? "" : item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        form.interest === item ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 상담 결과 */}
              <div>
                <label className={labelCls}>상담 결과</label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => f("status", value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        form.status === value ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 재상담 예정일 (재상담 선택 시) */}
              {form.status === "재상담" && (
                <div>
                  <label className={labelCls}>재상담 예정일</label>
                  <input type="date" value={form.followUpDate}
                    onChange={(e) => f("followUpDate", e.target.value)} className={inputCls} />
                </div>
              )}

              {/* 메모 */}
              <div>
                <label className={labelCls}>메모</label>
                <textarea
                  rows={3}
                  placeholder="상담 내용, 특이사항 등..."
                  value={form.note}
                  onChange={(e) => f("note", e.target.value)}
                  className={inputCls + " resize-none"}
                />
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-zinc-100 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {editing ? "수정 완료" : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
