"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getSchedules, saveSchedules, getMembers, saveMembers,
  getTrainers, syncMemberTotals, getBranches, saveBranches,
  ScheduleEntry, Member, Trainer,
} from "../lib/store";

// ── 상수 ───────────────────────────────────────────────────────────────────
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) =>
  `${String(i + 6).padStart(2, "0")}:00`
); // 06:00 ~ 21:00

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TRAINER_COLORS = [
  { cell: "bg-rose-100 border-rose-300",    text: "text-rose-800",    header: "text-rose-600"    },
  { cell: "bg-emerald-100 border-emerald-300", text: "text-emerald-800", header: "text-emerald-600" },
  { cell: "bg-amber-100 border-amber-300",  text: "text-amber-800",  header: "text-amber-600"  },
  { cell: "bg-blue-100 border-blue-300",    text: "text-blue-800",   header: "text-blue-600"   },
  { cell: "bg-violet-100 border-violet-300", text: "text-violet-800", header: "text-violet-600" },
  { cell: "bg-cyan-100 border-cyan-300",    text: "text-cyan-800",   header: "text-cyan-600"   },
  { cell: "bg-pink-100 border-pink-300",    text: "text-pink-800",   header: "text-pink-600"   },
  { cell: "bg-lime-100 border-lime-300",    text: "text-lime-800",   header: "text-lime-600"   },
];

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition text-sm";

// ── 날짜 유틸 ──────────────────────────────────────────────────────────────
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(base: Date): Date[] {
  const d = new Date(base);
  const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const today = useMemo(() => new Date(), []);

  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [members,   setMembers]   = useState<Member[]>([]);
  const [trainers,  setTrainers]  = useState<Trainer[]>([]);
  const [savedBranches, setSavedBranches] = useState<string[]>([]);

  const [weekBase,      setWeekBase]      = useState<Date>(today);
  const [selectedDate,  setSelectedDate]  = useState<string>(toDateStr(today));
  const [selectedBranch, setSelectedBranch] = useState<string>("전체");

  // 지점 추가 모달
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName,   setNewBranchName]   = useState("");
  const [branchDeleteMode, setBranchDeleteMode] = useState(false);

  // 모달
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 폼 필드
  const [formDate,      setFormDate]      = useState(toDateStr(today));
  const [formTime,      setFormTime]      = useState("09:00");
  const [formTrainerId, setFormTrainerId] = useState("");
  const [formMemberId,  setFormMemberId]  = useState("");
  const [formPackageId, setFormPackageId] = useState("");
  const [formNote,      setFormNote]      = useState("");

  useEffect(() => {
    setSchedules(getSchedules());
    setMembers(getMembers());
    setTrainers(getTrainers().filter((t) => t.status === "재직"));
    setSavedBranches(getBranches());
  }, []);

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);

  // 선택된 날짜의 엔트리
  const dayEntries = useMemo(
    () => schedules.filter((e) => e.date === selectedDate),
    [schedules, selectedDate]
  );

  // 지점 목록 (저장된 지점 + 트레이너 branch 필드 합산, 중복 제거)
  const branches = useMemo(() => {
    const fromTrainers = trainers.map((t) => t.branch).filter(Boolean);
    const merged = Array.from(new Set([...savedBranches, ...fromTrainers]));
    return ["전체", ...merged];
  }, [trainers, savedBranches]);

  // 지점 탭 항상 표시 (저장된 지점 있으면)
  const showBranchTabs = branches.length > 1;

  // 지점 추가 핸들러
  const handleAddBranch = () => {
    const name = newBranchName.trim();
    if (!name) return;
    if (branches.includes(name)) {
      alert("이미 존재하는 지점명입니다.");
      return;
    }
    const updated = [...savedBranches, name];
    setSavedBranches(updated);
    saveBranches(updated);
    setSelectedBranch(name);
    setNewBranchName("");
    setShowBranchModal(false);
  };

  // 지점 삭제 핸들러
  const handleDeleteBranch = (branch: string) => {
    if (!confirm(`"${branch}" 지점을 삭제하시겠습니까?\n해당 지점에 소속된 트레이너 데이터는 삭제되지 않습니다.`)) return;
    const updated = savedBranches.filter((b) => b !== branch);
    setSavedBranches(updated);
    saveBranches(updated);
    if (selectedBranch === branch) setSelectedBranch("전체");
  };

  // 지점 필터 적용된 트레이너 목록
  const activeTrainers = useMemo(() =>
    selectedBranch === "전체"
      ? trainers
      : trainers.filter((t) => t.branch === selectedBranch),
    [trainers, selectedBranch]
  );

  // 선택 회원의 패키지
  const memberPackages = useMemo(() => {
    const m = members.find((mb) => mb.id === formMemberId);
    return (m?.packages ?? []).filter((p) => p.totalSessions - p.conductedSessions > 0);
  }, [members, formMemberId]);

  // ── 셀 조회 ──────────────────────────────────────────────────────────────
  const getEntry = useCallback(
    (date: string, time: string, trainerId: string) =>
      schedules.find((e) => e.date === date && e.startTime === time && e.trainerId === trainerId),
    [schedules]
  );

  // ── 저장 ─────────────────────────────────────────────────────────────────
  const persist = (updated: ScheduleEntry[]) => {
    setSchedules(updated);
    saveSchedules(updated);
  };

  // ── 폼 열기 (신규) ────────────────────────────────────────────────────────
  const openAdd = (date: string, time: string, trainer?: Trainer) => {
    setEditingId(null);
    setFormDate(date);
    setFormTime(time);
    setFormTrainerId(trainer?.id ?? (trainers[0]?.id ?? ""));
    setFormMemberId(members[0]?.id ?? "");
    setFormPackageId("");
    setFormNote("");
    setShowForm(true);
  };

  // ── 폼 열기 (수정) ────────────────────────────────────────────────────────
  const openEdit = (e: ScheduleEntry) => {
    setEditingId(e.id);
    setFormDate(e.date);
    setFormTime(e.startTime);
    setFormTrainerId(e.trainerId);
    setFormMemberId(e.memberId);
    setFormPackageId(e.packageId);
    setFormNote(e.note);
    setShowForm(true);
  };

  // ── 저장 ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const trainer = trainers.find((t) => t.id === formTrainerId);
    const member  = members.find((m) => m.id === formMemberId);
    if (!trainer || !member) return;

    const entry: ScheduleEntry = {
      id:          editingId ?? crypto.randomUUID(),
      date:        formDate,
      startTime:   formTime,
      trainerId:   trainer.id,
      trainerName: trainer.name,
      memberId:    member.id,
      memberName:  member.name,
      packageId:   formPackageId,
      note:        formNote,
      done:        editingId
        ? (schedules.find((e) => e.id === editingId)?.done ?? false)
        : false,
    };

    const updated = editingId
      ? schedules.map((e) => (e.id === editingId ? entry : e))
      : [...schedules, entry];
    persist(updated);
    setShowForm(false);
  };

  // ── 완료 처리 ─────────────────────────────────────────────────────────────
  const handleDone = (entry: ScheduleEntry) => {
    if (entry.done) return;

    // 스케줄 완료 처리
    const updatedSchedules = schedules.map((e) =>
      e.id === entry.id ? { ...e, done: true } : e
    );
    persist(updatedSchedules);

    // 패키지 회차 +1 연동
    if (entry.packageId) {
      const updatedMembers = members.map((m) => {
        if (m.id !== entry.memberId) return m;
        const pkgs = (m.packages ?? []).map((p) =>
          p.id === entry.packageId && p.conductedSessions < p.totalSessions
            ? { ...p, conductedSessions: p.conductedSessions + 1 }
            : p
        );
        return syncMemberTotals({ ...m, packages: pkgs });
      });
      setMembers(updatedMembers);
      saveMembers(updatedMembers);
    }

    setShowForm(false);
  };

  // ── 삭제 ─────────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    if (!confirm("일정을 삭제하시겠습니까?")) return;
    persist(schedules.filter((e) => e.id !== id));
    setShowForm(false);
  };

  // ── 주간 표시 문자열 ──────────────────────────────────────────────────────
  const weekLabel = useMemo(() => {
    const s = weekDates[0];
    const e = weekDates[6];
    return `${s.getFullYear()}.${s.getMonth() + 1}.${s.getDate()} ~ ${e.getMonth() + 1}.${e.getDate()}`;
  }, [weekDates]);

  // ── 선택 트레이너 for 폼 찾기 ─────────────────────────────────────────────
  const selectedMember = members.find((m) => m.id === formMemberId);

  // ── 렌더링 ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-full px-2 py-6 space-y-4">

        {/* 헤더 */}
        <div className="max-w-lg mx-auto px-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900">스케줄 관리</h1>
            <p className="text-sm text-zinc-500 mt-0.5">트레이너별 주간 수업 일정</p>
          </div>
          <button
            onClick={() => openAdd(selectedDate, "09:00")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition flex-shrink-0"
          >
            + 일정 추가
          </button>
        </div>

        {/* 지점 탭 */}
        <div className="max-w-lg mx-auto px-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto scrollbar-hide">
              {branches.map((branch) => (
                <div key={branch} className="relative flex-shrink-0">
                  <button
                    onClick={() => setSelectedBranch(branch)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                      selectedBranch === branch
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    {branch}
                  </button>
                  {/* 삭제 버튼 — "전체" 탭과 트레이너에서 온 지점 제외, 저장된 지점만 */}
                  {branchDeleteMode && branch !== "전체" && savedBranches.includes(branch) && (
                    <button
                      onClick={() => handleDeleteBranch(branch)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none hover:bg-red-600 transition"
                    >×</button>
                  )}
                </div>
              ))}
            </div>
            {/* 편집 토글 버튼 */}
            {savedBranches.length > 0 && (
              <button
                onClick={() => setBranchDeleteMode((v) => !v)}
                className={`flex-shrink-0 w-8 h-8 rounded-lg text-sm font-bold transition ${
                  branchDeleteMode
                    ? "bg-red-100 text-red-500"
                    : "bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {branchDeleteMode ? "✓" : "✎"}
              </button>
            )}
            {/* 지점 추가 버튼 */}
            <button
              onClick={() => { setShowBranchModal(true); setBranchDeleteMode(false); }}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white text-lg font-bold flex items-center justify-center hover:bg-blue-700 transition"
            >+</button>
          </div>
        </div>

        {/* 주간 네비게이션 */}
        <div className="max-w-lg mx-auto px-2">
          <div className="bg-zinc-900 rounded-2xl px-4 py-3 flex items-center justify-between text-white">
            <button
              onClick={() => setWeekBase((b) => addDays(b, -7))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-700 transition text-lg"
            >‹</button>
            <span className="font-bold text-sm">{weekLabel}</span>
            <button
              onClick={() => setWeekBase((b) => addDays(b, 7))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-700 transition text-lg"
            >›</button>
          </div>
        </div>

        {/* 요일 탭 */}
        <div className="max-w-lg mx-auto px-2">
          <div className="flex gap-1">
            {weekDates.map((d) => {
              const ds   = toDateStr(d);
              const isToday  = ds === toDateStr(today);
              const isSelected = ds === selectedDate;
              const dayEntryCount = schedules.filter((e) => e.date === ds).length;
              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  className={`flex-1 py-2 rounded-xl text-center transition ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-white text-zinc-500 hover:bg-zinc-100 border border-zinc-200"
                  }`}
                >
                  <p className={`text-xs font-semibold ${isSelected ? "text-blue-100" : isToday ? "text-blue-500" : "text-zinc-400"}`}>
                    {KO_DAYS[d.getDay()]}
                  </p>
                  <p className={`text-sm font-black ${isToday && !isSelected ? "text-blue-500" : ""}`}>
                    {d.getDate()}
                  </p>
                  {dayEntryCount > 0 && (
                    <div className={`mx-auto mt-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-blue-400"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 트레이너 없음 안내 */}
        {activeTrainers.length === 0 && (
          <div className="max-w-lg mx-auto px-2">
            <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center text-zinc-400 text-sm">
              {selectedBranch === "전체" ? (
                <>
                  <p>재직 중인 트레이너가 없습니다.</p>
                  <p className="mt-1 text-xs">트레이너 관리 페이지에서 먼저 등록해주세요.</p>
                </>
              ) : (
                <>
                  <p><strong>{selectedBranch}</strong>에 소속된 트레이너가 없습니다.</p>
                  <p className="mt-1 text-xs">트레이너 관리에서 근무 지점을 확인해주세요.</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* 스케줄 그리드 */}
        {activeTrainers.length > 0 && (
          <div className="overflow-x-auto px-2">
            <div style={{ minWidth: `${60 + activeTrainers.length * 130}px` }}>

              {/* 헤더: 트레이너명 */}
              <div
                className="grid sticky top-12 z-10 bg-zinc-50"
                style={{ gridTemplateColumns: `60px repeat(${activeTrainers.length}, 1fr)` }}
              >
                <div className="h-12" /> {/* 시간 열 */}
                {activeTrainers.map((t, i) => {
                  const color = TRAINER_COLORS[i % TRAINER_COLORS.length];
                  return (
                    <div key={t.id}
                      className={`h-12 flex items-center justify-center border-b-2 ${color.cell.split(" ")[0]} border-${color.cell.split("border-")[1]}`}>
                      <span className={`text-xs font-black ${color.header}`}>{t.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* 시간 행 */}
              {TIME_SLOTS.map((time) => (
                <div
                  key={time}
                  className="grid border-b border-zinc-100"
                  style={{ gridTemplateColumns: `60px repeat(${activeTrainers.length}, 1fr)` }}
                >
                  {/* 시간 레이블 */}
                  <div className="flex items-center justify-center py-3">
                    <span className="text-xs text-zinc-400 font-mono">{time}</span>
                  </div>

                  {/* 트레이너 셀 */}
                  {activeTrainers.map((t, i) => {
                    const entry = getEntry(selectedDate, time, t.id);
                    const color = TRAINER_COLORS[i % TRAINER_COLORS.length];
                    return (
                      <div
                        key={t.id}
                        className="border-l border-zinc-100 min-h-[52px] p-1 cursor-pointer hover:bg-zinc-50 transition"
                        onClick={() => {
                          if (entry) openEdit(entry);
                          else openAdd(selectedDate, time, t);
                        }}
                      >
                        {entry ? (
                          <div className={`rounded-lg border px-2 py-1.5 h-full ${color.cell} ${entry.done ? "opacity-50" : ""}`}>
                            <p className={`text-xs font-bold truncate ${color.text}`}>
                              {entry.done && "✓ "}{entry.memberName} 수업
                            </p>
                            {entry.packageId && (
                              <p className="text-xs opacity-60 truncate">
                                {(members.find((m) => m.id === entry.memberId)?.packages ?? [])
                                  .find((p) => p.id === entry.packageId)?.name ?? ""}
                              </p>
                            )}
                            {entry.note && (
                              <p className={`text-xs opacity-60 truncate ${color.text}`}>{entry.note}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-zinc-200 text-xs">−</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 선택 날짜 요약 */}
        {dayEntries.length > 0 && (
          <div className="max-w-lg mx-auto px-2">
            <p className="text-xs font-semibold text-zinc-400 mb-2">
              {selectedDate} 수업 {dayEntries.length}건
              <span className="ml-2 text-emerald-500">완료 {dayEntries.filter((e) => e.done).length}건</span>
              <span className="ml-2 text-zinc-300">미완료 {dayEntries.filter((e) => !e.done).length}건</span>
            </p>
          </div>
        )}
      </div>

      {/* 지점 추가 모달 */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <p className="font-bold text-zinc-900 text-lg">새 지점 추가</p>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">지점명</label>
              <input
                type="text"
                placeholder="예: 강남점, 홍대점"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBranch()}
                className={inputCls}
                autoFocus
              />
            </div>
            {/* 기존 지점 목록 */}
            {savedBranches.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-400 mb-1.5">등록된 지점</p>
                <div className="flex flex-wrap gap-1.5">
                  {savedBranches.map((b) => (
                    <span key={b} className="px-2.5 py-1 bg-zinc-100 rounded-lg text-xs text-zinc-600 font-medium">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowBranchModal(false); setNewBranchName(""); }}
                className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleAddBranch}
                disabled={!newBranchName.trim()}
                className="flex-[2] rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl p-6 w-full max-w-lg mx-0 sm:mx-4 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="font-bold text-zinc-900 text-lg">
                {editingId ? "일정 수정" : "일정 추가"}
              </p>
              {editingId && (
                <button
                  onClick={() => handleDelete(editingId)}
                  className="text-xs text-red-400 hover:text-red-600 transition"
                >
                  삭제
                </button>
              )}
            </div>

            {/* 날짜 + 시간 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="날짜">
                <input type="date" value={formDate}
                  onChange={(e) => setFormDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="시작 시간">
                <select value={formTime}
                  onChange={(e) => setFormTime(e.target.value)} className={inputCls}>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* 트레이너 */}
            <Field label="담당 트레이너">
              <select value={formTrainerId}
                onChange={(e) => setFormTrainerId(e.target.value)} className={inputCls}>
                <option value="">트레이너 선택</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.empType}{t.branch ? ` · ${t.branch}` : ""})
                  </option>
                ))}
              </select>
              {trainers.length === 0 && (
                <p className="mt-1 text-xs text-zinc-400">💡 트레이너 관리에서 먼저 등록하세요</p>
              )}
            </Field>

            {/* 회원 */}
            <Field label="회원">
              <select value={formMemberId}
                onChange={(e) => { setFormMemberId(e.target.value); setFormPackageId(""); }}
                className={inputCls}>
                <option value="">회원 선택</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.phone ? ` (${m.phone})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            {/* 패키지 연동 */}
            {formMemberId && (
              <Field label="수업 패키지 연동 (선택)">
                <select value={formPackageId}
                  onChange={(e) => setFormPackageId(e.target.value)} className={inputCls}>
                  <option value="">패키지 미연동</option>
                  {memberPackages.map((p) => {
                    const remain = p.totalSessions - p.conductedSessions;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} (잔여 {remain}회)
                      </option>
                    );
                  })}
                </select>
                {memberPackages.length === 0 && formMemberId && (
                  <p className="mt-1 text-xs text-zinc-400">진행 중인 패키지가 없습니다</p>
                )}
                {formPackageId && (
                  <p className="mt-1 text-xs text-emerald-600">
                    ✅ 완료 처리 시 패키지 진행 회차가 자동으로 +1 됩니다
                  </p>
                )}
              </Field>
            )}

            {/* 메모 */}
            <Field label="메모 (선택)">
              <input type="text" placeholder="특이사항 등" value={formNote}
                onChange={(e) => setFormNote(e.target.value)} className={inputCls} />
            </Field>

            {/* 완료 처리 버튼 (수정 모드에서만) */}
            {editingId && (() => {
              const cur = schedules.find((e) => e.id === editingId);
              return cur && !cur.done ? (
                <button
                  onClick={() => handleDone(cur)}
                  className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 transition"
                >
                  ✅ 수업 완료 처리{cur.packageId ? " (패키지 회차 +1)" : ""}
                </button>
              ) : cur?.done ? (
                <div className="w-full rounded-xl bg-zinc-100 py-3 text-center text-sm font-semibold text-zinc-400">
                  ✓ 완료된 수업입니다
                </div>
              ) : null;
            })()}

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold text-zinc-600 hover:bg-zinc-50 transition">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formTrainerId || !formMemberId}
                className="flex-[2] rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
